"use client"

import { useEffect, useState, useRef } from "react"
import { useGraphStore } from "@/lib/store"
import { GraphCanvas } from "@/components/graph/GraphCanvas"
import { DocumentViewer } from "@/components/document/DocumentViewer"
import { LeftSidebar } from "@/components/sidebar/LeftSidebar"
import { RightSidebar } from "@/components/sidebar/RightSidebar"
import { PromptBar } from "@/components/ui/PromptBar"
import { SearchPill } from "@/components/ui/SearchPill"
import { TopToolbar } from "@/components/ui/TopToolbar"
import { TransparencyLayer } from "@/components/sidebar/TransparencyLayer"
import { Blob } from "@/components/ui/Blob"

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

const BAR_H = 44
const GAP = 12
const TOP = 80
const BOTTOM_PAD = 20
const GRAPH_SAFE_TOP = 96
const GRAPH_SAFE_BOTTOM = 110
const GRAPH_SAFE_SIDE = 28

export function AppShell() {
  const selectedDocumentId = useGraphStore((state) => state.selectedDocumentId)
  const documentViewOpen = useGraphStore((state) => state.documentViewOpen)
  const setDocumentViewOpen = useGraphStore((state) => state.setDocumentViewOpen)
  const transparencyDocumentId = useGraphStore((state) => state.transparencyDocumentId)
  const transparencyOpen = useGraphStore((state) => state.transparencyOpen)
  const setTransparencyOpen = useGraphStore((state) => state.setTransparencyOpen)
  const setTransparencyDocument = useGraphStore((state) => state.setTransparencyDocument)
  const [searchOpen, setSearchOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [transparencyHeight, setTransparencyHeight] = useState(BAR_H)
  const transparencyRef = useRef<HTMLElement>(null)

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault()
        setSearchOpen((value) => !value)
      }
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  // Track transparency panel height changes with ResizeObserver
  useEffect(() => {
    const panel = transparencyRef.current
    if (!panel) return

    const resizeObserver = new ResizeObserver(() => {
      setTransparencyHeight(panel.offsetHeight)
    })

    resizeObserver.observe(panel)
    return () => resizeObserver.disconnect()
  }, [])

  // Transparency layer is always visible at TOP, positioned on right
  // When collapsed: just the header (BAR_H)
  // When expanded: grows dynamically with content
  const transparencyIsExpanded = !!transparencyDocumentId
  const transparencyMaxHeight = `calc(100vh - ${TOP + GAP * 2 + BAR_H + BOTTOM_PAD}px)` // Max space available (accounting for alerts bar below)

  // Alerts bar is positioned directly below the transparency layer
  // Uses dynamic transparency height to avoid overlap as it grows
  const alertsTopVal = `${TOP + transparencyHeight + GAP}px`

  const alertsH = alertsOpen
    ? `calc(100vh - ${TOP}px - ${transparencyHeight}px - ${GAP}px - ${BOTTOM_PAD}px)` // Fill remaining space after transparency
    : `${BAR_H}px` // Min height when closed

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {documentViewOpen && selectedDocumentId ? (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            background:
              "radial-gradient(circle at top, rgba(255,255,255,0.92), rgba(242,239,230,0.92))",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <DocumentViewer
            documentId={selectedDocumentId}
            onClose={() => setDocumentViewOpen(false)}
          />
        </div>
      ) : (
        <div
          style={{
            position: "relative",
            width: "100vw",
            height: "100vh",
            overflow: "hidden",
            background: "hsl(50 14% 97%)",
          }}
        >
          <div
            style={{
              position: "absolute",
              top: GRAPH_SAFE_TOP,
              right: GRAPH_SAFE_SIDE,
              bottom: GRAPH_SAFE_BOTTOM,
              left: GRAPH_SAFE_SIDE,
              zIndex: 0,
            }}
          >
            <GraphCanvas />
          </div>

          <TopToolbar onOpenSearch={() => setSearchOpen(true)} />

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

          <aside
            style={{
              ...PANEL_STYLE,
              top: alertsTopVal,
              right: 16,
              width: 320,
              height: alertsH,
              minWidth: 240,
              maxWidth: 480,
              overflow: alertsOpen ? "auto" : "hidden",
              transition:
                "top 0.3s cubic-bezier(0.16,1,0.3,1), height 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <RightSidebar
              expanded={alertsOpen}
              onToggle={() => setAlertsOpen((value) => !value)}
            />
          </aside>

          {/* Blob Mascot Animation - Above transparency bar */}
          <div
            style={{
              position: "absolute",
              top: `${TOP - 28}px`,
              right: 20,
              zIndex: 31,
            }}
          >
            <Blob size={40} color="#5A9E6A" />
          </div>

          {/* Transparency Layer Panel - Always visible */}
          <aside
            ref={transparencyRef}
            style={{
              ...PANEL_STYLE,
              top: TOP,
              right: 16,
              width: 320,
              maxWidth: 480,
              minWidth: 240,
              maxHeight: transparencyMaxHeight,
              minHeight: `${BAR_H}px`,
              overflow: "auto",
              background: "rgba(240, 249, 244, 0.92)",
              borderColor: "rgba(126, 188, 142, 0.15)",
              transition: "max-height 0.3s cubic-bezier(0.16,1,0.3,1), min-height 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <TransparencyLayer
              onClose={() => {
                setTransparencyDocument(null)
              }}
            />
          </aside>

          <PromptBar />
          {searchOpen && <SearchPill onClose={() => setSearchOpen(false)} />}
        </div>
      )}
    </div>
  )
}
