"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDocument } from "@/lib/api"
import { useGraphStore } from "@/lib/store"

export function TransparencyLayer({
  onClose,
}: {
  onClose: () => void
}) {
  const transparencyDocumentId = useGraphStore((s) => s.transparencyDocumentId)
  const [displayedText, setDisplayedText] = useState("")

  const { data: doc } = useQuery({
    queryKey: ["document", transparencyDocumentId],
    queryFn: () => fetchDocument(transparencyDocumentId!),
    enabled: !!transparencyDocumentId,
  })

  const explanation = doc?.classification_explanation ?? ""
  const isActive = !!transparencyDocumentId

  // Typewriter effect
  useEffect(() => {
    if (!transparencyDocumentId || !explanation) {
      setDisplayedText("")
      return
    }

    setDisplayedText("")
    let index = 0
    const interval = setInterval(() => {
      if (index <= explanation.length) {
        setDisplayedText(explanation.slice(0, index))
        index++
      } else {
        clearInterval(interval)
      }
    }, 15) // Adjust speed here

    return () => clearInterval(interval)
  }, [transparencyDocumentId, explanation])

  return (
    <div className="flex flex-col h-full">
      {/* Header with title and close button */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#7EBC8E]/15 shrink-0 min-h-[44px]">
        <p className="text-sm font-semibold text-[#5A9E6A]">Transparency</p>
        {isActive && (
          <button
            onClick={onClose}
            className="flex items-center justify-center w-6 h-6 rounded-full hover:bg-[#7EBC8E]/10 transition-colors"
            title="Close"
          >
            <X className="w-4 h-4 text-[#5A9E6A]" />
          </button>
        )}
      </div>

      {/* Content - grows as text appears (only show when active) */}
      {isActive && (
        <div className="px-4 py-4 overflow-y-auto flex-1 space-y-3">
          {doc?.final_label && (
            <p className="text-[12px] font-medium text-[#5A9E6A]">
              Why is this {doc.final_label}?
            </p>
          )}
          <p className="text-[13px] leading-6 text-[#4A6F56] whitespace-pre-wrap">
            {displayedText}
            {displayedText.length < explanation.length && (
              <span className="animate-pulse">▌</span>
            )}
          </p>
        </div>
      )}
    </div>
  )
}
