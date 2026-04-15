import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const params = request.nextUrl.searchParams;

  const study = params.get("study");
  const documentClass = params.get("class");
  const minConfidence = params.get("min_confidence");

  // Fetch nodes
  let nodesQuery = supabase.from("graph_nodes_v").select("*");
  if (study) nodesQuery = nodesQuery.eq("group_key", study);
  if (documentClass) nodesQuery = nodesQuery.eq("document_class", documentClass);

  const { data: nodes, error: nodesError } = await nodesQuery;
  if (nodesError) {
    return NextResponse.json({ error: nodesError.message }, { status: 500 });
  }

  // Fetch edges — only those connecting returned nodes
  const nodeIds = new Set((nodes ?? []).map((n) => n.node_id));

  let edgesQuery = supabase.from("graph_edges_v").select("*");
  if (minConfidence) {
    edgesQuery = edgesQuery.gte("confidence", parseFloat(minConfidence));
  }

  const { data: allEdges, error: edgesError } = await edgesQuery;
  if (edgesError) {
    return NextResponse.json({ error: edgesError.message }, { status: 500 });
  }

  // Filter edges to only include those between returned nodes
  const edges = (allEdges ?? []).filter(
    (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
  );

  return NextResponse.json({ nodes: nodes ?? [], edges });
}
