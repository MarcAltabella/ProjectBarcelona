import type { RawGraphEdge, RawGraphNode } from "@/lib/types"

const STOPWORDS_EN = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "in",
  "on",
  "at",
  "to",
  "for",
  "of",
  "with",
  "by",
  "from",
  "as",
  "is",
  "was",
  "are",
  "were",
  "been",
  "be",
  "have",
  "has",
  "had",
  "do",
  "does",
  "did",
  "will",
  "would",
  "could",
  "should",
  "may",
  "might",
  "must",
  "shall",
  "this",
  "that",
  "these",
  "those",
  "it",
  "its",
  "they",
  "their",
  "them",
  "we",
  "our",
  "you",
  "your",
  "about",
  "into",
  "through",
  "during",
  "before",
  "after",
  "above",
  "below",
  "between",
  "under",
  "all",
  "each",
  "every",
  "both",
  "few",
  "more",
  "most",
  "other",
  "some",
  "such",
  "no",
  "nor",
  "not",
  "only",
  "own",
  "same",
  "so",
  "than",
  "too",
  "very",
  "can",
  "just",
  "now",
  "how",
  "what",
  "when",
  "where",
  "who",
  "which",
  "why",
  "any",
  "also",
  "back",
  "even",
  "files",
  "file",
  "document",
  "documents",
  "show",
  "find",
  "search",
  "like",
  "related",
  "regarding",
  "using",
  "use",
  "get",
  "list",
  "treatment",
  "treatments",
  "regulated",
  "regulation",
  "regulations",
  "regulating",
  "pertaining",
  "pertains",
  "contain",
  "contains",
  "including",
  "include",
  "includes",
  "following",
  "please",
  "looking",
  "stuff",
  "things",
  "thing",
  "info",
  "overview",
  "summary",
  "report",
  "reports",
  "paper",
  "papers",
  "various",
  "several",
  "certain",
  "given",
  "being",
  "having",
])

const STOPWORDS_ES = new Set([
  "el",
  "la",
  "los",
  "las",
  "un",
  "una",
  "unos",
  "unas",
  "y",
  "o",
  "pero",
  "de",
  "del",
  "al",
  "en",
  "con",
  "sin",
  "por",
  "para",
  "sobre",
  "entre",
  "que",
  "como",
  "cuando",
  "donde",
  "quien",
  "cual",
  "cuales",
  "esto",
  "esta",
  "estos",
  "estas",
  "archivo",
  "archivos",
  "documento",
  "documentos",
  "buscar",
  "busca",
  "muestra",
  "mostrar",
  "lista",
  "listar",
  "regulado",
  "regulada",
  "regulados",
  "reguladas",
  "regulacion",
])

const STOPWORDS_DE = new Set([
  "der",
  "die",
  "das",
  "ein",
  "eine",
  "einer",
  "einem",
  "einen",
  "und",
  "oder",
  "aber",
  "mit",
  "ohne",
  "von",
  "zu",
  "zum",
  "zur",
  "im",
  "in",
  "auf",
  "fur",
  "uber",
  "bei",
  "als",
  "wie",
  "was",
  "wann",
  "wo",
  "wer",
  "welche",
  "welcher",
  "welches",
  "datei",
  "dateien",
  "dokument",
  "dokumente",
  "suche",
  "suchen",
  "liste",
  "zeigen",
  "angezeigt",
  "reguliert",
  "regulierung",
])

type LanguageCode = "en" | "es" | "de"
const STOPWORDS_BY_LANGUAGE: Record<LanguageCode, Set<string>> = {
  en: STOPWORDS_EN,
  es: STOPWORDS_ES,
  de: STOPWORDS_DE,
}

/**
 * Short tokens (agencies, regs) kept despite min length — whole-token match still applies.
 */
const SHORT_QUERY_TERMS_ALLOWED = new Set([
  "fda",
  "ema",
  "ich",
  "who",
  "nih",
  "irb",
  "ctd",
  "eu",
  "uk",
  "ae",
  "sa",
  "iv",
  "im",
  "pi",
  "gcp",
  "glp",
  "gmp",
  "cfr",
])

const MIN_TERM_LEN = 3

