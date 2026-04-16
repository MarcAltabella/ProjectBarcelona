import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_DOCUMENTS } from "@/lib/toy-data"
import type { DocumentAlert, DocumentClass, DocumentDetail } from "@/lib/types"

function normalizeTopLabels(
  raw: unknown,
  fallback?: DocumentClass | null
): DocumentClass[] {
  if (!Array.isArray(raw)) {
    return fallback ? [fallback] : []
  }

  const labels = raw
    .map((item) => {
      if (typeof item === "string") return item
      if (item && typeof item === "object" && "label" in item) {
        return String(item.label)
      }
      return null
    })
    .filter((item): item is string => Boolean(item))

  if (fallback && !labels.includes(fallback)) {
    labels.unshift(fallback)
  }

  return labels as DocumentClass[]
}

async function fetchPreviewText(
  fileName: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const stem = fileName.replace(/\.[^.]+$/, "")
  const { data, error } = await supabase.storage
    .from("derived-artifacts")
    .download(`extractions/${stem}.json`)

  if (error || !data) {
    return ""
  }

  try {
    const payload = JSON.parse(await data.text()) as {
      normalized_text_preview?: string
      raw_text_preview?: string
    }
    return payload.normalized_text_preview ?? payload.raw_text_preview ?? ""
  } catch {
    return ""
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  if (!isSupabaseConfigured()) {
    const doc = TOY_DOCUMENTS[id]
    if (!doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }
    return NextResponse.json(doc)
  }

  const supabase = createServiceClient()

  const [{ data: view }, { data: entityRows }, { data: alertRows }] =
    await Promise.all([
      supabase
        .from("document_sidebar_v")
        .select("*")
        .eq("document_id", id)
        .maybeSingle(),
      supabase
        .from("document_entities")
        .select(
          "mention_count, confidence, entities(entity_type, display_value, canonical_value)"
        )
        .eq("document_id", id)
        .order("mention_count", { ascending: false })
        .limit(8),
      supabase
        .from("alerts")
        .select("id, alert_type, severity, title, description, evidence_spans")
        .eq("document_id", id)
        .eq("status", "open")
        .order("severity", { ascending: false }),
    ])

  if (view) {
    const previewText = await fetchPreviewText(String(view.file_name), supabase)
    const alerts: DocumentAlert[] = (alertRows ?? []).map((row) => ({
      id: String(row.id),
      alert_type: row.alert_type as DocumentAlert["alert_type"],
      severity: row.severity as DocumentAlert["severity"],
      title: String(row.title),
      description: String(row.description),
      evidence_spans: Array.isArray(row.evidence_spans)
        ? (row.evidence_spans as Record<string, unknown>[])
        : [],
    }))
    const doc: DocumentDetail = {
      id,
      file_name: String(view.file_name),
      final_label: view.final_label as DocumentDetail["final_label"],
      internal_label: view.internal_label as DocumentDetail["internal_label"],
      classification_confidence:
        view.classification_confidence != null
          ? Number(view.classification_confidence)
          : undefined,
      classification_explanation: view.classification_explanation ?? undefined,
      document_status:
        (view.document_status as DocumentDetail["document_status"]) ?? "unknown",
      study_code: view.study_code ?? undefined,
      product_name: view.product_name ?? undefined,
      version_or_edition: view.version_or_edition ?? undefined,
      language: view.language ?? undefined,
      top_entities: (entityRows ?? []).map((row) => {
        const entity = Array.isArray(row.entities) ? row.entities[0] : row.entities
        return {
          type: String(entity?.entity_type ?? "entity"),
          value: String(entity?.display_value ?? entity?.canonical_value ?? ""),
        }
      }),
      alert_count: Number(view.alert_count ?? 0),
      top_2_labels: normalizeTopLabels(
        view.top_2_labels,
        (view.final_label as DocumentClass | null) ?? null
      ),
      preview_text: previewText,
      alerts,
    }

    return NextResponse.json(doc)
  }

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
    id,
    classification_confidence:
      doc.classification_confidence != null
        ? Number(doc.classification_confidence)
        : undefined,
    study_code: null,
    product_name: null,
    top_entities: [],
    alert_count: 0,
    top_2_labels: [],
    preview_text: "",
    alerts: [],
  })
}
