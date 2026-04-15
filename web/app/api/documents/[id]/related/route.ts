import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_RELATED } from "@/lib/toy-data"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── Toy data path ──────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    return NextResponse.json(TOY_RELATED[id] ?? [])
  }

  // ── Supabase path ──────────────────────────────────────────────────
  const supabase = createServiceClient()

  const { data: relations } = await supabase
    .from("relations")
    .select("id, target_document_id, relation_type, confidence, source_rule_or_model")
    .eq("source_document_id", id)
    .order("confidence", { ascending: false })
    .limit(10)

  if (!relations || relations.length === 0) {
    return NextResponse.json([])
  }

  const targetIds = relations.map((r) => r.target_document_id)
  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name, final_label, classification_confidence")
    .in("id", targetIds)

  const docMap = new Map((docs ?? []).map((d) => [d.id, d]))

  const result = relations.map((r) => ({
    relation_id: r.id,
    relation_type: r.relation_type,
    confidence: r.confidence,
    source_rule_or_model: r.source_rule_or_model,
    document: docMap.get(r.target_document_id) ?? null,
  }))

  return NextResponse.json(result)
}
