#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import re
import uuid
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import anthropic
import requests
from dotenv import load_dotenv

from ingest_corpus import DEFAULT_CORPUS_DIR, build_document_record, extract_document, normalize_text


PROJECT_ROOT = Path(__file__).resolve().parents[1]
LLM_CONFIDENCE_THRESHOLD = 0.85
PRODUCT_NAMESPACE = uuid.UUID("7a4fbffb-41de-4970-bd85-4278a5f845a3")
STUDY_NAMESPACE = uuid.UUID("7c2340f6-3dfb-4c44-8cd8-983437f7b826")
ENTITY_NAMESPACE = uuid.UUID("09e1b49f-fd15-4880-b663-4a15ebf63846")
DOC_ENTITY_NAMESPACE = uuid.UUID("3b9797f7-a28c-442f-98d0-1e0c2812d1b3")

BIORCE_STUDY_RE = re.compile(r"\bBIORCE-[A-Z]{2,5}-\d{4}-\d{3}\b", re.IGNORECASE)
BIORCE_STUDY_OCR_RE = re.compile(
    r"\bBIORCE?\s*[-–]\s*[A-Z]{2,5}\s*[-–]\s*\d{4}\s*[-–]\s*\d{3}\b",
    re.IGNORECASE,
)
PRODUCT_RE = re.compile(r"\b(BRC-\d{3})(?:\s*\(([^)]+)\))?", re.IGNORECASE)
PRODUCT_OCR_RE = re.compile(r"\b(BRC\s*[-–]\s*\d{3})(?:\s*\(([^)]+)\))?", re.IGNORECASE)
SITE_RE = re.compile(r"\b[A-Z]{2}-\d{2}\b")
PATIENT_RE = re.compile(r"\b(?:BRC\d{3}|[A-Z]{4,}|\[CODE\])\s*[-–]\s*[A-Z]{2}\s*\d{2}\s*[-–]\s*\d{3}\b")
SAE_RE = re.compile(r"\bBIORCE\s*[-–]\s*SAE\s*[-–]\s*\d{4}\s*[-–]\s*\d{3}\b", re.IGNORECASE)
PHASE_RE = re.compile(r"\bphase\s+([ivx]+)\b", re.IGNORECASE)
VERSION_PATTERNS = [
    re.compile(r"\b(version|form version)\s*[:.]?\s*((?:\d+(?:\.\d+){0,2})|draft)\b", re.IGNORECASE),
    re.compile(r"\b(edition|ed\.?)\s*[:.]?\s*((?:\d+(?:\.\d+){0,2})|draft)\b", re.IGNORECASE),
    re.compile(r"\b(amendment)\s*[:.]?\s*(\d+(?:\.\d+)?)\b", re.IGNORECASE),
]

UNRELATED_SPONSORS = [
    "iovance",
    "novartis",
    "roche",
    "merck",
    "pfizer",
    "astellas",
    "amgen",
]

REGULATOR_PATTERNS = {
    "AIFA": re.compile(r"\bAIFA\b"),
    "EMA": re.compile(r"\bEMA\b"),
    "FDA": re.compile(r"\bFDA\b"),
    "EudraCT": re.compile(r"\bEudraCT\b", re.IGNORECASE),
    "Ethics Committee": re.compile(r"\bethics committee\b|\bcomit[eé] etico\b|\bcomitato etico\b", re.IGNORECASE),
}

