import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Main document sidebar data
  const { data: doc, error: docError } = await supabase
    .from("document_sidebar_v")
    .select("*")
    .eq("document_id", id)
    .single();

  if (docError) {
    const status = docError.code === "PGRST116" ? 404 : 500;
    return NextResponse.json({ error: docError.message }, { status });
  }

  // Entities for this document
  const { data: entities } = await supabase
    .from("document_entities")
    .select("mention_count, confidence, evidence_spans, entities(id, entity_type, canonical_value, display_value)")
    .eq("document_id", id)
    .order("confidence", { ascending: false });

  // Alerts for this document
  const { data: alerts } = await supabase
    .from("alerts")
    .select("id, alert_type, severity, title, description, status")
    .eq("document_id", id)
    .eq("status", "open");

  // Family info
  let family = null;
  if (doc.family_id) {
    const { data: fam } = await supabase
      .from("document_families")
      .select("id, family_type, canonical_name")
      .eq("id", doc.family_id)
      .single();
    family = fam;
  }

  return NextResponse.json({
    ...doc,
    entities: (entities ?? []).map((e) => ({
      ...e.entities,
      mention_count: e.mention_count,
      confidence: e.confidence,
      evidence_spans: e.evidence_spans,
    })),
    alerts: alerts ?? [],
    family,
  });
}
