"use client"

import { useEffect, useMemo, type ReactNode } from "react"
import { AlertCircle, ArrowUp, TriangleAlert } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDocument } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/Card"
import { ClassBadge } from "@/components/ui/ClassBadge"
import type { DocumentAlert } from "@/lib/types"

const SEVERITY_RANK = {
  info: 1,
  warning: 2,
  error: 3,
} as const

const ALERT_STYLES = {
  error: {
    badge: "border-[#D98080]/40 bg-[#D98080]/12 text-[#B45C5C]",
    panel: "border-[#D98080]/25 bg-[#FFF1F1]",
    paragraph: "border-l-[#D98080] bg-[#FFF6F6]",
    mark: "bg-[#D98080]/28 text-[#7E2E2E]",
  },
  warning: {
    badge: "border-[#D9A766]/40 bg-[#D9A766]/12 text-[#9E7431]",
    panel: "border-[#D9A766]/25 bg-[#FFF8EE]",
    paragraph: "border-l-[#D9A766] bg-[#FFF9F1]",
    mark: "bg-[#F1D7A0] text-[#7A581B]",
  },
  info: {
    badge: "border-[#7EBC8E]/40 bg-[#7EBC8E]/12 text-[#4E865B]",
    panel: "border-[#7EBC8E]/25 bg-[#F4FBF5]",
    paragraph: "border-l-[#7EBC8E] bg-[#F8FCF8]",
    mark: "bg-[#CFE8D4] text-[#2D5D36]",
  },
} as const

function formatEntityType(type: string): string {
  return type
    .replace(/([A-Z])/g, " $1")
    .trim()
    .replace(/^\w/, (c) => c.toUpperCase())
}

type HighlightMatch = {
  start: number
  end: number
  severity: keyof typeof ALERT_STYLES
  alertId: string
}

function collectEvidenceTerms(alert: DocumentAlert, previewText: string) {
  const candidates = new Set<string>()

  function addCandidate(value: unknown) {
    if (typeof value === "string") {
      const trimmed = value.trim()
      if (trimmed.length >= 3 && trimmed.length <= 120) {
        candidates.add(trimmed)
      }
      return
    }

    if (typeof value === "number") {
      candidates.add(String(value))
      return
    }

    if (Array.isArray(value)) {
      value.forEach(addCandidate)
      return
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(addCandidate)
    }
  }

  alert.evidence_spans?.forEach(addCandidate)

  const source = `${alert.title}. ${alert.description}`
  const regexes = [
    /\bVersion\s+\d+(?:\.\d+)?\b/gi,
    /\b\d{1,2}\s+[A-Z][a-z]+\s+\d{4}\b/g,
    /\b[A-Z]{2,}(?:-[A-Z0-9]+){1,}\b/g,
    /"([^"]{3,80})"/g,
    /\b(?:re-consent form|full icf|draft|not for clinical use|confidential)\b/gi,
  ]

  for (const regex of regexes) {
    for (const match of source.matchAll(regex)) {
      candidates.add((match[1] ?? match[0]).trim())
    }
  }

  source
    .split(/[.;:()]/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length >= 6 &&
        part.length <= 90 &&
        (/\d/.test(part) || /[A-Z]{2,}/.test(part) || /-/.test(part))
    )
    .forEach((part) => candidates.add(part))

  const previewLower = previewText.toLowerCase()
  return [...candidates]
    .filter((candidate) => previewLower.includes(candidate.toLowerCase()))
    .sort((left, right) => right.length - left.length)
}

function getHighlightMatches(paragraph: string, alerts: DocumentAlert[]) {
  const lowerParagraph = paragraph.toLowerCase()
  const matches: HighlightMatch[] = []

  for (const alert of alerts) {
    const terms = collectEvidenceTerms(alert, paragraph)
    for (const term of terms) {
      const loweredTerm = term.toLowerCase()
      let cursor = 0
      while (cursor < lowerParagraph.length) {
        const start = lowerParagraph.indexOf(loweredTerm, cursor)
        if (start === -1) break

        matches.push({
          start,
          end: start + term.length,
          severity: alert.severity,
          alertId: alert.id,
        })
        cursor = start + term.length
      }
    }
  }

  matches.sort((left, right) => {
    if (left.start !== right.start) return left.start - right.start
    const severityDiff =
      SEVERITY_RANK[right.severity] - SEVERITY_RANK[left.severity]
    if (severityDiff !== 0) return severityDiff
    return right.end - left.end - (left.end - left.start)
  })

  const resolved: HighlightMatch[] = []
  for (const match of matches) {
    const overlaps = resolved.some(
      (existing) => match.start < existing.end && match.end > existing.start
    )
    if (!overlaps) {
      resolved.push(match)
    }
  }

  return resolved
}