CLASS_RULES: dict[str, list[tuple[str, float, str]]] = {
    "CSP_full": [
        (r"clinical study protocol", 8.0, "explicit protocol title"),
        (r"schedule of assessments", 3.5, "schedule of assessments section"),
        (r"inclusion criteria|exclusion criteria", 3.0, "eligibility criteria"),
        (r"study design", 2.5, "study design section"),
        (r"amendment\s+\d+", 2.0, "amendment marker"),
    ],
    "CSP_synopsis": [
        (r"protocol synopsis|synopsis", 6.0, "synopsis wording"),
        (r"primary objective|primary endpoint", 2.5, "protocol objective structure"),
        (r"study population", 2.0, "protocol population wording"),
    ],
    "IB": [
        (r"investigator brochure", 8.5, "explicit IB title"),
        (r"supersedes edition|edition\s+\d+", 2.5, "brochure edition wording"),
        (r"nonclinical|pharmacology|toxicology", 2.0, "IB scientific sections"),
    ],
    "ICF": [
        (r"informed consent form", 8.5, "explicit ICF title"),
        (r"consenso informato|modulo di consenso|foglio informativo", 8.0, "non-English consent wording"),
        (r"participation is completely voluntary|you may withdraw", 2.5, "consent language"),
        (r"signature|signing", 1.5, "signature block"),
    ],
    "CRF_patient_form": [
        (r"\becrf\b|\bcase report form\b", 8.0, "explicit CRF wording"),
        (r"meddra|ae_term_verbatim|patient code|site id", 3.5, "form field labels"),
        (r"reporting period|form version", 2.0, "form metadata"),
    ],
    "CSR": [
        (r"clinical study report", 8.5, "explicit CSR title"),
        (r"patient disposition", 3.0, "CSR section"),
        (r"safety\b|conclusions?\b|synopsis\b", 2.5, "CSR sections"),
        (r"data cut-off|total patients", 2.0, "CSR study summary fields"),
    ],
    "eTMF_index": [
        (r"trial master file index|\betmf\b", 8.5, "explicit eTMF index wording"),
        (r"tmf reference model|veeva vault|artifact", 3.5, "TMF platform/index structure"),
        (r"date filed|owner|zone|section", 2.0, "TMF index table structure"),
    ],
    "eTMF_site_ops": [
        (r"protocol deviation log|site initiation visit|investigator cv|financial disclosure", 7.0, "site operations artifact"),
        (r"clinical ops|site mgmt|screening and enrolment logs", 2.5, "site operations language"),
    ],
    "eTMF_monitoring": [
        (r"monitor(?:ing)? visit report|source data verification|follow-up letter", 7.5, "monitoring artifact"),
        (r"monitor findings|sdv", 2.5, "monitoring language"),
    ],
    "eTMF_regulatory_correspondence": [
        (r"regulatory authority|cover letter|submission|correspondence", 6.5, "regulatory correspondence wording"),
        (r"health authority|eudract|approval letter", 3.0, "regulatory identifiers"),
    ],
    "DSUR": [
        (r"development safety update report|\bdsur\b", 9.0, "explicit DSUR title"),
    ],
    "DSMB_charter": [
        (r"dsmb charter|data safety monitoring board charter", 9.0, "explicit DSMB charter title"),
    ],
    "DSMB_minutes": [
        (r"dsmb minutes|data safety monitoring board minutes|meeting minutes", 8.0, "explicit DSMB minutes title"),
    ],
    "SmPC": [
        (r"summary of product characteristics|\bsmpc\b", 9.0, "explicit SmPC title"),
        (r"posology|pharmaceutical form", 2.5, "SmPC sections"),
    ],
    "Ethics_approval": [
        (r"ethics committee approval|central ethics committee approval", 8.0, "explicit ethics approval"),
        (r"comit[eé] etico|comitato etico", 7.5, "non-English ethics wording"),
    ],
    "Patient_questionnaire": [
        (r"(?:domain|item)\s*\d?\s*[-–:]\s*(?:normal|questionable|mild|moderate|severe)", 6.0, "assessment scale with severity levels"),
        (r"\bmorse fall scale\b.*\btotal\b|\bfalls since last visit\b.*\bnone\b.*\b\d\+", 5.5, "fall risk assessment form"),
        (r"(?:max\s+score|scoring|domain)\s*\n.*(?:orientation|registration|attention|recall|language)", 5.0, "cognitive test scoring grid"),
        (r"kartleggingsverkt|kartleggingsskjema", 5.0, "non-English assessment tool"),
    ],
    "Info_sheet": [
        (r"infoark.{0,30}deltaker|informasjonsskriv.{0,30}deltaker", 8.0, "non-English participant info sheet"),
        (r"studiemedis\w*\s.{0,40}kapsler|kapsler.{0,40}studiemedis", 6.0, "non-English medication instructions"),
        (r"informational\s+document\s+for\s+(the\s+)?participant", 6.0, "explicit participant info sheet title"),
    ],
    "Medical_publication": [
        (r"submitted to:|authors:|background:|methods:|results:|conclusions:", 7.5, "publication abstract structure"),
        (r"journal|annual congress|oral presentation|abstract", 3.0, "publication venue wording"),
    ],
    "Administrative_noise": [
        (r"helpdesk ticket|lease agreement|invoice|purchase order|job description", 9.0, "administrative language"),
        (r"it department|facilities|vendor|payroll", 3.0, "administrative department wording"),
        (r"\besg report\b|\benvironmental.{0,20}social.{0,20}governance\b", 8.0, "ESG/corporate reporting"),
        (r"press release|for immediate release|media contact", 7.5, "press release language"),
        (r"curriculum vitae|professional experience|education:.*(?:university|degree|diploma)", 7.0, "CV/resume language"),
        (r"total due|subtotal.*iva|unit price.*total|gala dinner|cocktail reception|catering", 8.0, "catering/billing document"),
    ],
}

