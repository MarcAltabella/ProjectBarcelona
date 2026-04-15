import type {
  GraphPayload,
  DocumentDetail,
  RelatedDocument,
  Alert,
} from "./types"

// ─── Graph ────────────────────────────────────────────────────────────────────

export async function fetchGraph(filters?: {
  studyId?: string | null
  documentClass?: string | null
}): Promise<GraphPayload> {
  const params = new URLSearchParams()
  if (filters?.studyId) params.set("studyId", filters.studyId)
  if (filters?.documentClass) params.set("documentClass", filters.documentClass)

  const res = await fetch(`/api/graph?${params}`)
  if (!res.ok) throw new Error("Failed to fetch graph")
  return res.json()
}

// ─── Document ─────────────────────────────────────────────────────────────────

export async function fetchDocument(id: string): Promise<DocumentDetail> {
  const res = await fetch(`/api/documents/${id}`)
  if (!res.ok) throw new Error("Failed to fetch document")
  return res.json()
}

export async function fetchRelatedDocuments(
  id: string
): Promise<RelatedDocument[]> {
  const res = await fetch(`/api/documents/${id}/related`)
  if (!res.ok) throw new Error("Failed to fetch related documents")
  return res.json()
}

// ─── Alerts ───────────────────────────────────────────────────────────────────

export async function fetchAlerts(filters?: {
  severity?: string | null
  studyId?: string | null
  documentClass?: string | null
  alertType?: string | null
}): Promise<Alert[]> {
  const params = new URLSearchParams()
  if (filters?.severity) params.set("severity", filters.severity)
  if (filters?.studyId) params.set("studyId", filters.studyId)
  if (filters?.documentClass) params.set("documentClass", filters.documentClass)
  if (filters?.alertType) params.set("alertType", filters.alertType)

  const res = await fetch(`/api/alerts?${params}`)
  if (!res.ok) throw new Error("Failed to fetch alerts")
  return res.json()
}
