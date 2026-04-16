"use client"

import { useEffect, useState } from "react"
import { useGraphStore } from "@/lib/store"
import { GraphCanvas } from "@/components/graph/GraphCanvas"
import { DocumentViewer } from "@/components/document/DocumentViewer"
import { LeftSidebar } from "@/components/sidebar/LeftSidebar"
import { Legend } from "@/components/sidebar/Legend"
import { RightSidebar } from "@/components/sidebar/RightSidebar"
import { PromptBar } from "@/components/ui/PromptBar"
import { SearchPill } from "@/components/ui/SearchPill"
import { TopToolbar } from "@/components/ui/TopToolbar"

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
  const [searchOpen, setSearchOpen] = useState(false)
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [legendOpen, setLegendOpen] = useState(false)

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

  const usable = `100vh - ${TOP + BOTTOM_PAD}px`
  const legendH = legendOpen ? `calc((${usable}) * 0.4)` : `${BAR_H}px`
  const legendTopVal = `calc(100vh - ${BOTTOM_PAD}px - ${
    legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`
  })`
  const alertsBottom = `calc(${
    legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`
  } + ${GAP + BOTTOM_PAD}px)`
  const alertsH = alertsOpen
    ? `calc(100vh - ${TOP + GAP}px - ${alertsBottom})`
    : `${BAR_H}px`
  const alertsTopVal = alertsOpen
    ? `${TOP}px`
    : `calc(100vh - ${BOTTOM_PAD}px - ${
        legendOpen ? `(${usable}) * 0.4` : `${BAR_H}px`
      } - ${GAP}px - ${BAR_H}px)`

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
              top: `calc(${alertsTopVal})`,
              right: 16,
              width: 320,
              height: `calc(${alertsH})`,
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
              transition:
                "top 0.3s cubic-bezier(0.16,1,0.3,1), height 0.3s cubic-bezier(0.16,1,0.3,1)",
            }}
          >
            <Legend
              expanded={legendOpen}
              onToggle={() => setLegendOpen((value) => !value)}
            />
          </aside>

          <PromptBar />
          {searchOpen && <SearchPill onClose={() => setSearchOpen(false)} />}
        </div>
      )}
    </div>
  )
}