FINAL_LABEL_MAP = {
    "CSP_full": "CSP",
    "CSP_synopsis": "Synopsis",
    "IB": "IB",
    "ICF": "ICF",
    "CRF_patient_form": "CRF",
    "CSR": "CSR",
    "eTMF_index": "eTMF",
    "eTMF_site_ops": "eTMF",
    "eTMF_monitoring": "eTMF",
    "eTMF_regulatory_correspondence": "eTMF",
    "Ethics_approval": "eTMF",
    "DSUR": "Regulatory",
    "DSMB_charter": "Regulatory",
    "DSMB_minutes": "Regulatory",
    "SmPC": "Regulatory",
    "Patient_questionnaire": "Patient_Questionnaire",
    "Info_sheet": "Info_Sheet",
    "Medical_publication": "Medical_Publication",
    "Administrative_noise": "NOISE",
}


@dataclass
class ClassificationResult:
    study_relevance: bool
    internal_label: str
    final_label: str
    confidence: float
    explanation: str
    top_2_labels: list[dict[str, Any]]
    study_code: str | None
    product_code: str | None
    version_or_edition: str | None
    entities: list[dict[str, Any]]


def main() -> int:
    load_dotenv(PROJECT_ROOT / ".env")

    parser = argparse.ArgumentParser(description="Classify ingested documents and extract entities.")
    parser.add_argument("--corpus-dir", type=Path, default=DEFAULT_CORPUS_DIR)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--file-names", nargs="*", default=[])
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--skip-llm", action="store_true", help="Skip LLM arbitration for low-confidence documents")
    args = parser.parse_args()

    url = os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise SystemExit("Missing Supabase URL or service role key in .env")

    corpus_dir = args.corpus_dir.resolve()
    files = sorted(path for path in corpus_dir.iterdir() if path.is_file())
    if args.file_names:
        wanted = {name.casefold() for name in args.file_names}
        files = [path for path in files if path.name.casefold() in wanted]
    if args.limit > 0:
        files = files[: args.limit]

    client = SupabaseRestClient(url, key)
    existing_documents = {
        row["storage_path"]: row
        for row in client.fetch_all(
            "documents",
            select="id,file_name,storage_path,study_id,product_id,internal_label,final_label,classification_confidence",
            filters={"storage_path": "like.raw-documents/corpus/%"},
        )
    }

    document_updates: list[dict[str, Any]] = []
    products: dict[str, dict[str, Any]] = {}
    studies: dict[str, dict[str, Any]] = {}
    entities: dict[tuple[str, str], dict[str, Any]] = {}
    doc_entities: list[dict[str, Any]] = []
    sample_output: list[dict[str, Any]] = []
    document_ids_to_refresh: list[str] = []

    for path in files:
        record = build_document_record(path, corpus_dir, uploaded_to_storage=True)
        doc_row = existing_documents.get(record["document_row"]["storage_path"])
        if not doc_row:
            continue
        extracted = classify_document(path, skip_llm=args.skip_llm)
        product_id = None
        study_id = None
        if extracted.product_code:
            product_row = build_product_row(extracted.product_code, extracted.entities)
            products[product_row["product_code"]] = product_row
            product_id = product_row["id"]
        if extracted.study_code:
            study_row = build_study_row(extracted.study_code, extracted.entities, product_id)
            existing_study = studies.get(study_row["study_code"])
            if existing_study:
                if not existing_study.get("product_id") and study_row.get("product_id"):
                    existing_study["product_id"] = study_row["product_id"]
                studies[study_row["study_code"]] = existing_study
            else:
                studies[study_row["study_code"]] = study_row
            study_id = study_row["id"]

        document_updates.append(
            {
                "id": doc_row["id"],
                "study_relevance": extracted.study_relevance,
                "internal_label": extracted.internal_label,
                "final_label": extracted.final_label,
                "classification_confidence": extracted.confidence,
                "classification_explanation": extracted.explanation,
                "top_2_labels": extracted.top_2_labels,
                "study_id": study_id,
                "product_id": product_id,
                "version_or_edition": extracted.version_or_edition,
            }
        )
        document_ids_to_refresh.append(doc_row["id"])

        for entity in extracted.entities:
            key_tuple = (entity["entity_type"], entity["normalized_value"])
            entities[key_tuple] = entity
            doc_entities.append(
                {
                    "id": str(uuid.uuid5(DOC_ENTITY_NAMESPACE, f"{doc_row['id']}::{entity['entity_type']}::{entity['normalized_value']}")),
                    "document_id": doc_row["id"],
                    "entity_id": entity["id"],
                    "mention_count": entity["mention_count"],
                    "confidence": entity["confidence"],
                    "evidence_spans": entity["evidence_spans"],
                }
            )

        sample_output.append(
            {
                "file_name": path.name,
                "study_relevance": extracted.study_relevance,
                "internal_label": extracted.internal_label,
                "final_label": extracted.final_label,
                "confidence": extracted.confidence,
                "study_code": extracted.study_code,
                "product_code": extracted.product_code,
                "entity_count": len(extracted.entities),
            }
        )

    if not args.dry_run:
        if products:
            client.upsert("products", list(products.values()), on_conflict="product_code")
        if studies:
            client.upsert("studies", list(studies.values()), on_conflict="study_code")
        if document_ids_to_refresh:
            client.delete_in_batches("document_entities", "document_id", document_ids_to_refresh)
        if entities:
            client.upsert(
                "entities",
                [
                    {
                        "id": entity["id"],
                        "entity_type": entity["entity_type"],
                        "canonical_value": entity["canonical_value"],
                        "display_value": entity["display_value"],
                        "normalized_value": entity["normalized_value"],
                        "metadata": entity["metadata"],
                    }
                    for entity in entities.values()
                ],
                on_conflict="entity_type,normalized_value",
            )
        if doc_entities:
            client.upsert("document_entities", doc_entities, on_conflict="document_id,entity_id")
        for update in document_updates:
            client.patch_row("documents", update["id"], update)

    print(
        json.dumps(
            {
                "processed_files": len(document_updates),
                "products": len(products),
                "studies": len(studies),
                "entities": len(entities),
                "document_entities": len(doc_entities),
                "samples": sample_output[:12],
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    return 0


def classify_document(file_path: Path, *, skip_llm: bool = False) -> ClassificationResult:
    extracted = extract_document(file_path, file_path.read_bytes(), file_path.suffix.lower().lstrip("."))
    text = normalize_text(extracted.normalized_text or extracted.raw_text)
    structure = extracted.structure
    lowered = text.casefold()

    scores: dict[str, float] = {}
    reasons: dict[str, list[str]] = defaultdict(list)
    for label, rules in CLASS_RULES.items():
        score = 0.0
        for pattern, weight, reason in rules:
            if re.search(pattern, lowered, re.IGNORECASE):
                score += weight
                reasons[label].append(reason)
        heading_hits = sum(1 for heading in structure.get("headings", []) if re.search(pattern_for_label(label), heading, re.IGNORECASE))
        if heading_hits:
            score += heading_hits * 0.75
        scores[label] = round(score, 3)

    ranked = sorted(scores.items(), key=lambda item: item[1], reverse=True)
    top_label, top_score = ranked[0]
    second_label, second_score = ranked[1]

    entities = extract_entities(text, structure, top_label)
    study_codes = [entity["canonical_value"] for entity in entities if entity["entity_type"] == "Study" and entity["canonical_value"].startswith("BIORCE-")]
    product_codes = [entity["canonical_value"].split(" ", 1)[0] for entity in entities if entity["entity_type"] == "Product"]
    version_candidates = [entity["display_value"] for entity in entities if entity["entity_type"] == "Version"]

    # --- Study relevance: does this document belong to a Biorce study? ---
    # This is metadata for the graph, NOT used to determine the final label.
    positive_relevance = 0
    negative_relevance = 0
    if study_codes:
        positive_relevance += 4 + len(study_codes)
    if product_codes:
        positive_relevance += 2 + len(product_codes)
    if "biorce therapeutics" in lowered or "biorce" in lowered:
        positive_relevance += 3
    if top_label in {"Administrative_noise"}:
        negative_relevance += 5
    if any(sponsor in lowered for sponsor in UNRELATED_SPONSORS) and not study_codes and "biorce" not in lowered:
        negative_relevance += 4
    if "iov-mel-202" in lowered and not study_codes:
        negative_relevance += 4

    study_relevance = positive_relevance > 0 and positive_relevance >= negative_relevance

    # --- Final label: classify by document type, not by sponsor ---
    # NOISE = not a clinical trial document at all (admin, corporate, press releases, CVs)
    final_label = FINAL_LABEL_MAP[top_label]
    is_noise = _is_noise_document(top_label, final_label, top_score, lowered, study_relevance)

    if is_noise:
        final_label = "NOISE"

    confidence = confidence_from_scores(top_score, second_score)
    if top_score < 4.5:
        confidence = round(min(confidence, 0.62), 4)

    explanation_parts = reasons[top_label][:3]
    if study_relevance and study_codes:
        explanation_parts.append(f"study match {study_codes[0]}")
    if is_noise and top_label != "Administrative_noise":
        explanation_parts.append("non-clinical document (NOISE)")
    explanation = "; ".join(explanation_parts) if explanation_parts else "weak heuristic match"

    top_2 = [
        {"label": label, "score": round(score, 3)}
        for label, score in ranked[:2]
    ]

    study_code = most_common(study_codes)
    product_code = most_common(product_codes)
    version_or_edition = most_common(version_candidates)

    rule_result = ClassificationResult(
        study_relevance=study_relevance,
        internal_label=top_label,
        final_label=final_label,
        confidence=confidence,
        explanation=explanation,
        top_2_labels=top_2,
        study_code=study_code,
        product_code=product_code,
        version_or_edition=version_or_edition,
        entities=entities,
    )

    if skip_llm or confidence >= LLM_CONFIDENCE_THRESHOLD:
        return rule_result

    print(f"    [LLM] confidence {confidence:.4f} < {LLM_CONFIDENCE_THRESHOLD} — requesting arbitration")
    llm_result = llm_arbitrate(
        file_name=file_path.name,
        text=text,
        structure=structure,
        rule_result=rule_result,
        ranked_scores=ranked[:5],
    )
    if llm_result is None:
        return rule_result
    return llm_result


def llm_arbitrate(
    *,
    file_name: str,
    text: str,
    structure: dict[str, Any],
    rule_result: ClassificationResult,
    ranked_scores: list[tuple[str, float]],
) -> ClassificationResult | None:
    """Call Claude to arbitrate a low-confidence classification.

    Returns a refined ClassificationResult, or None if the API call fails.
    """
    api_key = os.getenv("ANTHROPIC_API_KEY")
    if not api_key:
        print("    [LLM] ANTHROPIC_API_KEY not set — skipping arbitration")
        return None

    internal_labels = list(CLASS_RULES.keys())
    final_labels = sorted(set(FINAL_LABEL_MAP.values()))

    entity_summary = []
    for e in rule_result.entities[:15]:
        entity_summary.append(f"  - {e['entity_type']}: {e['canonical_value']} (confidence {e['confidence']:.2f})")
    entity_block = "\n".join(entity_summary) if entity_summary else "  (none extracted)"

    headings = structure.get("headings", [])[:15]
    headings_block = "\n".join(f"  - {h}" for h in headings) if headings else "  (none detected)"

    field_labels = structure.get("field_labels", [])[:15]
    fields_block = ", ".join(field_labels) if field_labels else "(none detected)"

    rule_scores_block = "\n".join(f"  - {label}: {score:.1f}" for label, score in ranked_scores)

    text_preview = text[:3000]

    prompt = f"""You are a clinical trial document classifier.

You are given a document that the rule-based classifier could not confidently classify. Your job is to determine the correct document type.

## Internal taxonomy (pick exactly one)
{json.dumps(internal_labels, indent=2)}

## Final hackathon label mapping
{json.dumps(FINAL_LABEL_MAP, indent=2)}

## CRITICAL: What is NOISE?
NOISE means the document is NOT a clinical trial document at all. Examples: invoices, catering orders, ESG reports, press releases, CVs, vendor contracts, job postings, helpdesk tickets.

NOISE does NOT mean "from a different sponsor." A protocol from Iovance is still a CSP. An Italian informed consent from VIRTUOSE is still an ICF. A French ethics approval from any study is still eTMF (Ethics_approval). Classify by DOCUMENT TYPE, not by sponsor.

Medical publications (journal articles, conference abstracts) that report or analyze clinical trial results should be Medical_Publication. Generic review articles or editorials with no connection to any specific clinical trial should be NOISE.

## Context about this document

File name: {file_name}
Rule-based top pick: {rule_result.internal_label} (score {ranked_scores[0][1]:.1f})
Rule-based confidence: {rule_result.confidence:.4f}
Rule-based explanation: {rule_result.explanation}

Rule scores for top candidates:
{rule_scores_block}

Detected headings:
{headings_block}

Detected field labels: {fields_block}

Extracted entities:
{entity_block}

## Document text (first 3000 chars)
{text_preview}

## Instructions

1. Read the document text carefully.
2. Determine the most appropriate internal_label from the taxonomy above.
3. Determine study_relevance: true if this document belongs to a Biorce Therapeutics study (codes start with BIORCE-), false otherwise. This is metadata only — it does NOT affect the document type.
4. Map your internal_label to the correct final_label using the mapping above. Only set final_label to NOISE if the document is genuinely not a clinical trial document.
5. Provide a confidence score between 0.0 and 1.0 for your classification.
6. Provide a brief explanation (1-2 sentences) of why you chose this label.

Respond with ONLY a JSON object (no markdown fencing) with these exact keys:
{{
  "internal_label": "...",
  "final_label": "...",
  "study_relevance": true/false,
  "confidence": 0.XX,
  "explanation": "..."
}}"""

    try:
        client = anthropic.Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=300,
            messages=[{"role": "user", "content": prompt}],
        )
        raw_response = response.content[0].text.strip()
        parsed = json.loads(raw_response)
    except (anthropic.APIError, json.JSONDecodeError, IndexError, KeyError) as exc:
        print(f"    [LLM] arbitration failed: {exc}")
        return None

    llm_internal = parsed.get("internal_label", "")
    llm_final = parsed.get("final_label", "")
    llm_relevance = parsed.get("study_relevance", rule_result.study_relevance)
    llm_confidence = parsed.get("confidence", 0.5)
    llm_explanation = parsed.get("explanation", "LLM arbitration (no explanation returned)")

    if llm_internal not in CLASS_RULES:
        print(f"    [LLM] returned invalid internal_label '{llm_internal}' — falling back to rules")
        return None
    if llm_final not in final_labels:
        llm_final = FINAL_LABEL_MAP.get(llm_internal, rule_result.final_label)

    llm_confidence = round(max(0.05, min(float(llm_confidence), 0.99)), 4)

    print(f"    [LLM] result: {llm_internal} -> {llm_final} (confidence {llm_confidence:.4f}, relevance={llm_relevance})")

    return ClassificationResult(
        study_relevance=llm_relevance,
        internal_label=llm_internal,
        final_label=llm_final,
        confidence=llm_confidence,
        explanation=f"LLM arbitration: {llm_explanation}",
        top_2_labels=rule_result.top_2_labels,
        study_code=rule_result.study_code,
        product_code=rule_result.product_code,
        version_or_edition=rule_result.version_or_edition,
        entities=rule_result.entities,
    )


def _is_noise_document(
    internal_label: str,
    final_label: str,
    top_score: float,
    lowered: str,
    study_relevance: bool,
) -> bool:
    """Determine if a document is NOISE (not a clinical trial document at all).

    NOISE means: invoices, CVs, ESG reports, press releases, vendor contracts,
    corporate emails, etc. Documents from other sponsors' clinical trials are
    NOT noise — they are valid trial documents that happen to belong to a
    different study.
    """
    if internal_label == "Administrative_noise":
        return True

    # Strong single-signal noise indicators (one is enough)
    strong_noise = [
        "esg report", "for immediate release", "press release",
        "helpdesk ticket", "lease agreement", "purchase order",
        "vendor contract", "gala dinner", "cocktail reception",
        "total due", "job posting",
    ]
    if any(phrase in lowered for phrase in strong_noise):
        return True

    # Weaker noise signals — need two to confirm
    weak_noise = [
        "media contact", "curriculum vitae", "professional experience",
        "payroll", "invoice", "catering", "facilities management",
    ]
    if sum(1 for phrase in weak_noise if phrase in lowered) >= 2:
        return True

    # Academic journal articles (reviews, editorials, meta-analyses) that are
    # not about a specific Biorce trial. These masquerade as clinical docs
    # because they discuss trials in an academic context.
    is_journal_article = any(
        term in lowered for term in [
            "doi.org/", "doi:", "open access", "issn",
            "published online", "accepted for publication",
            "advance access publication",
        ]
    )
    is_review_or_editorial = any(
        term in lowered for term in [
            "systematic review", "narrative review", "editorial",
            "review article", "overview of current",
            "this is an overview", "literature review",
            "meta-analysis", "meta analysis",
        ]
    )
    if not study_relevance and (is_review_or_editorial or is_journal_article):
        # Make sure this isn't actually a clinical trial document that merely
        # references journal articles in its bibliography.
        is_trial_document = any(
            term in lowered for term in [
                "inclusion criteria", "exclusion criteria",
                "schedule of assessments", "informed consent",
                "case report form", "trial master file",
                "investigator brochure", "patient disposition",
                "protocol deviation", "monitoring visit",
                "data safety monitoring", "study drug",
            ]
        )
        if is_trial_document:
            pass  # keep as its classified type, not NOISE
        else:
            # It's a journal paper not connected to a Biorce study. Check if
            # it reports results from a SPECIFIC trial (conference abstract,
            # post-hoc analysis) vs. general background literature.
            is_specific_trial_report = any(
                term in lowered for term in [
                    "post-hoc analysis", "we evaluated", "we report",
                    "patients were enrolled", "were randomized to",
                    "submitted to:", "conference abstract",
                ]
            )
            if not is_specific_trial_report:
                return True

    return False


def pattern_for_label(label: str) -> str:
    seeds = {
        "CSP_full": r"protocol|amendment",
        "CSP_synopsis": r"synopsis",
        "IB": r"brochure",
        "ICF": r"consent|consenso|informativo",
        "CRF_patient_form": r"crf|ecrf|module",
        "CSR": r"study report|synopsis|safety",
        "eTMF_index": r"tmf|vault|index",
        "eTMF_site_ops": r"site|deviation",
        "eTMF_monitoring": r"monitor",
        "eTMF_regulatory_correspondence": r"regulatory|approval",
        "DSUR": r"dsur",
        "DSMB_charter": r"charter",
        "DSMB_minutes": r"minutes",
        "SmPC": r"smpc|product characteristics",
        "Ethics_approval": r"ethics|approval",
        "Patient_questionnaire": r"kartlegging|morse|domain.*score",
        "Info_sheet": r"infoark|informasjonsskriv|informational document",
        "Medical_publication": r"abstract|authors|results",
        "Administrative_noise": r"ticket|invoice|lease|job|esg|press release|cv",
    }
    return seeds.get(label, label)


def confidence_from_scores(top_score: float, second_score: float) -> float:
    if top_score <= 0:
        return 0.05
    margin = max(top_score - second_score, 0.0)
    raw = 0.45 + min(top_score / 14.0, 0.35) + min(margin / 8.0, 0.18)
    return round(min(raw, 0.98), 4)


def extract_entities(text: str, structure: dict[str, Any], internal_label: str) -> list[dict[str, Any]]:
    entities: dict[tuple[str, str], dict[str, Any]] = {}

    def add_entity(entity_type: str, canonical_value: str, display_value: str, confidence: float, snippet: str) -> None:
        normalized_value = canonical_value.casefold().strip()
        key = (entity_type, normalized_value)
        row = entities.get(key)
        if row is None:
            row = {
                "id": str(uuid.uuid5(ENTITY_NAMESPACE, f"{entity_type}:{normalized_value}")),
                "entity_type": entity_type,
                "canonical_value": canonical_value,
                "display_value": display_value,
                "normalized_value": normalized_value,
                "metadata": {"source": "milestone_3"},
                "mention_count": 0,
                "confidence": confidence,
                "evidence_spans": [],
            }
            entities[key] = row
        row["mention_count"] += 1
        row["confidence"] = max(row["confidence"], confidence)
        if snippet and len(row["evidence_spans"]) < 5:
            row["evidence_spans"].append({"snippet": snippet[:180], "match": display_value})

    study_spans_seen: set[tuple[int, int]] = set()
    for match in BIORCE_STUDY_RE.finditer(text):
        value = match.group(0).upper()
        if value.startswith("BIORCE-SAE-"):
            continue
        study_spans_seen.add((match.start(), match.end()))
        add_entity("Study", value, value, 0.98, snippet_around(text, match.start(), match.end()))

    for match in BIORCE_STUDY_OCR_RE.finditer(text):
        if any(match.start() >= s and match.end() <= e for s, e in study_spans_seen):
            continue
        raw = match.group(0).upper()
        normalized = re.sub(r"\s+", "", raw).replace("–", "-")
        if not re.fullmatch(r"BIORCE?-[A-Z]{2,5}-\d{4}-\d{3}", normalized):
            continue
        if normalized.startswith("BIORCE-SAE-") or normalized.startswith("BIORC-SAE-"):
            continue
        if not normalized.startswith("BIORCE-"):
            normalized = "BIORCE-" + normalized[len("BIORC-"):]
        add_entity("Study", normalized, raw, 0.88, snippet_around(text, match.start(), match.end()))

    product_spans_seen: set[tuple[int, int]] = set()
    for match in PRODUCT_RE.finditer(text):
        code = match.group(1).upper()
        name = (match.group(2) or "").strip()
        canonical = f"{code} ({name})" if name else code
        product_spans_seen.add((match.start(), match.end()))
        add_entity("Product", canonical, canonical, 0.95, snippet_around(text, match.start(), match.end()))

    for match in PRODUCT_OCR_RE.finditer(text):
        if any(match.start() >= s and match.end() <= e for s, e in product_spans_seen):
            continue
        raw_code = re.sub(r"\s+", "", match.group(1)).upper().replace("–", "-")
        if not re.fullmatch(r"BRC-\d{3}", raw_code):
            continue
        name = (match.group(2) or "").strip()
        canonical = f"{raw_code} ({name})" if name else raw_code
        add_entity("Product", canonical, canonical, 0.85, snippet_around(text, match.start(), match.end()))

    for match in SITE_RE.finditer(text):
        value = match.group(0)
        add_entity("Site", value, value, 0.86, snippet_around(text, match.start(), match.end()))

    for match in PATIENT_RE.finditer(text):
        value = match.group(0)
        add_entity("Patient", value, value, 0.9, snippet_around(text, match.start(), match.end()))

    for match in SAE_RE.finditer(text):
        value = match.group(0).upper()
        add_entity("SafetyEvent", value, value, 0.97, snippet_around(text, match.start(), match.end()))

    for pattern in VERSION_PATTERNS:
        for match in pattern.finditer(text):
            label = match.group(1).strip().title()
            value = match.group(2).strip()
            raw = f"{label} {value}"
            add_entity("Version", raw, raw, 0.82, snippet_around(text, match.start(), match.end()))

    for label, regex in REGULATOR_PATTERNS.items():
        for match in regex.finditer(text):
            add_entity("RegulatoryBody", label, match.group(0), 0.83, snippet_around(text, match.start(), match.end()))

    artifact_display = internal_label.replace("_", " ")
    add_entity("ArtifactType", internal_label, artifact_display, 0.99, artifact_display)

    for match in re.finditer(r"(?mi)^(?:tmf owner|owner|principal investigator|signed by)\s*[:.-]\s*([A-Z][^\n]{2,80})$", text):
        value = match.group(1).strip()
        add_entity("Person", value, value, 0.72, snippet_around(text, match.start(1), match.end(1)))
    for match in re.finditer(r"(?mi)^authors?\s*[:.-]\s*([^\n]{3,200})$", text):
        author_line = match.group(1)
        for candidate in re.split(r",|;", author_line):
            value = candidate.strip()
            if len(value) >= 4:
                add_entity("Person", value, value, 0.6, value)

    return list(entities.values())


def build_product_row(product_code: str, entities: list[dict[str, Any]]) -> dict[str, Any]:
    product_mentions = [entity["display_value"] for entity in entities if entity["entity_type"] == "Product" and entity["display_value"].startswith(product_code)]
    display_value = most_common(product_mentions) or product_code
    product_name = display_value.split("(", 1)[1].rstrip(")") if "(" in display_value else product_code
    return {
        "id": str(uuid.uuid5(PRODUCT_NAMESPACE, product_code.casefold())),
        "product_code": product_code,
        "product_name": product_name.strip(),
    }


def build_study_row(study_code: str, entities: list[dict[str, Any]], product_id: str | None) -> dict[str, Any]:
    phase = None
    for entity in entities:
        if entity["entity_type"] == "Version":
            continue
    study_title = None
    return {
        "id": str(uuid.uuid5(STUDY_NAMESPACE, study_code.casefold())),
        "study_code": study_code,
        "study_title": study_title,
        "phase": phase,
        "product_id": product_id,
    }


def snippet_around(text: str, start: int, end: int, radius: int = 80) -> str:
    left = max(0, start - radius)
    right = min(len(text), end + radius)
    return text[left:right].replace("\n", " ").strip()


def most_common(values: list[str]) -> str | None:
    if not values:
        return None
    return Counter(values).most_common(1)[0][0]


class SupabaseRestClient:
    def __init__(self, base_url: str, service_role_key: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        }

    def fetch_all(self, table: str, *, select: str, filters: dict[str, str] | None = None) -> list[dict[str, Any]]:
        params = {"select": select}
        if filters:
            params.update(filters)
        response = requests.get(f"{self.base_url}/rest/v1/{table}", headers=self.headers, params=params, timeout=120)
        response.raise_for_status()
        return response.json()

    def upsert(self, table: str, rows: list[dict[str, Any]], *, on_conflict: str) -> None:
        for batch in batched(rows, 100):
            headers = {**self.headers, "Prefer": "resolution=merge-duplicates,return=minimal"}
            response = requests.post(
                f"{self.base_url}/rest/v1/{table}",
                headers=headers,
                params={"on_conflict": on_conflict},
                json=batch,
                timeout=120,
            )
            if not response.ok:
                raise RuntimeError(f"Upsert failed for {table}: {response.status_code} {response.text}")

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
            raise RuntimeError(f"Patch failed for {table}/{row_id}: {response.status_code} {response.text}")

    def delete_in_batches(self, table: str, column: str, values: list[str]) -> None:
        for batch in batched(values, 25):
            joined = ",".join(batch)
            response = requests.delete(
                f"{self.base_url}/rest/v1/{table}",
                headers={**self.headers, "Prefer": "return=minimal"},
                params={column: f"in.({joined})"},
                timeout=120,
            )
            if not response.ok:
                raise RuntimeError(f"Delete failed for {table}: {response.status_code} {response.text}")


def batched(values: list[Any], batch_size: int) -> list[list[Any]]:
    return [values[index : index + batch_size] for index in range(0, len(values), batch_size)]


if __name__ == "__main__":
    raise SystemExit(main())
