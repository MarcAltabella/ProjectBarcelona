import { describe, expect, it } from "vitest"
import {
  expandWithHubNeighbors,
  filterGraphBySearchTerms,
  matchingNodeIds,
  nodeMatchesAllTerms,
  parseSearchTerms,
  termMatchesHaystackWholeWord,
} from "./searchTerms"
import type { RawGraphEdge, RawGraphNode } from "@/lib/types"

describe("parseSearchTerms", () => {
  it("strips boilerplate and keeps substantive terms", () => {
    expect(
      parseSearchTerms("treatments with diabetes regulated by the FDA")
    ).toEqual(["diabetes", "fda"])
  })

  it("drops stopwords and keeps meaningful tokens", () => {
    expect(parseSearchTerms("files about diabetes and FDA")).toEqual([
      "diabetes",
      "fda",
    ])
  })

  it("returns empty for whitespace", () => {
    expect(parseSearchTerms("   ")).toEqual([])
  })

  it("returns empty when only stopwords remain", () => {
    expect(parseSearchTerms("the and or with")).toEqual([])
  })

  it("keeps approved in English queries", () => {
    expect(parseSearchTerms("file fda approved")).toEqual(["fda", "approved"])
  })

  it("uses Spanish stopwords when query is Spanish", () => {
    expect(parseSearchTerms("archivos sobre diabetes y fda")).toEqual([
      "diabetes",
      "fda",
    ])
  })

  it("keeps date fragments as searchable keywords", () => {
    expect(parseSearchTerms("fda approved 01/01/2023 english")).toEqual([
      "fda",
      "approved",
      "01",
      "01",
      "2023",
      "english",
    ])
  })
})

describe("filterGraphBySearchTerms", () => {
  const nodes: RawGraphNode[] = [
    {
      node_id: "a",
      node_type: "document",
      label: "Doc A",
      group_key: "",
      alert_count: 0,
      search_text: "type 2 diabetes protocol",
    },
    {
      node_id: "b",
      node_type: "study",
      label: "Study Hub",
      group_key: "hub",
      alert_count: 0,
      search_text: "oncology",
    },
    {
      node_id: "c",
      node_type: "document",
      label: "Doc C",
      group_key: "",
      alert_count: 0,
      search_text: "unrelated",
    },
  ]

  const edges: RawGraphEdge[] = [
    {
      edge_id: "e1",
      source: "a",
      target: "b",
      relation_type: "BELONGS_TO_STUDY",
      confidence: 0.9,
    },
    {
      edge_id: "e2",
      source: "b",
      target: "c",
      relation_type: "RELATED_TO",
      confidence: 0.5,
    },
  ]

  it("returns full graph when terms empty", () => {
    const out = filterGraphBySearchTerms(nodes, edges, [])
    expect(out.nodes).toHaveLength(3)
    expect(out.edges).toHaveLength(2)
  })

  it("matches AND terms and includes hub neighbors", () => {
    const terms = parseSearchTerms("diabetes")
    const out = filterGraphBySearchTerms(nodes, edges, terms)

    expect(out.nodes.map((n) => n.node_id).sort()).toEqual(["a", "b"])
    expect(out.edges.map((e) => e.edge_id)).toEqual(["e1"])
  })

  it("requires all keywords to match same node", () => {
    const terms = parseSearchTerms("diabetes unrelated")
    const out = filterGraphBySearchTerms(nodes, edges, terms)

    expect(out.nodes).toHaveLength(0)
    expect(out.edges).toHaveLength(0)
  })
})

describe("matchingNodeIds", () => {
  it("matches only when all terms exist", () => {
    const nodes: RawGraphNode[] = [
      {
        node_id: "x",
        node_type: "document",
        label: "Label",
        group_key: "",
        alert_count: 0,
        search_text: "FDA submission",
      },
    ]
    expect(matchingNodeIds(nodes, ["diabetes"]).size).toBe(0)
    expect(matchingNodeIds(nodes, ["fda"]).has("x")).toBe(true)
    expect(matchingNodeIds(nodes, ["fda", "submission"]).has("x")).toBe(true)
    expect(matchingNodeIds(nodes, ["fda", "diabetes"]).has("x")).toBe(false)
  })

  it("does not match substrings inside longer words", () => {
    const nodes: RawGraphNode[] = [
      {
        node_id: "y",
        node_type: "document",
        label: "Clinical summary",
        group_key: "",
        alert_count: 0,
        search_text: "clinical endpoint assessment",
      },
    ]
    expect(matchingNodeIds(nodes, ["in"]).size).toBe(0)
    expect(matchingNodeIds(nodes, ["clinical"]).has("y")).toBe(true)
  })
})

describe("nodeMatchesAllTerms", () => {
  it("requires all terms", () => {
    expect(nodeMatchesAllTerms("fda submission copy", ["fda"])).toBe(true)
    expect(nodeMatchesAllTerms("fda submission copy", ["fda", "submission"])).toBe(true)
    expect(nodeMatchesAllTerms("fda submission copy", ["fda", "ema"])).toBe(false)
  })
})

describe("termMatchesHaystackWholeWord", () => {
  it("matches fda only as its own token", () => {
    expect(termMatchesHaystackWholeWord("prefda notice", "fda")).toBe(false)
    expect(termMatchesHaystackWholeWord("FDA clearance copy", "fda")).toBe(true)
  })
})

describe("expandWithHubNeighbors", () => {
  const base = { group_key: "", alert_count: 0, search_text: "" }

  it("adds study/product/entity neighbors of a matched document, not other documents", () => {
    const nodes: RawGraphNode[] = [
      { node_id: "m", node_type: "document", label: "D", ...base },
      { node_id: "n", node_type: "study", label: "S", ...base },
    ]
    const edges: RawGraphEdge[] = [
      {
        edge_id: "1",
        source: "m",
        target: "n",
        relation_type: "BELONGS_TO_STUDY",
        confidence: 1,
      },
    ]
    const out = expandWithHubNeighbors(new Set(["m"]), nodes, edges)
    expect([...out].sort()).toEqual(["m", "n"])
  })

  it("does not pull in a sibling document linked only through the same study", () => {
    const nodes: RawGraphNode[] = [
      { node_id: "m", node_type: "document", label: "D1", ...base },
      { node_id: "n", node_type: "document", label: "D2", ...base },
    ]
    const edges: RawGraphEdge[] = [
      {
        edge_id: "1",
        source: "m",
        target: "n",
        relation_type: "RELATED_TO",
        confidence: 1,
      },
    ]
    const out = expandWithHubNeighbors(new Set(["m"]), nodes, edges)
    expect([...out].sort()).toEqual(["m"])
  })
})
