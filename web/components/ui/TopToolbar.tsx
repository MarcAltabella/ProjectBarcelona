"use client"

import { Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGraphStore } from "@/lib/store"
import type { DocumentClass } from "@/lib/types"

const CLASS_COLORS: Record<string, string> = {
  CSP: "#3B82F6",
  IB: "#8B5CF6",
  ICF: "#22C55E",
  CRF: "#F59E0B",
  CSR: "#F97316",
  eTMF: "#06B6D4",
  Regulatory: "#EF4444",
  NOISE: "#9CA3AF",
}

const TABS: { label: string; value: string | null }[] = [
  { label: "All", value: null },
  { label: "CSP", value: "CSP" },
  { label: "IB", value: "IB" },
  { label: "ICF", value: "ICF" },
  { label: "CRF", value: "CRF" },
  { label: "CSR", value: "CSR" },
  { label: "eTMF", value: "eTMF" },
  { label: "Regulatory", value: "Regulatory" },
  { label: "Noise", value: "NOISE" },
]

export function TopToolbar({ onOpenSearch }: { onOpenSearch: () => void }) {
  const { filters, setFilter } = useGraphStore()
  const active = filters.documentClass

  return (
    <div
      className={cn(
        "fixed top-5 left-1/2 -translate-x-1/2 z-40",
        "inline-flex items-center gap-1 p-1.5",
        "rounded-full glass",
        "shadow-toolbar border border-black/[.04]"
      )}
    >
      {/* Brand */}
      <span className="px-3 text-[11px] font-bold tracking-widest text-ink/50 uppercase select-none hidden lg:block">
        Biorce
      </span>

      {/* Divider */}
      <span className="hidden lg:block w-px h-5 bg-black/[.08]" />

      {/* Tabs */}
      {TABS.map((tab) => {
        const isActive = active === tab.value
        const color = tab.value ? CLASS_COLORS[tab.value] ?? "#1D1D1F" : "#1D1D1F"

        return (
          <button
            key={tab.label}
            onClick={() =>
              setFilter(
                "documentClass",
                isActive ? null : (tab.value as DocumentClass | null)
              )
            }
            className={cn(
              "relative px-3 h-8 rounded-full text-[12px] font-medium",
              "transition-all duration-200",
              !isActive && "text-[#86868B] hover:bg-black/[.04]"
            )}
            style={
              isActive
                ? {
                    backgroundColor: color + "18",
                    color: color,
                  }
                : undefined
            }
          >
            {tab.label}
          </button>
        )
      })}

      {/* Divider */}
      <span className="w-px h-5 bg-black/[.08]" />

      {/* Search button */}
      <button
        onClick={onOpenSearch}
        className={cn(
          "flex items-center gap-1.5 px-3 h-8 rounded-full",
          "text-[12px] text-[#86868B] hover:bg-black/[.04] transition-colors"
        )}
      >
        <Search className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">Search</span>
      </button>
    </div>
  )
}
