"use client"

import { cn } from "@/lib/utils"
import type { DocumentClass } from "@/lib/types"

const CLASS_COLORS: Record<string, string> = {
  CSP: "#3B82F6",
  IB: "#8B5CF6",
  ICF: "#22C55E",
  CRF: "#F59E0B",
  CSR: "#F97316",
  eTMF: "#06B6D4",
  Regulatory: "#EF4444",
  Synopsis: "#0EA5E9",
  Patient_Questionnaire: "#84CC16",
  Info_Sheet: "#14B8A6",
  Medical_Publication: "#A855F7",
  NOISE: "#9CA3AF",
}

export function ClassBadge({
  label,
  size = "md",
}: {
  label?: DocumentClass | string
  size?: "sm" | "md"
}) {
  if (!label) return null
  const color = CLASS_COLORS[label] ?? "#9CA3AF"
  const dotSize = size === "sm" ? "w-1 h-1" : "w-1.5 h-1.5"
  const textCls =
    size === "sm"
      ? "text-[11px] text-[#86868B]"
      : "text-xs text-[#86868B]"

  return (
    <span className={cn("inline-flex items-center gap-1.5", textCls)}>
      <span
        className={cn(dotSize, "rounded-full flex-shrink-0")}
        style={{ backgroundColor: color }}
      />
      {label.replace(/_/g, " ")}
    </span>
  )
}

/** Just the dot, no text. */
export function ClassDot({
  label,
  size = 6,
}: {
  label?: string
  size?: number
}) {
  const color = CLASS_COLORS[label ?? ""] ?? "#9CA3AF"
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{ width: size, height: size, backgroundColor: color }}
    />
  )
}
