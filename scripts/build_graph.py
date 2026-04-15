#!/usr/bin/env python3
"""Milestone 4 — Agentic graph and alert engine.

Three-pass pipeline:
  Pass 1  Deterministic edges (dedup, entity-based, version prep)
  Pass 2  Agentic cluster resolution (Claude reasons over doc groups)
  Pass 3  Alert generation and graph payload assembly
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from pathlib import Path
from typing import Any

import anthropic
import requests
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from ingest_corpus import DEFAULT_CORPUS_DIR, extract_document, normalize_text

PROJECT_ROOT = Path(__file__).resolve().parents[1]

RELATION_NAMESPACE = uuid.UUID("e1a2b3c4-d5e6-7890-abcd-ef1234567890")
FAMILY_NAMESPACE = uuid.UUID("a1b2c3d4-e5f6-7890-1234-56789abcdef0")
ALERT_NAMESPACE = uuid.UUID("b2c3d4e5-f6a7-8901-2345-6789abcdef01")

NEAR_DUPLICATE_THRESHOLD = 0.85
DUPLICATE_THRESHOLD = 0.98


# ---------------------------------------------------------------------------
# Data containers
# ---------------------------------------------------------------------------

@dataclass
class DocRecord:
    id: str
    file_name: str
    sha256: str
    internal_label: str
    final_label: str
    confidence: float
    study_relevance: bool
    study_id: str | None
    product_id: str | None
    version_or_edition: str | None
    document_status: str
    language: str | None
    text: str = ""
    entities: list[dict[str, Any]] = field(default_factory=list)


@dataclass
class Edge:
    source_id: str
    target_id: str
    relation_type: str
    confidence: float
    evidence_type: str
    evidence_spans: list[dict[str, Any]]
    source_rule_or_model: str


@dataclass
class Alert:
    document_id: str
    alert_type: str
    severity: str
    title: str
    description: str
    evidence_spans: list[dict[str, Any]]


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Build graph, run agentic resolution, generate alerts.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-agent", action="store_true", help="Skip Pass 2 agentic resolution")
    args = parser.parse_args()

    sb_url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    sb_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not sb_url or not sb_key:
        raise SystemExit("Missing Supabase URL or service role key in .env")
    client = SupabaseRestClient(sb_url, sb_key)

    # ── Load all documents + entities from DB ──
    print("Loading documents and entities from Supabase...")
    docs = load_documents(client, args.corpus_dir)
    print(f"  {len(docs)} documents loaded, {sum(len(d.entities) for d in docs.values())} entity links")

    # ── Pass 1: Deterministic ──
    print("\n═══ Pass 1: Deterministic edges ═══")
    edges: list[Edge] = []
    alerts: list[Alert] = []
    families: dict[str, dict[str, Any]] = {}

    dup_edges, dup_groups, near_dup_groups = detect_duplicates(docs)
    edges.extend(dup_edges)
    print(f"  Duplicates: {len(dup_groups)} exact groups, {len(near_dup_groups)} near-dup groups, {len(dup_edges)} edges")

    entity_edges = build_entity_edges(docs)
    edges.extend(entity_edges)
    print(f"  Entity edges: {len(entity_edges)}")

    version_chains = prepare_version_chains(docs)
    print(f"  Version chains: {len(version_chains)} groups")

    # ── Pass 2: Agentic ──
    agent_edges: list[Edge] = []
    agent_alerts: list[Alert] = []
    agent_families: dict[str, dict[str, Any]] = {}
    agent_reclassifications: list[dict[str, Any]] = []
    agent_status_updates: dict[str, str] = {}

    if not args.skip_agent:
        print("\n═══ Pass 2: Agentic cluster resolution ═══")
        clusters = form_clusters(docs, edges, version_chains)
        print(f"  Formed {len(clusters)} clusters")

        for i, cluster in enumerate(clusters, 1):
            cluster_names = [docs[did].file_name for did in cluster["doc_ids"] if did in docs]
            print(f"\n  Cluster {i}/{len(clusters)}: {cluster['label']} ({len(cluster['doc_ids'])} docs)")
            print(f"    Files: {', '.join(cluster_names[:6])}{'...' if len(cluster_names) > 6 else ''}")

            result = agent_resolve_cluster(cluster, docs, edges, version_chains)
            if result is None:
                print("    [AGENT] failed — skipping cluster")
                continue

            agent_edges.extend(result.get("edges", []))
            agent_alerts.extend(result.get("alerts", []))
            for fam in result.get("families", []):
                fam_id = str(uuid.uuid5(FAMILY_NAMESPACE, f"{fam['family_type']}:{fam['canonical_name']}"))
                agent_families[fam_id] = {**fam, "id": fam_id}
            agent_reclassifications.extend(result.get("reclassifications", []))
            for doc_id, status in result.get("status_updates", {}).items():
                agent_status_updates[doc_id] = status

            print(f"    [AGENT] +{len(result.get('edges', []))} edges, +{len(result.get('families', []))} families, "
                  f"+{len(result.get('alerts', []))} alerts, {len(result.get('reclassifications', []))} reclassifications")

        edges.extend(agent_edges)
        alerts.extend(agent_alerts)
        families.update(agent_families)
    else:
        print("\n═══ Pass 2: Skipped (--skip-agent) ═══")

    # ── Pass 3: Alerts + payload ──
    print("\n═══ Pass 3: Alert generation ═══")
    rule_alerts = generate_rule_alerts(docs, edges, dup_groups, near_dup_groups, agent_status_updates)
    alerts.extend(rule_alerts)
    print(f"  Rule-based alerts: {len(rule_alerts)}")
    print(f"  Agent alerts: {len(agent_alerts)}")
    print(f"  Total alerts: {len(alerts)}")

    # ── Deduplicate edges ──
    edges = deduplicate_edges(edges)
    print(f"\n  Total edges (deduped): {len(edges)}")

    # ── Persist ──
    if not args.dry_run:
        print("\n═══ Persisting to Supabase ═══")
        persist_results(client, docs, edges, alerts, families,
                        dup_groups, near_dup_groups,
                        agent_reclassifications, agent_status_updates)
        print("  Done.")
    else:
        print("\n═══ Dry run — not persisting ═══")

    # ── Summary ──
    print(f"\n═══ Summary ═══")
    edge_counts = Counter(e.relation_type for e in edges)
    for rt, count in edge_counts.most_common():
        print(f"  {rt:35s} {count}")
    alert_counts = Counter(a.alert_type for a in alerts)
    print(f"\n  Alerts by type:")
    for at, count in alert_counts.most_common():
        print(f"    {at:40s} {count}")
    print(f"\n  Families: {len(families)}")
    print(f"  Reclassifications proposed: {len(agent_reclassifications)}")

    return 0


# ---------------------------------------------------------------------------
# Data loading
# ---------------------------------------------------------------------------

def load_documents(client: "SupabaseRestClient", corpus_dir: Path) -> dict[str, DocRecord]:
    rows = client.fetch_all(
        "documents",
        select="id,file_name,sha256,internal_label,final_label,classification_confidence,"
               "study_relevance,study_id,product_id,version_or_edition,document_status,language",
    )
    entity_rows = client.fetch_all(
        "document_entities",
        select="document_id,entity_id,mention_count,confidence,"
               "entities(id,entity_type,canonical_value,normalized_value)",
    )
    entities_by_doc: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for er in entity_rows:
        if er.get("entities"):
            entities_by_doc[er["document_id"]].append({
                **er["entities"],
                "mention_count": er["mention_count"],
                "confidence": float(er["confidence"] or 0),
            })

    docs: dict[str, DocRecord] = {}
    for row in rows:
        doc_id = row["id"]
        # Load text from corpus
        text = ""
        fpath = corpus_dir / row["file_name"]
        if fpath.exists():
            try:
                ext = fpath.suffix.lower().lstrip(".")
                extracted = extract_document(fpath, fpath.read_bytes(), ext)
                text = normalize_text(extracted.normalized_text or extracted.raw_text)
            except Exception:
                pass

        docs[doc_id] = DocRecord(
            id=doc_id,
            file_name=row["file_name"],
            sha256=row["sha256"],
            internal_label=row["internal_label"] or "",
            final_label=row["final_label"] or "",
            confidence=float(row["classification_confidence"] or 0),
            study_relevance=row["study_relevance"],
            study_id=row["study_id"],
            product_id=row["product_id"],
            version_or_edition=row["version_or_edition"],
            document_status=row["document_status"] or "unknown",
            language=row["language"],
            text=text,
            entities=entities_by_doc.get(doc_id, []),
        )
    return docs


# ---------------------------------------------------------------------------
# Pass 1: Deterministic
# ---------------------------------------------------------------------------

def detect_duplicates(docs: dict[str, DocRecord]) -> tuple[list[Edge], dict[str, list[str]], dict[str, list[str]]]:
    """Find exact and near-duplicate pairs."""
    edges: list[Edge] = []

    # Exact hash duplicates
    by_hash: dict[str, list[str]] = defaultdict(list)
    for doc in docs.values():
        by_hash[doc.sha256].append(doc.id)
    dup_groups: dict[str, list[str]] = {}
    for sha, ids in by_hash.items():
        if len(ids) > 1:
            group_id = str(uuid.uuid5(RELATION_NAMESPACE, f"dup:{sha}"))
            dup_groups[group_id] = ids
            for i, src in enumerate(ids):
                for tgt in ids[i + 1:]:
                    edges.append(Edge(
                        source_id=src, target_id=tgt,
                        relation_type="DUPLICATE_OF", confidence=1.0,
                        evidence_type="sha256_match",
                        evidence_spans=[{"sha256": sha}],
                        source_rule_or_model="pass1_hash",
                    ))

    # TF-IDF near-duplicate detection
    doc_list = [d for d in docs.values() if d.text.strip()]
    if len(doc_list) < 2:
        return edges, dup_groups, {}

    vectorizer = TfidfVectorizer(max_features=5000, stop_words="english", sublinear_tf=True)
    tfidf_matrix = vectorizer.fit_transform([d.text[:8000] for d in doc_list])
    sim_matrix = cosine_similarity(tfidf_matrix)

    near_dup_pairs: list[tuple[str, str, float]] = []
    for i in range(len(doc_list)):
        for j in range(i + 1, len(doc_list)):
            score = sim_matrix[i][j]
            if score >= NEAR_DUPLICATE_THRESHOLD:
                a_id, b_id = doc_list[i].id, doc_list[j].id
                # Skip if already exact dup
                already_exact = any(a_id in group and b_id in group for group in dup_groups.values())
                if already_exact:
                    continue
                near_dup_pairs.append((a_id, b_id, float(score)))

    near_dup_groups: dict[str, list[str]] = {}
    for src, tgt, score in near_dup_pairs:
        rel_type = "DUPLICATE_OF" if score >= DUPLICATE_THRESHOLD else "NEAR_DUPLICATE_OF"
        edges.append(Edge(
            source_id=src, target_id=tgt,
            relation_type=rel_type, confidence=round(score, 4),
            evidence_type="tfidf_cosine_similarity",
            evidence_spans=[{"similarity": round(score, 4)}],
            source_rule_or_model="pass1_tfidf",
        ))
        group_id = str(uuid.uuid5(RELATION_NAMESPACE, f"neardup:{min(src, tgt)}:{max(src, tgt)}"))
        near_dup_groups[group_id] = [src, tgt]

    return edges, dup_groups, near_dup_groups


def build_entity_edges(docs: dict[str, DocRecord]) -> list[Edge]:
    """Create edges between documents that share the same entities."""
    edges: list[Edge] = []

    # Group documents by entity
    entity_to_docs: dict[str, list[str]] = defaultdict(list)
    entity_info: dict[str, dict[str, Any]] = {}
    for doc in docs.values():
        for ent in doc.entities:
            key = f"{ent['entity_type']}:{ent['normalized_value']}"
            entity_to_docs[key].append(doc.id)
            entity_info[key] = ent

    # Map entity types to relation types
    type_to_relation = {
        "Study": "BELONGS_TO_STUDY",
        "Product": "ABOUT_PRODUCT",
        "Site": "MENTIONS_SITE",
        "Patient": "MENTIONS_PATIENT",
        "SafetyEvent": "MENTIONS_SAFETY_EVENT",
    }

    for entity_key, doc_ids in entity_to_docs.items():
        if len(doc_ids) < 2:
            continue
        ent = entity_info[entity_key]
        rel_type = type_to_relation.get(ent["entity_type"])
        if not rel_type:
            continue

        unique_ids = list(set(doc_ids))
        for i, src in enumerate(unique_ids):
            for tgt in unique_ids[i + 1:]:
                edges.append(Edge(
                    source_id=src, target_id=tgt,
                    relation_type=rel_type,
                    confidence=0.95,
                    evidence_type=f"shared_{ent['entity_type'].lower()}",
                    evidence_spans=[{"entity": ent["canonical_value"], "type": ent["entity_type"]}],
                    source_rule_or_model="pass1_entity",
                ))

    return edges


def prepare_version_chains(docs: dict[str, DocRecord]) -> list[dict[str, Any]]:
    """Group documents by (study, artifact_type) for version chain analysis."""
    groups: dict[tuple[str | None, str], list[str]] = defaultdict(list)
    for doc in docs.values():
        if doc.final_label == "NOISE":
            continue
        key = (doc.study_id, doc.final_label)
        groups[key].append(doc.id)

    chains = []
    for (study_id, label), doc_ids in groups.items():
        if len(doc_ids) < 2:
            continue
        chains.append({
            "study_id": study_id,
            "artifact_type": label,
            "doc_ids": doc_ids,
            "docs": [{
                "id": did,
                "file_name": docs[did].file_name,
                "version": docs[did].version_or_edition,
                "label": docs[did].internal_label,
            } for did in doc_ids],
        })
    return chains


# ---------------------------------------------------------------------------
# Pass 2: Agentic cluster resolution
# ---------------------------------------------------------------------------

def form_clusters(
    docs: dict[str, DocRecord],
    edges: list[Edge],
    version_chains: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Form clusters of related documents for agentic resolution."""
    # Build adjacency from edges
    adj: dict[str, set[str]] = defaultdict(set)
    for e in edges:
        adj[e.source_id].add(e.target_id)
        adj[e.target_id].add(e.source_id)

    # Connected components via BFS
    visited: set[str] = set()
    components: list[set[str]] = []
    for doc_id in docs:
        if doc_id in visited:
            continue
        component: set[str] = set()
        queue = [doc_id]
        while queue:
            node = queue.pop(0)
            if node in visited:
                continue
            visited.add(node)
            component.add(node)
            for neighbor in adj.get(node, set()):
                if neighbor not in visited and neighbor in docs:
                    queue.append(neighbor)
        if len(component) >= 2:
            components.append(component)

    # Also add orphans (docs with no edges) as a single cluster
    orphan_ids = {did for did in docs if did not in visited}

    clusters = []
    for comp in components:
        # Find a descriptive label
        study_ids = {docs[d].study_id for d in comp if docs[d].study_id}
        labels = Counter(docs[d].final_label for d in comp)
        if study_ids:
            study_names = []
            for did in comp:
                for ent in docs[did].entities:
                    if ent["entity_type"] == "Study":
                        study_names.append(ent["canonical_value"])
                        break
            label = f"Study {study_names[0] if study_names else 'unknown'} ({len(comp)} docs)"
        else:
            top_label = labels.most_common(1)[0][0]
            label = f"{top_label} cluster ({len(comp)} docs)"

        clusters.append({"label": label, "doc_ids": list(comp)})

    if orphan_ids:
        clusters.append({"label": f"Orphan documents ({len(orphan_ids)} docs)", "doc_ids": list(orphan_ids)})

    # Split very large clusters (>20 docs) by study_id
    split_clusters = []
    for cluster in clusters:
        if len(cluster["doc_ids"]) <= 20:
            split_clusters.append(cluster)
            continue
        by_study: dict[str | None, list[str]] = defaultdict(list)
        for did in cluster["doc_ids"]:
            by_study[docs[did].study_id].append(did)
        for study_id, sub_ids in by_study.items():
            study_label = study_id[:8] if study_id else "no-study"
            split_clusters.append({
                "label": f"{cluster['label']} / {study_label}",
                "doc_ids": sub_ids,
            })

    return split_clusters


