import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_GRAPH_NODES, TOY_GRAPH_EDGES } from "@/lib/toy-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const studyId = searchParams.get("studyId")
  const documentClass = searchParams.get("documentClass")

  // ── Toy data path ──────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    let nodes = TOY_GRAPH_NODES
    if (documentClass) {
      nodes = nodes.filter(
        (n) => n.document_class === documentClass || n.node_type !== "document"
      )
    }
    if (studyId) {
      nodes = nodes.filter((n) => n.study_id === studyId || !n.study_id)
    }

    const nodeIds = new Set(nodes.map((n) => n.node_id))
    const edges = TOY_GRAPH_EDGES.filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    )

    return NextResponse.json({ nodes, edges })
  }

  // ── Supabase path ──────────────────────────────────────────────────
  const supabase = createServiceClient()

  let nodeQuery = supabase.from("graph_nodes_v").select("*")
  if (studyId) nodeQuery = nodeQuery.eq("study_id", studyId)
  if (documentClass) nodeQuery = nodeQuery.eq("document_class", documentClass)

  const [{ data: nodes }, { data: edges }] = await Promise.all([
    nodeQuery,
    supabase.from("graph_edges_v").select("*"),
  ])

  return NextResponse.json({
    nodes: nodes ?? [],
    edges: edges ?? [],
  })
}
