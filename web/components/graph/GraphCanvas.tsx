"use client"

import { useCallback, useDeferredValue, useEffect, useMemo } from "react"
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Edge,
  type NodeTypes,
  type NodeMouseHandler,
  useReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useQuery } from "@tanstack/react-query"
import { fetchGraph } from "@/lib/api"
import { filterGraphBySearchTerms, parseSearchTerms } from "@/lib/searchTerms"
import { useGraphStore } from "@/lib/store"
import { DocumentNode, type DocumentNodeType } from "./DocumentNode"
import type { RawGraphNode, RawGraphEdge } from "@/lib/types"

// ─── Node types ───────────────────────────────────────────────────────────────

const nodeTypes: NodeTypes = {
  document: DocumentNode,
}

const EDGE_COLOR = {
  positive: "#7EBC8E",
  contextual: "#5DA8C7",
  progression: "#6F7FD1",
  warning: "#D9A766",
  danger: "#D98080",
  neutral: "rgba(29,29,31,0.22)",
} as const

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
    style: {
      transition: "transform 280ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease",
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
      style: {
        transition: "transform 280ms cubic-bezier(0.16,1,0.3,1), opacity 180ms ease",
      },
    }
  })

  return [...hubNodes, ...docNodes]
}

function getEdgeVisuals(relationType: RawGraphEdge["relation_type"], confidence: number) {
  const width = Math.max(1.5, confidence * 3)

  if (relationType === "DUPLICATE_OF" || relationType === "NEAR_DUPLICATE_OF") {
    return {
      stroke: EDGE_COLOR.warning,
      strokeWidth: width,
      animated: false,
      strokeDasharray: relationType === "NEAR_DUPLICATE_OF" ? "6 5" : undefined,
    }
  }

  if (relationType === "CONTRADICTS" || relationType === "HAS_ALERT") {
    return {
      stroke: EDGE_COLOR.danger,
      strokeWidth: width,
      animated: relationType === "CONTRADICTS",
      strokeDasharray: "5 4",
    }
  }

  if (
    relationType === "SUPERSEDES" ||
    relationType === "SUPERSEDED_BY" ||
    relationType === "IMPLEMENTS_AMENDMENT"
  ) {
    return {
      stroke: EDGE_COLOR.progression,
      strokeWidth: width,
      animated: true,
      strokeDasharray: undefined,
    }
  }

  if (
    relationType === "BELONGS_TO_STUDY" ||
    relationType === "ABOUT_PRODUCT" ||
    relationType === "IN_FAMILY" ||
    relationType === "HAS_DOCUMENT_TYPE"
  ) {
    return {
      stroke: EDGE_COLOR.positive,
      strokeWidth: width,
      animated: false,
      strokeDasharray: undefined,
    }
  }

  if (
    relationType === "REFERS_TO" ||
    relationType === "RELATED_TO" ||
    relationType === "MENTIONS_SITE" ||
    relationType === "MENTIONS_PATIENT" ||
    relationType === "MENTIONS_SAFETY_EVENT" ||
    relationType === "ISSUED_BY" ||
    relationType === "SENT_TO" ||
    relationType === "APPROVES"
  ) {
    return {
      stroke: EDGE_COLOR.contextual,
      strokeWidth: width,
      animated: false,
      strokeDasharray: undefined,
    }
  }

  return {
    stroke: EDGE_COLOR.neutral,
    strokeWidth: width,
    animated: false,
    strokeDasharray: undefined,
  }
}

function layoutEdges(raw: RawGraphEdge[]) {
  return raw.map((e) => {
    const visuals = getEdgeVisuals(e.relation_type, e.confidence)

    return {
      id: e.edge_id,
      source: e.source,
      target: e.target,
      label: e.label ?? undefined,
      animated: visuals.animated,
      style: {
        stroke: visuals.stroke,
        strokeWidth: visuals.strokeWidth,
        strokeDasharray: visuals.strokeDasharray,
        transition: "stroke 180ms ease, opacity 180ms ease",
      },
      labelStyle: { fontSize: 10, fill: "#86868B" },
      labelBgStyle: { fill: "#FAFAF8", fillOpacity: 0.85 },
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GraphCanvas() {
  const { filters, selectDocument, selectedDocumentId, searchQuery } = useGraphStore()
  const deferredSearchQuery = useDeferredValue(searchQuery)
  const [nodes, setNodes, onNodesChange] = useNodesState<DocumentNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([])
  const { fitView } = useReactFlow()

  const { data, isLoading, isError } = useQuery({
    queryKey: ["graph", filters.studyId, filters.documentClass],
    queryFn: () =>
      fetchGraph({
        studyId: filters.studyId,
        documentClass: filters.documentClass,
      }),
  })

  const filteredGraph = useMemo(() => {
    if (!data) return { nodes: [] as RawGraphNode[], edges: [] as RawGraphEdge[] }

    const terms = parseSearchTerms(deferredSearchQuery)
    return filterGraphBySearchTerms(data.nodes, data.edges, terms)
  }, [data, deferredSearchQuery])

  useEffect(() => {
    setNodes(layoutNodes(filteredGraph.nodes))
    setEdges(layoutEdges(filteredGraph.edges))
  }, [filteredGraph, setNodes, setEdges])

  useEffect(() => {
    if (!filteredGraph.nodes.length) return
    const frame = requestAnimationFrame(() => {
      void fitView({ padding: 0.18, duration: 350 })
    })
    return () => cancelAnimationFrame(frame)
  }, [filteredGraph, fitView])

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        selected: node.data.document_id === selectedDocumentId,
      })),
    [nodes, selectedDocumentId]
  )

  const onNodeClick: NodeMouseHandler<DocumentNodeType> = useCallback(
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
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={onNodeClick}
        onPaneClick={() => selectDocument(null)}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        panOnDrag={false}
        panOnScroll={false}
        nodesDraggable={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
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
      </ReactFlow>
    </div>
  )
}
