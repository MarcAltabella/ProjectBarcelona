import { create } from "zustand"

interface GraphFilters {
  studyId: string | null
  documentClass: string | null
  alertSeverity: string | null
  alertType: string | null
  relationTypes: string[]
  showLowConfidence: boolean
}

interface GraphState {
  // Selection
  selectedDocumentId: string | null
  selectedEdgeId: string | null

  // Live search
  searchQuery: string

  // Document view mode
  documentViewOpen: boolean

  // Transparency layer (explanation display)
  transparencyDocumentId: string | null
  transparencyOpen: boolean

  // Filters
  filters: GraphFilters

  // Actions
  selectDocument: (id: string | null) => void
  selectEdge: (id: string | null) => void
  setSearchQuery: (q: string) => void
  setFilter: <K extends keyof GraphFilters>(key: K, value: GraphFilters[K]) => void
  resetFilters: () => void
  setDocumentViewOpen: (open: boolean) => void
  setTransparencyDocument: (id: string | null) => void
  setTransparencyOpen: (open: boolean) => void
}

const defaultFilters: GraphFilters = {
  studyId: null,
  documentClass: null,
  alertSeverity: null,
  alertType: null,
  relationTypes: [],
  showLowConfidence: false,
}

export const useGraphStore = create<GraphState>((set) => ({
  selectedDocumentId: null,
  selectedEdgeId: null,
  searchQuery: "",
  documentViewOpen: false,
  transparencyDocumentId: null,
  transparencyOpen: false,
  filters: defaultFilters,

  selectDocument: (id) =>
    set({ selectedDocumentId: id, selectedEdgeId: null }),

  selectEdge: (id) =>
    set({ selectedEdgeId: id }),

  setSearchQuery: (q) =>
    set({ searchQuery: q }),

  setFilter: (key, value) =>
    set((s) => ({ filters: { ...s.filters, [key]: value } })),

  resetFilters: () =>
    set({ filters: defaultFilters, searchQuery: "" }),

  setDocumentViewOpen: (open) =>
    set({ documentViewOpen: open }),

  setTransparencyDocument: (id) =>
    set({ transparencyDocumentId: id, transparencyOpen: !!id }),

  setTransparencyOpen: (open) =>
    set({ transparencyOpen: open }),
}))
