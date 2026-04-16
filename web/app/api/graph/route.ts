import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_DOCUMENTS, TOY_GRAPH_EDGES, TOY_GRAPH_NODES } from "@/lib/toy-data"
import type { RawGraphEdge, RawGraphNode } from "@/lib/types"

function uniqueTerms(values: Array<string | null | undefined>) {
  return [...new Set(values.map((value) => value?.trim()).filter(Boolean))]
}

function normalizeNode(row: Record<string, unknown>): RawGraphNode {
  return {
    node_id: String(row.node_id),
    node_type: String(row.node_type).toLowerCase() as RawGraphNode["node_type"],
    label: String(row.label),
    group_key: String(row.group_key ?? ""),
    document_id: row.document_id ? String(row.document_id) : undefined,
    study_id: row.study_id ? String(row.study_id) : undefined,
    document_class: row.document_class as RawGraphNode["document_class"],
    document_status: row.document_status as RawGraphNode["document_status"],
    alert_count: Number(row.alert_count ?? 0),
    max_alert_severity: row.max_alert_severity as RawGraphNode["max_alert_severity"],
  }
}

function normalizeEdge(row: Record<string, unknown>): RawGraphEdge {
  return {
    edge_id: String(row.edge_id),
    source: String(row.source),
    target: String(row.target),
    relation_type: row.relation_type as RawGraphEdge["relation_type"],
    confidence: Number(row.confidence ?? 0),
    label: row.label ? String(row.label) : undefined,
  }
}

function enrichToyNodes(nodes: RawGraphNode[]) {
  return nodes.map((node) => {
    if (!node.document_id) {
      return {
        ...node,
        search_text: uniqueTerms([
          node.label,
          node.group_key,
          node.document_class,
          node.document_status,
        ]).join(" "),
      }
    }

    const doc = TOY_DOCUMENTS[node.document_id]
    const entityTerms = doc?.top_entities?.flatMap((entity) => [
      entity.type,
      entity.value,
    ]) ?? []

    return {
      ...node,
      search_text: uniqueTerms([
        node.label,
        node.group_key,
        node.document_class,
        node.document_status,
        doc?.internal_label,
        doc?.study_code,
        doc?.product_name,
        doc?.version_or_edition,
        doc?.classification_explanation,
        ...entityTerms,
      ]).join(" "),
    }
  })
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const studyId = searchParams.get("studyId")
  const documentClass = searchParams.get("documentClass")

  if (!isSupabaseConfigured()) {
    let nodes = enrichToyNodes(TOY_GRAPH_NODES)
    if (documentClass) {
      nodes = nodes.filter(
        (node) =>
          node.document_class === documentClass || node.node_type !== "document"
      )
    }
    if (studyId) {
      nodes = nodes.filter((node) => node.study_id === studyId || !node.study_id)
    }

    const nodeIds = new Set(nodes.map((node) => node.node_id))
    const edges = TOY_GRAPH_EDGES.filter(
      (edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target)
    )

    return NextResponse.json({ nodes, edges })
  }

  const supabase = createServiceClient()
  let nodeQuery = supabase.from("graph_nodes_v").select("*")

  if (studyId) nodeQuery = nodeQuery.eq("study_id", studyId)
  if (documentClass) nodeQuery = nodeQuery.eq("document_class", documentClass)

  const [{ data: rawNodes }, { data: rawEdges }] = await Promise.all([
    nodeQuery,
    supabase.from("graph_edges_v").select("*"),
  ])

  let nodes = (rawNodes ?? []).map((row) =>
    normalizeNode(row as Record<string, unknown>)
  )

  const documentIds = nodes
    .map((node) => node.document_id)
    .filter((documentId): documentId is string => Boolean(documentId))

  if (documentIds.length > 0) {
    const [{ data: docs }, { data: documentEntities }] = await Promise.all([
      supabase
        .from("documents")
        .select("id, internal_label, classification_explanation, metadata")
        .in("id", documentIds),
      supabase
        .from("document_entities")
        .select(
          "document_id, entities(entity_type, display_value, canonical_value)"
        )
        .in("document_id", documentIds),
    ])

    const docMap = new Map(
      (docs ?? []).map((doc) => [String(doc.id), doc as Record<string, unknown>])
    )

    const entityTermsByDoc = new Map<string, string[]>()
    for (const row of documentEntities ?? []) {
      const documentId = String(row.document_id)
      const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities
      const terms = entityTermsByDoc.get(documentId) ?? []
      if (entity) {
        if (entity.entity_type) terms.push(String(entity.entity_type))
        if (entity.display_value) terms.push(String(entity.display_value))
        if (entity.canonical_value) terms.push(String(entity.canonical_value))
      }
      entityTermsByDoc.set(documentId, terms)
    }

    nodes = nodes.map((node) => {
      if (!node.document_id) {
        return {
          ...node,
          search_text: uniqueTerms([
            node.label,
            node.group_key,
            node.document_class,
            node.document_status,
          ]).join(" "),
        }
      }

      const doc = docMap.get(node.document_id)
      const metadata =
        doc?.metadata && typeof doc.metadata === "object"
          ? (doc.metadata as { structure?: { headings?: string[] } })
          : undefined
      const headings = metadata?.structure?.headings ?? []

      return {
        ...node,
        search_text: uniqueTerms([
          node.label,
          node.group_key,
          node.document_class,
          node.document_status,
          doc?.internal_label ? String(doc.internal_label) : undefined,
          doc?.classification_explanation
            ? String(doc.classification_explanation)
            : undefined,
          ...headings,
          ...(entityTermsByDoc.get(node.document_id) ?? []),
        ]).join(" "),
      }
    })
  }

  const nodeIds = new Set(nodes.map((node) => node.node_id))
  const edges = (rawEdges ?? [])
    .map((row) => normalizeEdge(row as Record<string, unknown>))
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))

  return NextResponse.json({ nodes, edges })
}
