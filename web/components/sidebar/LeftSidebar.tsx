"use client"

import { Eye, Trash2 } from "lucide-react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { fetchDocument, fetchRelatedDocuments, removeNoiseDocument } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useGraphStore } from "@/lib/store"
import { Card } from "@/components/ui/Card"
import { ClassBadge } from "@/components/ui/ClassBadge"
import { Blob } from "@/components/ui/Blob"
import type { RelatedDocument } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatEntityType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

function relationTypeLabel(relationType: string): string {
  return relationType.replace(/_/g, " ").toLowerCase()
}

function formatEvidenceValue(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }
  return null
}

function formatRelationReason(related: RelatedDocument): string {
  const spans = related.evidence_spans
  if (!spans || spans.length === 0) {
    return relationTypeLabel(related.relation_type)
  }

  const details: string[] = []

  for (const span of spans) {
    if (!span || typeof span !== "object") continue
    const record = span as Record<string, unknown>

    const type = formatEvidenceValue(record.type)
    const entity = formatEvidenceValue(record.entity)
    const value = formatEvidenceValue(record.value)
    const field = formatEvidenceValue(record.field)

    if (type && entity) {
      details.push(`${type}: ${entity}`)
      continue
    }
    if (type && value) {
      details.push(`${type}: ${value}`)
      continue
    }
    if (field && value) {
      details.push(`${field}: ${value}`)
      continue
    }

    const fallbackValue = entity ?? value ?? type ?? field
    if (fallbackValue) details.push(fallbackValue)
  }

  if (details.length === 0) {
    return relationTypeLabel(related.relation_type)
  }

  return details.slice(0, 2).join(" · ")
}