function renderHighlightedParagraph(paragraph: string, alerts: DocumentAlert[]) {
  const matches = getHighlightMatches(paragraph, alerts)
  if (!matches.length) {
    return {
      severity: null,
      content: (
        <p className="whitespace-pre-wrap text-[14px] leading-7 text-[#4F4F4F]">
          {paragraph}
        </p>
      ),
    }
  }

  let cursor = 0
  const segments: ReactNode[] = []
  let highestSeverity: keyof typeof ALERT_STYLES = "info"

  for (const match of matches) {
    if (cursor < match.start) {
      segments.push(paragraph.slice(cursor, match.start))
    }

    if (SEVERITY_RANK[match.severity] > SEVERITY_RANK[highestSeverity]) {
      highestSeverity = match.severity
    }

    segments.push(
      <mark
        key={`${match.alertId}-${match.start}-${match.end}`}
        className={cn(
          "rounded px-1 py-0.5 font-medium",
          ALERT_STYLES[match.severity].mark
        )}
      >
        {paragraph.slice(match.start, match.end)}
      </mark>
    )
    cursor = match.end
  }

  if (cursor < paragraph.length) {
    segments.push(paragraph.slice(cursor))
  }

  return {
    severity: highestSeverity,
    content: (
      <p className="whitespace-pre-wrap text-[14px] leading-7 text-[#4F4F4F]">
        {segments}
      </p>
    ),
  }
}

function SeverityBadge({ severity }: { severity: keyof typeof ALERT_STYLES }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em]",
        ALERT_STYLES[severity].badge
      )}
    >
      {severity}
    </span>
  )
}

