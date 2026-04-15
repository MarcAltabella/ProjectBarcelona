"use client"

import { useState, useEffect, useRef } from "react"
import { useGraphStore } from "@/lib/store"
import { GraphCanvas } from "@/components/graph/GraphCanvas"
import { LeftSidebar } from "@/components/sidebar/LeftSidebar"
import { RightSidebar } from "@/components/sidebar/RightSidebar"
import { Legend } from "@/components/sidebar/Legend"
import { TopToolbar } from "@/components/ui/TopToolbar"
import { SearchPill } from "@/components/ui/SearchPill"
import { PromptBar } from "@/components/ui/PromptBar"
import { DocumentViewer } from "@/components/document/DocumentViewer"

const PANEL_STYLE: React.CSSProperties = {
  position: "absolute",
  zIndex: 30,
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(40px)",
  WebkitBackdropFilter: "blur(40px)",
  borderRadius: 16,
  border: "1px solid rgba(0,0,0,0.06)",
  boxShadow:
    "0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)",
  overflow: "auto",
}

const BAR_H = 44      // collapsed bar height
const GAP = 12         // gap between right-side panels
const TOP = 80         // below toolbar
const BOTTOM_PAD = 20  // from viewport bottom

export function AppShell() {
  const selectedDocumentId = useGraphStore((s) => s.selectedDocumentId)
  const documentViewOpen = useGraphStore((s) => s.documentViewOpen)
  const setDocumentViewOpen = useGraphStore((s) => s.setDocumentViewOpen)
  const [searchOpen, setSearchOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSearchOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Scroll to document when view opens, back to graph when closes
  useEffect(() => {
    if (!scrollContainerRef.current) return

    if (documentViewOpen) {
      scrollContainerRef.current.scrollTo({
        top: window.innerHeight,
        behavior: "smooth",
      })
    } else {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: "smooth",
      })
    }
  }, [documentViewOpen])

  // Layout: legend anchored to bottom, alerts always directly above it.
  // Total usable = 100vh - TOP - BOTTOM_PAD.  Legend sits at the bottom,
  // alerts fill from TOP down to the top of legend.
  //
  // Legend height: collapsed BAR_H, or 40% of usable space when open.
  // Alerts height: collapsed BAR_H, or whatever remains above legend.

  const usable = `100vh - ${TOP + BOTTOM_PAD}px`     // total vertical budget

  // 1. Legend: always pinned to bottom
  const legendH = legendOpen ? `calc((${usable}) * 0.4)` : `${BAR_H}px`
  const legendTopVal = `calc(100vh - ${BOTTOM_PAD}px - ${legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`})`

  // 2. Alerts: sits right above legend
  const alertsBottom = `calc(${legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`} + ${GAP + BOTTOM_PAD}px)`
  const alertsH = alertsOpen ? `calc(100vh - ${TOP + GAP}px - ${alertsBottom})` : `${BAR_H}px`
  // When alerts collapsed, pin it just above legend
  const alertsTopVal = alertsOpen
    ? `${TOP}px`
    : `calc(100vh - ${BOTTOM_PAD}px - ${legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`} - ${GAP}px - ${BAR_H}px)`

  const ease = "0.3s cubic-bezier(0.16,1,0.3,1)"

  return (
    <div
      ref={scrollContainerRef}
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "auto",
        scrollBehavior: "smooth",
      }}
    >
      {/* ── Graph section ── */}
      <div
        style={{
          position: "relative",
          width: "100vw",
          height: "100vh",
          overflow: "hidden",
          background: "hsl(50 14% 97%)",
          flexShrink: 0,
        }}
      >
        {/* ── Layer 0: full-screen graph ── */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <GraphCanvas />
        </div>

        {/* ── Layer 1: top toolbar ── */}
        <TopToolbar onOpenSearch={() => setSearchOpen(true)} />

        {/* ── Layer 2: floating left panel (document intelligence) ── */}
        <aside
          style={{
            ...PANEL_STYLE,
            top: TOP,
            left: 16,
            width: 360,
            height: `calc(100vh - ${TOP + BOTTOM_PAD}px)`,
            minWidth: 260,
            maxWidth: 520,
            minHeight: 240,
            resize: "both",
          }}
        >
          <LeftSidebar documentId={selectedDocumentId} />
        </aside>

        {/* ── Layer 2: right panel — alerts (always above legend) ── */}
        <aside
          style={{
            ...PANEL_STYLE,
            top: `calc(${alertsTopVal})`,
            right: 16,
            width: 320,
            height: `calc(${alertsH})`,
            minWidth: 240,
            maxWidth: 480,
            overflow: alertsOpen ? "auto" : "hidden",
            transition: `top ${ease}, height ${ease}`,
          }}
        >
          <RightSidebar
            expanded={alertsOpen}
            onToggle={() => setAlertsOpen((v) => !v)}
          />
        </aside>

        {/* ── Layer 2: right panel — legend (anchored to bottom) ── */}
        <aside
          style={{
            ...PANEL_STYLE,
            top: `calc(${legendTopVal})`,
            right: 16,
            width: 320,
            height: `calc(${legendH})`,
            minWidth: 240,
            maxWidth: 480,
            overflow: legendOpen ? "auto" : "hidden",
            transition: `top ${ease}, height ${ease}`,
          }}
        >
          <Legend
            expanded={legendOpen}
            onToggle={() => setLegendOpen((v) => !v)}
          />
        </aside>

        {/* ── Layer 2: prompt bar ── */}
        <PromptBar />

        {/* ── Layer 3: search overlay ── */}
        {searchOpen && <SearchPill onClose={() => setSearchOpen(false)} />}
      </div>

      {/* ── Document section ── */}
      {selectedDocumentId && (
        <DocumentViewer
          documentId={selectedDocumentId}
          onClose={() => setDocumentViewOpen(false)}
        />
      )}
    </div>
  )
}
