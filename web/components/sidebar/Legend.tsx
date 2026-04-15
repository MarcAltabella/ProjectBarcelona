"use client"

import { ChevronDown, ChevronUp } from "lucide-react"
import { cn } from "@/lib/utils"

const LEGEND_ITEMS: { label: string; color: string; description: string }[] = [
  { label: "CSP", color: "#3B82F6", description: "Clinical Study Protocol" },
  { label: "IB", color: "#8B5CF6", description: "Investigator's Brochure" },
  { label: "ICF", color: "#22C55E", description: "Informed Consent Form" },
  { label: "CRF", color: "#F59E0B", description: "Case Report Form" },
  { label: "CSR", color: "#F97316", description: "Clinical Study Report" },
  { label: "eTMF", color: "#06B6D4", description: "Electronic Trial Master File" },
  { label: "Regulatory", color: "#EF4444", description: "Regulatory correspondence" },
  { label: "Synopsis", color: "#0EA5E9", description: "Protocol synopsis" },
  { label: "Questionnaire", color: "#84CC16", description: "Patient questionnaire" },
  { label: "Info Sheet", color: "#14B8A6", description: "Summary of product characteristics" },
  { label: "Publication", color: "#A855F7", description: "Medical publication" },
  { label: "Noise", color: "#9CA3AF", description: "Administrative / out-of-scope" },
]

const EDGE_ITEMS: { label: string; style: string }[] = [
  { label: "Strong link", style: "border-t-2 border-black/20 w-6" },
  { label: "Weak link", style: "border-t border-black/10 w-6" },
  { label: "Supersedes", style: "border-t-2 border-dashed border-black/20 w-6" },
]

export function Legend({
  expanded,
  onToggle,
}: {
  expanded: boolean
  onToggle: () => void
}) {
  return (
    <div className="h-full flex flex-col">
      {/* ── Header bar (always visible) ── */}
      <button
        onClick={onToggle}
        className={cn(
          "flex items-center justify-between w-full px-4",
          "text-left shrink-0",
          expanded ? "py-3" : "py-2.5"
        )}
      >
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-ink">Legend</p>
          {/* Mini color dots preview when collapsed */}
          {!expanded && (
            <div className="flex items-center gap-1 ml-1">
              {LEGEND_ITEMS.slice(0, 7).map((item) => (
                <span
                  key={item.label}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: item.color }}
                />
              ))}
              <span className="text-[10px] text-[#86868B]">…</span>
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
        <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4 text-[12px] animate-fade-in">
          {/* Document classes */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
              Document classes
            </p>
            <div className="space-y-0.5">
              {LEGEND_ITEMS.map((item) => (
                <div key={item.label} className="flex gap-2 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 mt-[3px]"
                    style={{ backgroundColor: item.color }}
                  />
                  <div className="min-w-0">
                    <span className="text-ink font-medium">{item.label}</span>
                    <span className="text-[#86868B]"> — {item.description}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Edge types */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
              Relationships
            </p>
            <div className="space-y-1">
              {EDGE_ITEMS.map((item) => (
                <div key={item.label} className="flex items-center gap-2">
                  <span className={item.style} />
                  <span className="text-[#86868B]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Alert severity */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold text-[#86868B] uppercase tracking-wider">
              Alert severity
            </p>
            <div className="space-y-1">
              {[
                { color: "#D98080", label: "Error" },
                { color: "#D9A766", label: "Warning" },
                { color: "#7EBC8E", label: "Info" },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-[#86868B]">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
