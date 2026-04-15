"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Search, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { TOY_SEARCH_INDEX } from "@/lib/toy-data"
import { useGraphStore } from "@/lib/store"
import { ClassDot } from "./ClassBadge"

interface SearchResult {
  id: string
  label: string
  sublabel?: string
  category: string
}

export function SearchPill({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("")
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const selectDocument = useGraphStore((s) => s.selectDocument)

  const results: SearchResult[] =
    query.length === 0
      ? TOY_SEARCH_INDEX
      : TOY_SEARCH_INDEX.filter(
          (r) =>
            r.label.toLowerCase().includes(query.toLowerCase()) ||
            r.category.toLowerCase().includes(query.toLowerCase()) ||
            (r.sublabel ?? "").toLowerCase().includes(query.toLowerCase())
        )

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  const pick = useCallback(
    (r: SearchResult) => {
      selectDocument(r.id)
      onClose()
    },
    [selectDocument, onClose]
  )

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, results.length - 1))
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
      } else if (e.key === "Enter" && results[activeIdx]) {
        pick(results[activeIdx])
      }
    },
    [results, activeIdx, onClose, pick]
  )

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/15 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Pill container */}
      <div className="relative w-full max-w-lg mx-4 animate-fade-in">
        {/* Input */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#86868B]" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search documents…"
            className={cn(
              "w-full h-12 pl-11 pr-10 rounded-2xl",
              "bg-white/95 backdrop-blur-2xl",
              "border border-black/[.06] shadow-toolbar",
              "text-sm text-ink placeholder:text-[#86868B]",
              "outline-none focus:ring-2 focus:ring-black/[.08]"
            )}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-black/[.04]"
            >
              <X className="w-3.5 h-3.5 text-[#86868B]" />
            </button>
          )}
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="mt-2 max-h-[52vh] overflow-y-auto bg-white rounded-2xl border border-black/[.06] shadow-toolbar">
            {results.map((r, i) => (
              <button
                key={r.id}
                onClick={() => pick(r)}
                onMouseEnter={() => setActiveIdx(i)}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-2.5 text-left",
                  "transition-colors duration-75",
                  i === activeIdx ? "bg-black/[.04]" : "hover:bg-black/[.02]",
                  i !== 0 && "border-t border-black/[.04]"
                )}
              >
                <ClassDot label={r.category} size={8} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink truncate">{r.label}</p>
                  {r.sublabel && (
                    <p className="text-[11px] text-[#86868B] truncate">
                      {r.sublabel}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-[#86868B] flex-shrink-0 font-medium">
                  {r.category.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        )}

        {query && results.length === 0 && (
          <div className="mt-2 p-6 text-center bg-white rounded-2xl border border-black/[.06] shadow-toolbar">
            <p className="text-sm text-[#86868B]">No documents match "{query}"</p>
          </div>
        )}
      </div>
    </div>
  )
}
