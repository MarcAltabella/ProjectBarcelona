"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, ChevronUp } from "lucide-react"
import { fetchAlerts } from "@/lib/api"
import { useGraphStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/Card"
import { ClassBadge } from "@/components/ui/ClassBadge"
import type { AlertSeverity, AlertType } from "@/lib/types"

// ─── Constants ────────────────────────────────────────────────────────────────

const SEVERITY_STYLES: Record<AlertSeverity, { border: string; bg: string; dot: string; text: string }> = {
  error: {
    border: "border-[#D98080]/30",
    bg: "bg-[#D98080]/[.06]",
    dot: "bg-[#D98080]",
    text: "text-[#B06060]",
  },
  warning: {
    border: "border-[#D9A766]/30",
    bg: "bg-[#D9A766]/[.06]",
    dot: "bg-[#D9A766]",
    text: "text-[#A07830]",
  },
  info: {
    border: "border-[#7EBC8E]/30",
    bg: "bg-[#7EBC8E]/[.06]",
    dot: "bg-[#7EBC8E]",
    text: "text-[#5A9E6A]",
  },
}

const ALERT_LABELS: Partial<Record<AlertType, string>> = {
  LOW_CONFIDENCE_CLASSIFICATION: "Low confidence",
  AMBIGUOUS_CLASSIFICATION: "Ambiguous label",
  SUPERSEDED_DOCUMENT: "Superseded",
  DUPLICATE_DOCUMENT: "Duplicate",
  NEAR_DUPLICATE_DOCUMENT: "Near-duplicate",
  CONTRADICTION: "Contradiction",
  MISSING_EXPECTED_LINK: "Missing link",
  SUSPICIOUS_NOISE: "Suspicious noise",
  ISOLATED_DOCUMENT: "Isolated",
}

const SEVERITIES: AlertSeverity[] = ["error", "warning", "info"]

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({
  label,
  active,
  count,
  onClick,
}: {
  label: string
  active: boolean
  count?: number
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors",
        active
          ? "border-ink bg-ink text-white"
          : "border-black/[.06] text-[#86868B] hover:bg-black/[.04]"
      )}
    >
      {label}
      {count != null && count > 0 && (
        <span className={cn("ml-1", active ? "text-white/70" : "text-[#86868B]/60")}>
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RightSidebar({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  const { filters, setFilter, selectDocument, selectedDocumentId } = useGraphStore()
  const severity = filters.alertSeverity as AlertSeverity | null

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: [
      "alerts",
      severity,
      filters.studyId,
      filters.documentClass,
      filters.alertType,
    ],
    queryFn: () =>
      fetchAlerts({
        severity,
        studyId: filters.studyId,
        documentClass: filters.documentClass,
        alertType: filters.alertType,
      }),
  })

  const sorted = useMemo(() => {
    if (!selectedDocumentId) return alerts
    const forDoc = alerts.filter((a) => a.document_id === selectedDocumentId)
    const rest = alerts.filter((a) => a.document_id !== selectedDocumentId)
    return [...forDoc, ...rest]
  }, [alerts, selectedDocumentId])

  const docAlertCount = selectedDocumentId
    ? alerts.filter((a) => a.document_id === selectedDocumentId).length
    : 0

  const counts = { error: 0, warning: 0, info: 0 }
  alerts.forEach((a) => {
    if (a.severity in counts) counts[a.severity as AlertSeverity]++
  })

  return (
    <div className="h-full flex flex-col">
      {/* ── Header bar (always visible) ── */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-4 shrink-0 text-left",
          expanded ? "py-3" : "py-2.5"
        )}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Alerts</p>
          <span className="text-[11px] text-[#86868B]">
            {alerts.length}
          </span>
          {/* Mini severity dots when collapsed */}
          {!expanded && (
            <div className="flex items-center gap-1 ml-1">
              {counts.error > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D98080]" />
                  <span className="text-[10px] text-[#86868B]">{counts.error}</span>
                </span>
              )}
              {counts.warning > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#D9A766]" />
                  <span className="text-[10px] text-[#86868B]">{counts.warning}</span>
                </span>
              )}
              {counts.info > 0 && (
                <span className="flex items-center gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#7EBC8E]" />
                  <span className="text-[10px] text-[#86868B]">{counts.info}</span>
                </span>
              )}
            </div>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-[#86868B]" />
        ) : (
          <ChevronUp className="w-4 h-4 text-[#86868B]" />
        )}
      </button>

      {/* ── Expanded content ── */}
      {expanded && (
        <div className="flex-1 overflow-hidden flex flex-col gap-3 px-4 pb-4 animate-fade-in">
          {/* Severity filter pills */}
          <div className="flex flex-wrap gap-1.5 shrink-0">
            <FilterPill
              label="All"
              active={severity === null}
              count={alerts.length}
              onClick={() => setFilter("alertSeverity", null)}
            />
            {SEVERITIES.map((s) => (
              <FilterPill
                key={s}
                label={s.charAt(0).toUpperCase() + s.slice(1)}
                active={severity === s}
                count={counts[s]}
                onClick={() =>
                  setFilter("alertSeverity", severity === s ? null : s)
                }
              />
            ))}
          </div>

          {selectedDocumentId && docAlertCount > 0 && (
            <p className="text-[11px] text-[#86868B] shrink-0">
              <span className="text-ink font-medium">{docAlertCount}</span> for selected document
            </p>
          )}

          {/* Alert list */}
          <div className="flex-1 overflow-y-auto space-y-2.5 -mx-1 px-1">
            {isLoading && (
              <p className="text-[11px] text-[#86868B] py-4 text-center">
                Loading…
              </p>
            )}
            {!isLoading && sorted.length === 0 && (
              <div className="py-8 text-center">
                <p className="text-[12px] text-[#86868B]">
                  {severity ? `No ${severity} alerts.` : "No open alerts."}
                </p>
              </div>
            )}
            {sorted.map((alert) => {
              const s = SEVERITY_STYLES[alert.severity]
              const isForSelected = selectedDocumentId === alert.document_id
              return (
                <Card
                  key={alert.id}
                  hover
                  className={cn(
                    "!p-3.5 !rounded-xl cursor-pointer",
                    s.border,
                    s.bg,
                    isForSelected && "!ring-2 !ring-ink/15"
                  )}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => selectDocument(alert.document_id)}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn("w-1.5 h-1.5 rounded-full flex-shrink-0", s.dot)}
                      />
                      <span className={cn("text-[10px] font-medium", s.text)}>
                        {ALERT_LABELS[alert.alert_type] ?? alert.alert_type}
                      </span>
                      {isForSelected && (
                        <span className="text-[9px] font-semibold text-ink/50 uppercase ml-auto">
                          Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] font-semibold text-ink mt-1 leading-snug">
                      {alert.title}
                    </p>
                    <p className="text-[11px] text-[#86868B] mt-1 leading-relaxed line-clamp-3">
                      {alert.description}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {alert.final_label && (
                        <ClassBadge label={alert.final_label} size="sm" />
                      )}
                      {alert.file_name && (
                        <span className="text-[10px] text-[#86868B] truncate">
                          {alert.file_name}
                        </span>
                      )}
                    </div>
                  </button>
                </Card>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
