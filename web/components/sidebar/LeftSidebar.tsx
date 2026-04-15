"use client"

import { Eye } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDocument, fetchRelatedDocuments } from "@/lib/api"
import { cn } from "@/lib/utils"
import { useGraphStore } from "@/lib/store"
import { Card } from "@/components/ui/Card"
import { ClassBadge } from "@/components/ui/ClassBadge"
import type { DocumentClass } from "@/lib/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

  // ── Populated state ────────────────────────────────────────────────────
  const { setDocumentViewOpen } = useGraphStore()

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
      </div>

      {/* Confidence */}
      {doc.classification_confidence != null && (
        <Card className="!p-3.5 !rounded-xl">
          <Section title="Classification confidence">
            <ConfidenceBar value={doc.classification_confidence} />
          </Section>
        </Card>
      )}

      {/* Why this label */}
      {doc.classification_explanation && (
        <Card className="!p-3.5 !rounded-xl">
          <Section title="Why this label">
            <p className="text-[13px] text-[#86868B] leading-[1.65]">
              {doc.classification_explanation}
            </p>
          </Section>
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
              {doc.top_entities.map((e, i) => (
                <Row key={i} label={e.type} value={e.value} />
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
                    {r.relation_type.replace(/_/g, " ").toLowerCase()}
                  </span>
                  <span className="text-[10px] text-[#86868B]">
                    · {Math.round(r.confidence * 100)}%
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
