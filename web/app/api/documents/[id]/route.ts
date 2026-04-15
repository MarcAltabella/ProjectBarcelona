import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_DOCUMENTS } from "@/lib/toy-data"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── Toy data path ──────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    const doc = TOY_DOCUMENTS[id]
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    return NextResponse.json(doc)
  }

  // ── Supabase path ──────────────────────────────────────────────────
  const supabase = createServiceClient()

  const { data: view } = await supabase
    .from("document_sidebar_v")
    .select("*")
    .eq("id", id)
    .maybeSingle()

  if (view) return NextResponse.json(view)

  const { data: doc, error } = await supabase
    .from("documents")
    .select(
      "id, file_name, final_label, classification_confidence, classification_explanation, document_status, version_or_edition, language"
    )
    .eq("id", id)
    .maybeSingle()

  if (error || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  return NextResponse.json({
    ...doc,
    study_code: null,
    product_name: null,
    top_entities: [],
    alert_count: 0,
    top_2_labels: [],
  })
}