def agent_resolve_cluster(
    cluster: dict[str, Any],
    docs: dict[str, DocRecord],
    existing_edges: list[Edge],
    version_chains: list[dict[str, Any]],
) -> dict[str, Any] | None:
    """Send a cluster to Claude for agentic resolution."""
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("    [AGENT] ANTHROPIC_API_KEY not set")
        return None

    cluster_docs = [docs[did] for did in cluster["doc_ids"] if did in docs]
    if not cluster_docs:
        return None

    # Build document summaries for the prompt
    doc_summaries = []
    for d in cluster_docs:
        entities_str = ", ".join(
            f"{e['entity_type']}={e['canonical_value']}"
            for e in d.entities[:8]
            if e["entity_type"] in ("Study", "Product", "Version", "Site", "SafetyEvent")
        )
        doc_summaries.append(
            f"- ID: {d.id[:8]}\n"
            f"  File: {d.file_name}\n"
            f"  Class: {d.final_label} ({d.internal_label}), confidence={d.confidence:.2f}\n"
            f"  Study relevant: {d.study_relevance}, Version: {d.version_or_edition or 'none'}\n"
            f"  Language: {d.language}, Status: {d.document_status}\n"
            f"  Entities: {entities_str or 'none'}\n"
            f"  Text preview: {d.text[:400]}"
        )
    docs_block = "\n\n".join(doc_summaries)

    # Existing edges in this cluster
    cluster_ids = set(cluster["doc_ids"])
    cluster_edges = [
        e for e in existing_edges
        if e.source_id in cluster_ids and e.target_id in cluster_ids
    ]
    edges_block = "\n".join(
        f"- {docs[e.source_id].file_name if e.source_id in docs else e.source_id[:8]} "
        f"--[{e.relation_type}]--> "
        f"{docs[e.target_id].file_name if e.target_id in docs else e.target_id[:8]} "
        f"(confidence={e.confidence:.2f})"
        for e in cluster_edges[:30]
    ) or "(none yet)"

    # Relevant version chains
    relevant_chains = [
        vc for vc in version_chains
        if any(did in cluster_ids for did in vc["doc_ids"])
    ]
    chains_block = "\n".join(
        f"- {vc['artifact_type']}: {', '.join(d['file_name'] + ' (v=' + str(d['version'] or '?') + ')' for d in vc['docs'])}"
        for vc in relevant_chains
    ) or "(none)"

    # Build the ID mapping for shorter references
    id_map = {d.id[:8]: d.id for d in cluster_docs}
    id_map_block = "\n".join(f"  {d.id[:8]} = {d.file_name}" for d in cluster_docs)

    prompt = f"""You are a clinical trial document intelligence agent. You are analyzing a cluster of related documents from a corpus of clinical trial files.

## Documents in this cluster

{docs_block}

## Existing edges (from entity matching)
{edges_block}

## Version chain candidates
{chains_block}

## ID mapping (use short IDs in your response)
{id_map_block}

## Your tasks

Analyze these documents together and return a JSON object with these sections:

### 1. families
Group documents into document families. A family is a set of documents that are versions/editions/amendments of the same underlying artifact.
```json
"families": [
  {{"family_type": "CSP", "canonical_name": "Protocol for BIORCE-ONC-2023-001", "study_id": "...", "member_doc_ids": ["id1", "id2"]}}
]
```

### 2. edges
Propose relationship edges between documents. Use these relation types:
SUPERSEDES, SUPERSEDED_BY, REFERS_TO, IMPLEMENTS_AMENDMENT, RELATED_TO, CONTRADICTS
```json
"edges": [
  {{"source_id": "short_id", "target_id": "short_id", "relation_type": "SUPERSEDES", "confidence": 0.95, "evidence": "v2.0 supersedes v1.0 based on version numbering"}}
]
```

### 3. status_updates
For each document, set status to "current" or "superseded" if you can determine it.
```json
"status_updates": {{"short_id": "current", "short_id2": "superseded"}}
```

### 4. alerts
Flag any issues you notice:
- Contradictions (edition mismatch, impossible dates, mixed study IDs)
- Missing expected documents (study has protocol but no CSR, etc.)
```json
"alerts": [
  {{"doc_id": "short_id", "alert_type": "CONTRADICTION", "severity": "error", "title": "...", "description": "..."}}
]
```

Valid alert_types: CONTRADICTION, MISSING_EXPECTED_LINK, SUPERSEDED_DOCUMENT
Valid severities: info, warning, error

### 5. reclassifications
If seeing these documents together changes your view of any classification, propose corrections.
```json
"reclassifications": [
  {{"doc_id": "short_id", "current_label": "CRF", "suggested_label": "CSP", "reason": "..."}}
]
```

## Important rules
- Use the SHORT document IDs (first 8 chars) in all references
- Only propose edges between documents in THIS cluster
- Be conservative — only flag contradictions you're confident about
- For version chains, use explicit evidence (version numbers, dates, "supersedes" language)

Respond with ONLY a JSON object (no markdown fencing):
{{"families": [...], "edges": [...], "status_updates": {{...}}, "alerts": [...], "reclassifications": [...]}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=4000,
            messages=[{"role": "user", "content": prompt}],
        )
        raw = response.content[0].text.strip()
        # Handle potential markdown fencing
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1].rsplit("```", 1)[0].strip()
        parsed = json.loads(raw)
    except (anthropic.APIError, json.JSONDecodeError, IndexError) as exc:
        print(f"    [AGENT] API/parse error: {exc}")
        return None

    # Resolve short IDs back to full IDs
    result = {"edges": [], "families": [], "alerts": [], "reclassifications": [], "status_updates": {}}

    for fam in parsed.get("families", []):
        resolved_members = []
        for short_id in fam.get("member_doc_ids", []):
            full_id = id_map.get(short_id, short_id)
            if full_id in docs:
                resolved_members.append(full_id)
        if resolved_members:
            result["families"].append({
                "family_type": fam.get("family_type", "unknown"),
                "canonical_name": fam.get("canonical_name", "unnamed"),
                "study_id": fam.get("study_id"),
                "member_doc_ids": resolved_members,
            })

    for edge in parsed.get("edges", []):
        src = id_map.get(edge.get("source_id", ""), edge.get("source_id", ""))
        tgt = id_map.get(edge.get("target_id", ""), edge.get("target_id", ""))
        rel_type = edge.get("relation_type", "")
        valid_types = {
            "SUPERSEDES", "SUPERSEDED_BY", "REFERS_TO",
            "IMPLEMENTS_AMENDMENT", "RELATED_TO", "CONTRADICTS",
        }
        if src in docs and tgt in docs and src != tgt and rel_type in valid_types:
            result["edges"].append(Edge(
                source_id=src, target_id=tgt,
                relation_type=rel_type,
                confidence=min(float(edge.get("confidence", 0.8)), 0.99),
                evidence_type="agent_inference",
                evidence_spans=[{"evidence": edge.get("evidence", "")}],
                source_rule_or_model="pass2_agent",
            ))

    for short_id, status in parsed.get("status_updates", {}).items():
        full_id = id_map.get(short_id, short_id)
        if full_id in docs and status in ("current", "superseded"):
            result["status_updates"][full_id] = status

    for alert in parsed.get("alerts", []):
        short_id = alert.get("doc_id", "")
        full_id = id_map.get(short_id, short_id)
        alert_type = alert.get("alert_type", "")
        severity = alert.get("severity", "warning")
        valid_alert_types = {"CONTRADICTION", "MISSING_EXPECTED_LINK", "SUPERSEDED_DOCUMENT"}
        valid_severities = {"info", "warning", "error"}
        if full_id in docs and alert_type in valid_alert_types and severity in valid_severities:
            result["alerts"].append(Alert(
                document_id=full_id,
                alert_type=alert_type,
                severity=severity,
                title=alert.get("title", alert_type),
                description=alert.get("description", ""),
                evidence_spans=[],
            ))

    for recl in parsed.get("reclassifications", []):
        short_id = recl.get("doc_id", "")
        full_id = id_map.get(short_id, short_id)
        if full_id in docs:
            result["reclassifications"].append({
                "doc_id": full_id,
                "current_label": recl.get("current_label", ""),
                "suggested_label": recl.get("suggested_label", ""),
                "reason": recl.get("reason", ""),
            })

    return result


# ---------------------------------------------------------------------------
# Pass 3: Alert generation
# ---------------------------------------------------------------------------

def generate_rule_alerts(
    docs: dict[str, DocRecord],
    edges: list[Edge],
    dup_groups: dict[str, list[str]],
    near_dup_groups: dict[str, list[str]],
    status_updates: dict[str, str],
) -> list[Alert]:
    alerts: list[Alert] = []

    # Low confidence
    for doc in docs.values():
        if doc.confidence < 0.90 and doc.final_label != "NOISE":
            alerts.append(Alert(
                document_id=doc.id,
                alert_type="LOW_CONFIDENCE_CLASSIFICATION",
                severity="info",
                title=f"Low confidence: {doc.final_label} ({doc.confidence:.2f})",
                description=f"Classification confidence is {doc.confidence:.2f}. "
                            f"The document may need manual review.",
                evidence_spans=[],
            ))

    # Exact duplicates
    for group_id, ids in dup_groups.items():
        for doc_id in ids:
            if doc_id in docs:
                others = [docs[did].file_name for did in ids if did != doc_id and did in docs]
                alerts.append(Alert(
                    document_id=doc_id,
                    alert_type="DUPLICATE_DOCUMENT",
                    severity="warning",
                    title=f"Exact duplicate of {', '.join(others[:3])}",
                    description=f"This file has the same SHA-256 hash as {', '.join(others)}.",
                    evidence_spans=[{"duplicate_group": group_id}],
                ))

    # Near duplicates
    for group_id, ids in near_dup_groups.items():
        for doc_id in ids:
            if doc_id in docs:
                others = [docs[did].file_name for did in ids if did != doc_id and did in docs]
                alerts.append(Alert(
                    document_id=doc_id,
                    alert_type="NEAR_DUPLICATE_DOCUMENT",
                    severity="info",
                    title=f"Near-duplicate of {', '.join(others[:3])}",
                    description=f"High text similarity with {', '.join(others)}.",
                    evidence_spans=[{"near_duplicate_group": group_id}],
                ))

    # Superseded (from agent)
    for doc_id, status in status_updates.items():
        if status == "superseded" and doc_id in docs:
            alerts.append(Alert(
                document_id=doc_id,
                alert_type="SUPERSEDED_DOCUMENT",
                severity="info",
                title=f"Superseded: {docs[doc_id].file_name}",
                description="This document has been superseded by a newer version.",
                evidence_spans=[],
            ))

    # Isolated documents (no edges at all)
    docs_with_edges = set()
    for e in edges:
        docs_with_edges.add(e.source_id)
        docs_with_edges.add(e.target_id)
    for doc in docs.values():
        if doc.id not in docs_with_edges and doc.final_label != "NOISE":
            alerts.append(Alert(
                document_id=doc.id,
                alert_type="ISOLATED_DOCUMENT",
                severity="warning",
                title=f"Isolated: {doc.file_name}",
                description="This document has no detected relationships to other documents.",
                evidence_spans=[],
            ))

    # Suspicious noise (high clinical score but NOISE)
    for doc in docs.values():
        if doc.final_label == "NOISE" and doc.internal_label not in ("Administrative_noise",):
            alerts.append(Alert(
                document_id=doc.id,
                alert_type="SUSPICIOUS_NOISE",
                severity="info",
                title=f"Suspicious NOISE: internally {doc.internal_label}",
                description=f"Classified as NOISE but internal label is {doc.internal_label}, "
                            f"which suggests clinical content. May need review.",
                evidence_spans=[],
            ))

    return alerts


# ---------------------------------------------------------------------------
# Edge deduplication
# ---------------------------------------------------------------------------

def deduplicate_edges(edges: list[Edge]) -> list[Edge]:
    seen: dict[tuple[str, str, str], Edge] = {}
    for e in edges:
        key = (min(e.source_id, e.target_id), max(e.source_id, e.target_id), e.relation_type)
        existing = seen.get(key)
        if existing is None or e.confidence > existing.confidence:
            seen[key] = e
    return list(seen.values())


# ---------------------------------------------------------------------------
# Persistence
# ---------------------------------------------------------------------------

def persist_results(
    client: "SupabaseRestClient",
    docs: dict[str, DocRecord],
    edges: list[Edge],
    alerts: list[Alert],
    families: dict[str, dict[str, Any]],
    dup_groups: dict[str, list[str]],
    near_dup_groups: dict[str, list[str]],
    reclassifications: list[dict[str, Any]],
    status_updates: dict[str, str],
) -> None:
    # Clear previous Milestone 4 data
    all_doc_ids = list(docs.keys())
    print("  Clearing previous relations, alerts, families...")
    client.delete_in_batches("relations", "source_document_id", all_doc_ids)
    client.delete_in_batches("alerts", "document_id", all_doc_ids)
    # Clear families by setting family_id to null on all docs first
    for doc_id in all_doc_ids:
        client.patch_row("documents", doc_id, {"family_id": None})

    # Write families
    if families:
        family_rows = []
        for fam_id, fam in families.items():
            # Always resolve study_id from member docs (agent may return codes, not UUIDs)
            study_id = None
            for did in fam.get("member_doc_ids", []):
                if did in docs and docs[did].study_id:
                    study_id = docs[did].study_id
                    break
            family_rows.append({
                "id": fam_id,
                "study_id": study_id,
                "family_type": fam["family_type"],
                "canonical_name": fam["canonical_name"],
            })
        client.upsert("document_families", family_rows, on_conflict="id")
        print(f"  Wrote {len(family_rows)} families")

        # Assign family_id to member documents
        for fam_id, fam in families.items():
            for doc_id in fam.get("member_doc_ids", []):
                if doc_id in docs:
                    client.patch_row("documents", doc_id, {"family_id": fam_id})

    # Write duplicate/near-dup group IDs
    for group_id, ids in dup_groups.items():
        for doc_id in ids:
            if doc_id in docs:
                client.patch_row("documents", doc_id, {"duplicate_group_id": group_id})
    for group_id, ids in near_dup_groups.items():
        for doc_id in ids:
            if doc_id in docs:
                client.patch_row("documents", doc_id, {"near_duplicate_group_id": group_id})

    # Write status updates
    for doc_id, status in status_updates.items():
        if doc_id in docs:
            client.patch_row("documents", doc_id, {"document_status": status})

    # Write edges
    if edges:
        edge_rows = []
        for e in edges:
            edge_id = str(uuid.uuid5(RELATION_NAMESPACE,
                          f"{e.source_id}:{e.target_id}:{e.relation_type}"))
            edge_rows.append({
                "id": edge_id,
                "source_document_id": e.source_id,
                "target_document_id": e.target_id,
                "relation_type": e.relation_type,
                "confidence": e.confidence,
                "evidence_type": e.evidence_type,
                "evidence_spans": e.evidence_spans,
                "source_rule_or_model": e.source_rule_or_model,
            })
        client.upsert("relations", edge_rows, on_conflict="id")
        print(f"  Wrote {len(edge_rows)} relations")

    # Write alerts
    if alerts:
        alert_rows = []
        for a in alerts:
            alert_id = str(uuid.uuid5(ALERT_NAMESPACE,
                           f"{a.document_id}:{a.alert_type}:{a.title[:50]}"))
            alert_rows.append({
                "id": alert_id,
                "document_id": a.document_id,
                "alert_type": a.alert_type,
                "severity": a.severity,
                "title": a.title,
                "description": a.description,
                "evidence_spans": a.evidence_spans,
                "status": "open",
            })
        # Deduplicate alerts by id
        seen_ids: set[str] = set()
        unique_alerts = []
        for row in alert_rows:
            if row["id"] not in seen_ids:
                seen_ids.add(row["id"])
                unique_alerts.append(row)
        client.upsert("alerts", unique_alerts, on_conflict="id")
        print(f"  Wrote {len(unique_alerts)} alerts")

    # Apply reclassifications (update final_label)
    valid_final_labels = {
        "CSP", "IB", "ICF", "CRF", "CSR", "eTMF", "Regulatory",
        "Synopsis", "Patient_Questionnaire", "Info_Sheet",
        "Medical_Publication", "NOISE",
    }
    for recl in reclassifications:
        doc_id = recl["doc_id"]
        suggested = recl["suggested_label"]
        if doc_id not in docs:
            continue
        if suggested not in valid_final_labels:
            print(f"  Reclassification SKIPPED (invalid label '{suggested}'): "
                  f"{docs[doc_id].file_name}")
            continue
        print(f"  Reclassification: {docs[doc_id].file_name} "
              f"{recl['current_label']} -> {suggested} ({recl['reason'][:60]})")
        client.patch_row("documents", doc_id, {
            "final_label": suggested,
            "classification_explanation": f"Agent reclassification: {recl['reason']}",
        })


# ---------------------------------------------------------------------------
# Supabase client (reused from classify_and_extract)
# ---------------------------------------------------------------------------

class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def fetch_all(self, table: str, *, select: str, filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
        params: dict[str, str] = {"select": select, "limit": "1000"}
        if filters:
            params.update(filters)
        response = requests.get(f"{self.base_url}/rest/v1/{table}", headers=self.headers, params=params, timeout=120)
        response.raise_for_status()
        return response.json()

    def upsert(self, table: str, rows: list[dict[str, Any]], *, on_conflict: str) -> None:
        for batch in _batched(rows, 50):
            headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
            response = requests.post(
                f"{self.base_url}/rest/v1/{table}",
                headers=headers,
                params={"on_conflict": on_conflict},
                json=batch,
                timeout=120,
            )
            if not response.ok:
                raise RuntimeError(f"Upsert {table}: {response.status_code} {response.text[:200]}")

    def patch_row(self, table: str, row_id: str, payload: dict[str, Any]) -> None:
        headers = {**self.headers, "Prefer": "return=minimal"}
        response = requests.patch(
            f"{self.base_url}/rest/v1/{table}",
            headers=headers,
            params={"id": f"eq.{row_id}"},
            json={k: v for k, v in payload.items() if k != "id"},
            timeout=120,
        )
        if not response.ok:
            raise RuntimeError(f"Patch {table}/{row_id}: {response.status_code} {response.text[:200]}")

    def delete_in_batches(self, table: str, column: str, values: list[str]) -> None:
        for batch in _batched(values, 25):
            joined = ",".join(batch)
            requests.delete(
                f"{self.base_url}/rest/v1/{table}",
                headers={**self.headers, "Prefer": "return=minimal"},
                params={column: f"in.({joined})"},
                timeout=120,
            )


def _batched(values: list[Any], size: int) -> list[list[Any]]:
    return [values[i:i + size] for i in range(0, len(values), size)]


if __name__ == "__main__":
    raise SystemExit(main())