function isNoiseToken(raw: string): boolean {
  if (/^\d{1,4}$/.test(raw)) return false
  if (raw.length < 2) return true
  if (raw.length < MIN_TERM_LEN && !SHORT_QUERY_TERMS_ALLOWED.has(raw)) return true
  return false
}

function detectLanguage(tokens: string[]): LanguageCode {
  const scores: Record<LanguageCode, number> = { en: 0, es: 0, de: 0 }
  for (const token of tokens) {
    if (STOPWORDS_EN.has(token)) scores.en += 1
    if (STOPWORDS_ES.has(token)) scores.es += 1
    if (STOPWORDS_DE.has(token)) scores.de += 1
  }
  const winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]
  return winner && winner[1] > 0 ? (winner[0] as LanguageCode) : "en"
}

/**
 * Split natural-language input into search tokens (lowercase). Drops stopwords,
 * overly short tokens (except known short acronyms), and numeric noise.
 * Returns [] if nothing meaningful remains.
 */
export function parseSearchTerms(input: string): string[] {
  const normalized = input
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()

  if (!normalized) return []

  const tokens = normalized.split(/\s+/).filter(Boolean)
  const language = detectLanguage(tokens)
  const stopwords = STOPWORDS_BY_LANGUAGE[language]

  const terms: string[] = []
  for (const raw of tokens) {
    if (isNoiseToken(raw)) continue
    if (stopwords.has(raw)) continue
    terms.push(raw)
  }

  return terms
}

export function buildNodeHaystack(node: RawGraphNode): string {
  return [
    node.search_text ?? "",
    node.label,
    node.group_key,
    node.document_class ?? "",
    node.document_status ?? "",
  ]
    .join(" ")
    .toLowerCase()
}

/** Distinct word-like tokens in text (lowercase), for whole-word matching. */
function tokenizeForMatch(text: string): Set<string> {
  const normalized = text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
  if (!normalized) return new Set()
  return new Set(normalized.split(/\s+/).filter(Boolean))
}

/**
 * True if `term` appears as a full token in `haystack` (not as a substring of
 * a longer word — avoids "in" matching "clinical", "art" matching "protocol").
 */
export function termMatchesHaystackWholeWord(haystack: string, term: string): boolean {
  return tokenizeForMatch(haystack).has(term)
}

/** True only if every term matches as a whole token (AND semantics). */
export function nodeMatchesAllTerms(haystack: string, terms: string[]): boolean {
  return terms.every((term) => termMatchesHaystackWholeWord(haystack, term))
}

/** Ids of nodes whose haystack matches every term. */
export function matchingNodeIds(nodes: RawGraphNode[], terms: string[]): Set<string> {
  const ids = new Set<string>()
  for (const node of nodes) {
    const haystack = buildNodeHaystack(node)
    if (nodeMatchesAllTerms(haystack, terms)) ids.add(node.node_id)
  }
  return ids
}

/**
 * From matched nodes, add only **hub** neighbors (study / product / entity), not
 * other documents. Otherwise any hit on one doc pulls in every sibling linked
 * through the same study.
 */
export function expandWithHubNeighbors(
  matchedIds: Set<string>,
  nodes: RawGraphNode[],
  edges: RawGraphEdge[]
): Set<string> {
  const byId = new Map(nodes.map((n) => [n.node_id, n]))
  const visible = new Set(matchedIds)

  for (const edge of edges) {
    if (matchedIds.has(edge.source)) {
      const n = byId.get(edge.target)
      if (n && n.node_type !== "document") visible.add(edge.target)
    }
    if (matchedIds.has(edge.target)) {
      const n = byId.get(edge.source)
      if (n && n.node_type !== "document") visible.add(edge.source)
    }
  }

  return visible
}

export function filterGraphBySearchTerms(
  nodes: RawGraphNode[],
  edges: RawGraphEdge[],
  terms: string[]
): { nodes: RawGraphNode[]; edges: RawGraphEdge[] } {
  if (terms.length === 0) {
    return { nodes, edges }
  }

  const matched = matchingNodeIds(nodes, terms)
  const visibleIds = expandWithHubNeighbors(matched, nodes, edges)

  const filteredNodes = nodes.filter((n) => visibleIds.has(n.node_id))
  const filteredEdges = edges.filter(
    (e) => visibleIds.has(e.source) && visibleIds.has(e.target)
  )

  return { nodes: filteredNodes, edges: filteredEdges }
}
