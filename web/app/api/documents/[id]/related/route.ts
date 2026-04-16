import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_RELATED } from "@/lib/toy-data"
import type { DocumentClass, RelatedDocument } from "@/lib/types"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    return NextResponse.json(TOY_RELATED[id] ?? [])
  }

  const supabase = createServiceClient()

  const { data: relations } = await supabase
    .from("relations")
    .select(
      "id, source_document_id, target_document_id, relation_type, confidence, source_rule_or_model, evidence_spans"
    )
    .or(`source_document_id.eq.${id},target_document_id.eq.${id}`)
    .order("confidence", { ascending: false })
    .limit(12)

  if (!relations?.length) {
    return NextResponse.json([])
  }

  const relatedIds = relations.map((row) =>
    row.source_document_id === id ? row.target_document_id : row.source_document_id
  )

  const { data: docs } = await supabase
    .from("documents")
    .select("id, file_name, final_label, classification_confidence")
    .in("id", relatedIds)

  const docMap = new Map((docs ?? []).map((doc) => [doc.id, doc]))

  const result: RelatedDocument[] = relations.map((row) => {
    const relatedId =
      row.source_document_id === id ? row.target_document_id : row.source_document_id
    const relatedDoc = docMap.get(relatedId)

    return {
      relation_id: String(row.id),
      relation_type: row.relation_type as RelatedDocument["relation_type"],
      confidence: Number(row.confidence ?? 0),
      source_rule_or_model: String(row.source_rule_or_model ?? "unknown"),
      evidence_spans: Array.isArray(row.evidence_spans)
        ? (row.evidence_spans as Array<Record<string, unknown>>)
        : undefined,
      document: relatedDoc
        ? {
            id: String(relatedDoc.id),
            file_name: String(relatedDoc.file_name),
            final_label: relatedDoc.final_label as DocumentClass | undefined,
            classification_confidence:
              relatedDoc.classification_confidence != null
                ? Number(relatedDoc.classification_confidence)
                : undefined,
          }
        : null,
    }
  })

  return NextResponse.json(result)
}