function ConfidenceBar({ value }: { value?: number }) {
  if (value == null) return null
  const pct = Math.round(value * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-black/[.04] rounded-full overflow-hidden">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-500",
            pct >= 80
              ? "bg-[#7EBC8E]"
              : pct >= 50
              ? "bg-[#D9A766]"
              : "bg-[#D98080]"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[11px] text-[#86868B] tabular-nums w-8 text-right">
        {pct}%
      </span>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider mb-1.5">
        {title}
      </p>
      {children}
    </div>
  )
}

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        "inline-block text-[10px] font-medium px-2 py-0.5 rounded-full border",
        status === "current"
          ? "border-[#7EBC8E]/40 text-[#5A9E6A] bg-[#7EBC8E]/10"
          : status === "superseded"
          ? "border-[#D9A766]/40 text-[#B08840] bg-[#D9A766]/10"
          : "border-black/[.06] text-[#86868B]"
      )}
    >
      {status}
    </span>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LeftSidebar({ documentId }: { documentId: string | null }) {
  const queryClient = useQueryClient()
  const {
    setDocumentViewOpen,
    setTransparencyDocument,
    setTransparencyOpen,
    selectDocument,
  } = useGraphStore()

  const { data: doc, isLoading: docLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
  })

  const { data: related = [], isLoading: relLoading } = useQuery({
    queryKey: ["related", documentId],
    queryFn: () => fetchRelatedDocuments(documentId!),
    enabled: !!documentId,
  })

  const removeMutation = useMutation({
    mutationFn: (id: string) => removeNoiseDocument(id),
    onSuccess: async () => {
      selectDocument(null)
      setDocumentViewOpen(false)
      setTransparencyDocument(null)
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["graph"] }),
        queryClient.invalidateQueries({ queryKey: ["document"] }),
        queryClient.invalidateQueries({ queryKey: ["related"] }),
      ])
    },
  })

  // ── Empty state ────────────────────────────────────────────────────────
  if (!documentId) {
    return (
      <div className="p-5 h-full flex flex-col">
        <p className="text-sm font-semibold text-ink">Document Intelligence</p>
        <p className="text-[13px] text-[#86868B] mt-2 leading-relaxed">
          Click any node in the graph to inspect a document, or press{" "}
          <kbd className="inline-block px-1.5 py-0.5 text-[10px] font-medium bg-black/[.04] rounded border border-black/[.06]">
            Ctrl K
          </kbd>{" "}
          to search.
        </p>
      </div>
    )
  }

  if (docLoading) {
    return <div className="p-5 text-[13px] text-[#86868B]">Loading…</div>
  }

  if (!doc) {
    return (
      <div className="p-5 text-[13px] text-[#D98080]">
        Document not found.
      </div>
    )
  }

  return (
    <div className="p-5 space-y-4 text-sm">
      {/* File name + badges + view button */}
      <div>
        <p className="font-semibold text-ink text-[14px] leading-snug break-words">
          {doc.file_name}
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-2 mb-3">
          <ClassBadge label={doc.final_label} />
          <StatusPill status={doc.document_status} />
        </div>
        <button
          onClick={() => setDocumentViewOpen(true)}
          className={cn(
            "w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg",
            "text-[12px] font-medium text-white",
            "bg-ink hover:bg-ink/90 transition-colors"
          )}
        >
          <Eye className="w-4 h-4" />
          View Document
        </button>
        {doc.final_label === "NOISE" && doc.is_deleted !== true && (
          <button
            onClick={() => removeMutation.mutate(doc.id)}
            disabled={removeMutation.isPending}
            className={cn(
              "mt-2 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg",
              "text-[12px] font-medium",
              "border border-[#D98080]/30 text-[#B45C5C] bg-[#FFF1F1]",
              "hover:bg-[#FFE8E8] transition-colors disabled:opacity-50"
            )}
            title="Mark noise file as removed"
          >
            <Trash2 className="w-4 h-4" />
            {removeMutation.isPending ? "Removing..." : "Remove Noise File"}
          </button>
        )}
      </div>

      {/* Confidence with transparency button */}
      {doc.classification_confidence != null && (
        <Card className="!p-3.5 !rounded-xl">
          <div className="flex items-center justify-between gap-2">
            <div className="flex-1">
              <Section title="Classification confidence">
                <ConfidenceBar value={doc.classification_confidence} />
              </Section>
            </div>
            {doc.classification_explanation && (
              <button
                onClick={() => {
                  setTransparencyDocument(documentId)
                  setTransparencyOpen(true)
                }}
                className="flex-shrink-0 hover:opacity-80 transition-opacity"
                title="View explanation"
              >
                <Blob
                  size={24}
                  color="#5A9E6A"
                  circularity={0.01}
                  wobbleAmount={8}
                  wobbleSpeed={6}
                  bobSpeed={2.2}
                />
              </button>
            )}
          </div>
        </Card>
      )}

      {/* Ambiguous alternatives */}
      {doc.top_2_labels && doc.top_2_labels.length > 1 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[10px] text-[#86868B] mr-1">Also considered:</span>
          {doc.top_2_labels
            .filter((l) => l !== doc.final_label)
            .map((l) => (
              <ClassBadge key={l} label={l} size="sm" />
            ))}
        </div>
      )}

      {/* Context */}
      {(doc.study_code || doc.product_name || doc.version_or_edition) && (
        <Card className="!p-3.5 !rounded-xl">
          <Section title="Context">
            <div className="space-y-1">
              {doc.study_code && (
                <Row label="Study" value={doc.study_code} />
              )}
              {doc.product_name && (
                <Row label="Product" value={doc.product_name} />
              )}
              {doc.version_or_edition && (
                <Row label="Version" value={doc.version_or_edition} />
              )}
              {doc.language && (
                <Row label="Language" value={doc.language} />
              )}
            </div>
          </Section>
        </Card>
      )}

      {/* Entities */}
      {doc.top_entities && doc.top_entities.length > 0 && (
        <Card className="!p-3.5 !rounded-xl">
          <Section title="Key entities">
            <div className="space-y-1">
              {Object.entries(
                doc.top_entities.reduce(
                  (acc, e) => {
                    if (!acc[e.type]) acc[e.type] = []
                    acc[e.type].push(e.value)
                    return acc
                  },
                  {} as Record<string, string[]>
                )
              ).map(([type, values]) => (
                <Row key={type} label={formatEntityType(type)} value={values.join(", ")} />
              ))}
            </div>
          </Section>
        </Card>
      )}

      {/* Related documents */}
      <Section title={`Related documents (${related.length})`}>
        {relLoading && (
          <p className="text-[11px] text-[#86868B]">Loading…</p>
        )}
        {!relLoading && related.length === 0 && (
          <p className="text-[11px] text-[#86868B]">None found yet.</p>
        )}
        <div className="space-y-2">
          {related.map((r) =>
            r.document ? (
              <Card
                key={r.relation_id}
                hover
                className="!p-3 !rounded-xl cursor-pointer"
              >
                <p className="text-[12px] font-medium text-ink truncate">
                  {r.document.file_name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <ClassBadge label={r.document.final_label} size="sm" />
                  <span className="text-[10px] text-[#86868B]">
                    {formatRelationReason(r)}
                  </span>
                </div>
              </Card>
            ) : null
          )}
        </div>
      </Section>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[12px]">
      <span className="text-[#86868B] w-20 flex-shrink-0">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  )
}
