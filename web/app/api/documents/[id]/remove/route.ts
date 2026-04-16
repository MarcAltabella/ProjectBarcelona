import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase not configured for remove action" },
      { status: 501 }
    )
  }

  const supabase = createServiceClient()
  const { data: doc, error: fetchError } = await supabase
    .from("documents")
    .select("id, final_label, is_deleted")
    .eq("id", id)
    .maybeSingle()

  if (fetchError || !doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  if (doc.final_label !== "NOISE") {
    return NextResponse.json(
      { error: "Only NOISE documents can be removed" },
      { status: 400 }
    )
  }

  if (doc.is_deleted === true) {
    return NextResponse.json({ ok: true })
  }

  const { error: updateError } = await supabase
    .from("documents")
    .update({ is_deleted: true })
    .eq("id", id)

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to mark document as removed" },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true })
}
