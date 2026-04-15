"use client"

import { memo } from "react"
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react"
import { cn } from "@/lib/utils"
import type { DocumentClass, DocumentStatus, AlertSeverity } from "@/lib/types"

// ─── Node data shape ──────────────────────────────────────────────────────────

export type DocumentNodeData = {
  label: string
  document_class?: DocumentClass
  document_status?: DocumentStatus
  alert_count: number
  max_alert_severity?: AlertSeverity
  document_id?: string
  confidence?: number
}

export type DocumentNodeType = Node<DocumentNodeData, "document">

// ─── Colour map ───────────────────────────────────────────────────────────────

const CLASS_COLOR: Record<string, string> = {
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

const SEVERITY_BADGE: Record<string, string> = {
  error: "bg-[#D98080]",
  warning: "bg-[#D9A766]",
  info: "bg-[#7EBC8E]",
}

// ─── Component ────────────────────────────────────────────────────────────────

function DocumentNodeInner({ data, selected }: NodeProps<DocumentNodeType>) {
  const color = CLASS_COLOR[data.document_class ?? ""] ?? "#9CA3AF"
  const superseded = data.document_status === "superseded"
  const hasAlert = data.alert_count > 0

  return (
    <div
      className={cn(
        "relative px-3.5 py-2.5 rounded-xl",
        "border shadow-card",
        "min-w-[140px] max-w-[180px] cursor-pointer select-none",
        "transition-all duration-200",
        !selected && "bg-white border-black/[.06]",
        !selected && "hover:border-black/[.10] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06)]",
        selected && "shadow-[0_2px_8px_rgba(0,0,0,0.10)]",
        superseded && !selected && "opacity-50"
      )}
      style={selected ? {
        backgroundColor: color + "18",
        borderColor: color + "40",
      } : undefined}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!w-2 !h-2 !bg-[#C9CBD1] !border-0"
      />

      {/* Class dot + label */}
      <div className="flex items-start gap-2">
        <span
          className="w-2 h-2 rounded-full flex-shrink-0 mt-1"
          style={{ backgroundColor: color }}
        />
        <span
          className="text-[12px] font-medium leading-snug line-clamp-2"
          style={{ color: "#1D1D1F" }}
        >
          {data.label}
        </span>
      </div>

      {/* Sub-label */}
      {data.document_class && (
        <p
          className="text-[10px] mt-0.5 ml-4 truncate"
          style={{ color: selected ? "#1D1D1F" : "#86868B" }}
        >
          {data.document_class.replace(/_/g, " ")}
        </p>
      )}

      {/* Alert badge */}
      {hasAlert && (
        <span
          className={cn(
            "absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1",
            "rounded-full text-[9px] font-bold text-white flex items-center justify-center",
            SEVERITY_BADGE[data.max_alert_severity ?? "info"]
          )}
        >
          {data.alert_count}
        </span>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        className="!w-2 !h-2 !bg-[#C9CBD1] !border-0"
      />
    </div>
  )
}

export const DocumentNode = memo(DocumentNodeInner)