export function DocumentViewer({
  documentId,
  onClose,
}: {
  documentId: string | null
  onClose: () => void
}) {
  const { data: doc } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose()
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onClose])

  const importantAlerts = useMemo(
    () =>
      (doc?.alerts ?? []).filter(
        (alert) => alert.severity === "warning" || alert.severity === "error"
      ),
    [doc?.alerts]
  )

  const paragraphs = useMemo(
    () =>
      (doc?.preview_text ?? "")
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
    [doc?.preview_text]
  )

  const allAlerts = doc?.alerts ?? []

  if (!documentId || !doc) return null

  return (
    <div className="w-full max-w-6xl h-[calc(100vh-48px)] rounded-[28px] border border-black/[.06] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.12)] overflow-hidden">
      <div className="sticky top-0 z-20 border-b border-black/[.06] bg-white/95 backdrop-blur-sm">
        <div className="flex items-center justify-between px-8 py-5">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#86868B]">
              Document Reader
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-ink">{doc.file_name}</h1>
          </div>
          <button
            onClick={onClose}
            className={cn(
              "flex items-center gap-2 rounded-full px-4 py-2.5",
              "text-[13px] font-medium text-[#86868B]",
              "bg-black/[.04] hover:bg-black/[.08] transition-colors"
            )}
          >
            <ArrowUp className="h-4 w-4" />
            Back to graph
          </button>
        </div>
      </div>

      <div className="grid h-[calc(100%-92px)] grid-cols-[minmax(0,1fr)_320px]">
        <div className="overflow-y-auto px-8 py-8">
          <div className="mb-8 flex flex-wrap items-center gap-3">
            <ClassBadge label={doc.final_label} />
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
                doc.document_status === "current"
                  ? "border-[#7EBC8E]/40 bg-[#7EBC8E]/10 text-[#5A9E6A]"
                  : doc.document_status === "superseded"
                    ? "border-[#D9A766]/40 bg-[#D9A766]/10 text-[#B08840]"
                    : "border-black/[.08] bg-black/[.03] text-[#86868B]"
              )}
            >
              {doc.document_status}
            </span>
            {doc.classification_confidence != null && (
              <span className="text-[12px] text-[#86868B]">
                Confidence {Math.round(doc.classification_confidence * 100)}%
              </span>
            )}
          </div>

          {(doc.study_code || doc.product_name || doc.version_or_edition) && (
            <div className="mb-10 grid grid-cols-2 gap-4 text-[13px]">
              {doc.study_code && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#86868B]">
                    Study
                  </p>
                  <p className="text-ink">{doc.study_code}</p>
                </div>
              )}
              {doc.product_name && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#86868B]">
                    Product
                  </p>
                  <p className="text-ink">{doc.product_name}</p>
                </div>
              )}
              {doc.version_or_edition && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#86868B]">
                    Version
                  </p>
                  <p className="text-ink">{doc.version_or_edition}</p>
                </div>
              )}
              {doc.language && (
                <div>
                  <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-[#86868B]">
                    Language
                  </p>
                  <p className="text-ink">{doc.language}</p>
                </div>
              )}
            </div>
          )}

          {importantAlerts.length > 0 && (
            <div className="mb-10">
              <h2 className="mb-4 text-lg font-semibold text-ink">
                Highlighted Findings
              </h2>
              <div className="space-y-3">
                {importantAlerts.map((alert) => (
                  <Card
                    key={alert.id}
                    className={cn(
                      "!rounded-2xl !border !p-4",
                      ALERT_STYLES[alert.severity].panel
                    )}
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <SeverityBadge severity={alert.severity} />
                      <p className="text-[14px] font-semibold text-ink">{alert.title}</p>
                    </div>
                    <p className="text-[13px] leading-6 text-[#5A5A5A]">
                      {alert.description}
                    </p>
                  </Card>
                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="mb-4 text-lg font-semibold text-ink">Document Text</h2>
            {paragraphs.length > 0 ? (
              <div className="rounded-2xl border border-black/[.06] bg-black/[.015] px-6 py-6">
                <div className="space-y-4 text-[14px] leading-7 text-[#4F4F4F]">
                  {paragraphs.map((paragraph, index) => {
                    const rendered = renderHighlightedParagraph(paragraph, importantAlerts)
                    return (
                      <div key={`${index}-${paragraph.slice(0, 32)}`}>
                        {rendered.content}
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              <Card className="!rounded-2xl !p-6">
                <p className="text-[14px] leading-relaxed text-[#86868B]">
                  No extracted text is available for this document yet.
                </p>
              </Card>
            )}
          </div>
        </div>

        <aside className="overflow-y-auto border-l border-black/[.06] bg-[#FCFCFA] px-6 py-8">
          <div className="mb-8">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#86868B]">
              Alert Summary
            </p>
            <div className="space-y-3">
              {allAlerts.length > 0 ? (
                allAlerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={cn(
                      "rounded-2xl border px-4 py-3",
                      ALERT_STYLES[alert.severity].panel
                    )}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      {alert.severity === "error" ? (
                        <AlertCircle className="h-4 w-4 text-[#D98080]" />
                      ) : (
                        <TriangleAlert className="h-4 w-4 text-[#D9A766]" />
                      )}
                      <SeverityBadge severity={alert.severity} />
                    </div>
                    <p className="text-[13px] font-semibold text-ink">{alert.title}</p>
                    <p className="mt-2 text-[12px] leading-5 text-[#666666]">
                      {alert.description}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-[13px] leading-6 text-[#86868B]">
                  No active alerts for this document.
                </p>
              )}
            </div>
          </div>

          {doc.classification_explanation && (
            <div className="mb-8">
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#86868B]">
                Classification Rationale
              </p>
              <p className="text-[13px] leading-6 text-[#555555]">
                {doc.classification_explanation}
              </p>
            </div>
          )}

          {doc.top_entities && doc.top_entities.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-[#86868B]">
                Key Entities
              </p>
              <div className="space-y-2">
                {Object.entries(
                  doc.top_entities.reduce(
                    (acc, entity) => {
                      if (!acc[entity.type]) acc[entity.type] = []
                      acc[entity.type].push(entity.value)
                      return acc
                    },
                    {} as Record<string, string[]>
                  )
                ).map(([type, values]) => (
                  <Card key={type} className="!rounded-2xl !p-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#86868B]">
                      {formatEntityType(type)}
                    </p>
                    <p className="mt-1 text-[13px] text-ink">{values.join(", ")}</p>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}
