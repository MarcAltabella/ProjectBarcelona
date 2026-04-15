import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const supabase = createServerClient();

  // Get all relations where this document is source or target
  const { data: asSource } = await supabase
    .from("relations")
    .select("id, target_document_id, relation_type, confidence, evidence_type, evidence_spans, source_rule_or_model")
    .eq("source_document_id", id)
    .order("confidence", { ascending: false });

  const { data: asTarget } = await supabase
    .from("relations")
    .select("id, source_document_id, relation_type, confidence, evidence_type, evidence_spans, source_rule_or_model")
    .eq("target_document_id", id)
    .order("confidence", { ascending: false });

  // Collect unique related document IDs
  const relatedMap = new Map<string, { relation_type: string; confidence: number; evidence_type: string | null; direction: string }>();

  for (const r of asSource ?? []) {
    const existing = relatedMap.get(r.target_document_id);
    if (!existing || r.confidence > existing.confidence) {
      relatedMap.set(r.target_document_id, {
        relation_type: r.relation_type,
        confidence: r.confidence,
        evidence_type: r.evidence_type,
        direction: "outgoing",
      });
    }
  }
  for (const r of asTarget ?? []) {
    const existing = relatedMap.get(r.source_document_id);
    if (!existing || r.confidence > existing.confidence) {
      relatedMap.set(r.source_document_id, {
        relation_type: r.relation_type,
        confidence: r.confidence,
        evidence_type: r.evidence_type,
        direction: "incoming",
      });
    }
  }

  // Fetch document details for related docs
  const relatedIds = [...relatedMap.keys()];
  if (relatedIds.length === 0) {
    return NextResponse.json({ related: [] });
  }

  const { data: relatedDocs } = await supabase
    .from("documents")
    .select("id, file_name, final_label, internal_label, classification_confidence, document_status, study_id")
    .in("id", relatedIds);

  // Merge and sort by confidence
  const related = (relatedDocs ?? [])
    .map((doc) => {
      const rel = relatedMap.get(doc.id)!;
      return { ...doc, ...rel };
    })
    .sort((a, b) => b.confidence - a.confidence);

  return NextResponse.json({ related });
}
