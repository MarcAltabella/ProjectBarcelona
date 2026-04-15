"use client"

import { X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useGraphStore } from "@/lib/store"

export function PromptBar() {
  const { searchQuery, setSearchQuery } = useGraphStore()

  return (
    <div
      className={cn(
        "fixed bottom-5 left-1/2 -translate-x-1/2 z-40",
        "w-full max-w-xl mx-auto px-4"
      )}
    >
      <div
        className={cn(
          "flex items-center gap-2 px-4 h-12 rounded-full glass",
          "shadow-toolbar border border-black/[.04]",
          "transition-shadow duration-200",
          "focus-within:shadow-[0_8px_40px_rgba(0,0,0,0.12),0_2px_8px_rgba(0,0,0,0.06)]"
        )}
      >
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter nodes — type to search…"
          className={cn(
            "flex-1 bg-transparent text-[13px] text-ink",
            "placeholder:text-[#86868B] outline-none"
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery("")}
            className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center bg-black/[.04] text-[#86868B] hover:bg-black/[.08] transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}
