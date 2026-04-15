"use client"

import { useCallback, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useNodesState,
  useEdgesState,
  type NodeTypes,
  type OnNodeClick,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useQuery } from "@tanstack/react-query"
import { fetchGraph } from "@/lib/api"
import { useGraphStore } from "@/lib/store"
import { DocumentNode, type DocumentNodeType } from "./DocumentNode"
import type { RawGraphNode, RawGraphEdge } from "@/lib/types"

// ─── Node types ───────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  document: DocumentNode,
}

// ─── Layout helpers ───────────────────────────────────────────────────────────

/**
 * Simple radial-ish layout: hub nodes (study/product) in the center,
 * documents arranged in a circle around them grouped by class.
 */
function layoutNodes(raw: RawGraphNode[]) {
  const hubs = raw.filter((n) => n.node_type !== "document")
  const docs = raw.filter((n) => n.node_type === "document")

  const hubNodes = hubs.map((n, i) => ({
    id: n.node_id,
    type: "document" as const,
    position: { x: 400 + i * 200, y: 350 },
    data: {
      label: n.label,
      document_class: n.document_class,
      document_status: n.document_status,
      alert_count: n.alert_count ?? 0,
      max_alert_severity: n.max_alert_severity,
      document_id: n.document_id,
    },
  }))

  const count = docs.length || 1
  const radius = Math.max(280, count * 22)
  const cx = 500
  const cy = 350

  const docNodes = docs.map((n, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2
    return {
      id: n.node_id,
      type: "document" as const,
      position: {
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
      },
      data: {
        label: n.label,
        document_class: n.document_class,
        document_status: n.document_status,
        alert_count: n.alert_count ?? 0,
        max_alert_severity: n.max_alert_severity,
        document_id: n.document_id,
      },
    }
  })

  return [...hubNodes, ...docNodes]
}

function layoutEdges(raw: RawGraphEdge[]) {
  return raw.map((e) => ({
    id: e.edge_id,
    source: e.source,
    target: e.target,
    label: e.label ?? undefined,
    animated:
      e.relation_type === "SUPERSEDES" || e.relation_type === "SUPERSEDED_BY",
    style: {
      stroke: "rgba(0,0,0,0.12)",
      strokeWidth: Math.max(1, e.confidence * 2),
    },
    labelStyle: { fontSize: 10, fill: "#86868B" },
    labelBgStyle: { fill: "#FAFAF8", fillOpacity: 0.85 },
  }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphCanvas() {
  const { filters, selectDocument, selectedDocumentId, searchQuery } = useGraphStore()
  const [nodes, setNodes, onNodesChange] = useNodesState<DocumentNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const { data, isLoading, isError } = useQuery({
    queryKey: ["graph", filters.studyId, filters.documentClass],
    queryFn: () =>
      fetchGraph({
        studyId: filters.studyId,
        documentClass: filters.documentClass,
      }),
  })

  useEffect(() => {
    if (!data) return
    setNodes(layoutNodes(data.nodes))
    setEdges(layoutEdges(data.edges))
  }, [data, setNodes, setEdges])

  // Highlight selected node + dim non-matching nodes during search
  const styledNodes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return nodes.map((n) => {
      const matches =
        !q ||
        n.data.label.toLowerCase().includes(q) ||
        (n.data.document_class ?? "").toLowerCase().includes(q)

      return {
        ...n,
        selected: n.data.document_id === selectedDocumentId,
        style: {
          ...n.style,
          opacity: q && !matches ? 0.15 : 1,
          transition: "opacity 0.2s ease",
        },
      }
    })
  }, [nodes, selectedDocumentId, searchQuery])

  // Dim edges connected to faded nodes
  const styledEdges = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return edges

    const matchIds = new Set(
      styledNodes.filter((n) => (n.style?.opacity ?? 1) === 1).map((n) => n.id)
    )
    return edges.map((e) => ({
      ...e,
      style: {
        ...e.style,
        opacity: matchIds.has(e.source) && matchIds.has(e.target) ? 1 : 0.08,
        transition: "opacity 0.2s ease",
      },
    }))
  }, [edges, styledNodes, searchQuery])

  const onNodeClick: OnNodeClick = useCallback(
    (_, node) => {
      const docId = (node.data as DocumentNodeType["data"]).document_id
      selectDocument(docId ?? null)
    },
    [selectDocument]
  )

  return (
    <div className="w-full h-full relative">
      {/* Status messages */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-sm text-[#86868B]">Loading graph…</span>
        </div>
      )}
      {isError && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <span className="text-sm text-[#D98080]">
            Could not load the graph — using toy data.
          </span>
        </div>
      )}

      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => selectDocument(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        minZoom={0.1}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          color="rgba(0,0,0,0.07)"
          gap={28}
          size={1}
        />
        <Controls position="bottom-left" />
      </ReactFlow>
    </div>
  )
}
