// ─── Domain enums ────────────────────────────────────────────────────────────

export type DocumentClass =
  | "CSP"
  | "IB"
  | "ICF"
  | "CRF"
  | "CSR"
  | "eTMF"
  | "Regulatory"
  | "Synopsis"
  | "Patient_Questionnaire"
  | "Info_Sheet"
  | "Medical_Publication"
  | "NOISE"

export type InternalDocumentClass =
  | "CSP_full"
  | "CSP_synopsis"
  | "IB"
  | "ICF"
  | "CRF_patient_form"
  | "CSR"
  | "eTMF_index"
  | "eTMF_site_ops"
  | "eTMF_monitoring"
  | "eTMF_regulatory_correspondence"
  | "DSUR"
  | "DSMB_charter"
  | "DSMB_minutes"
  | "SmPC"
  | "Ethics_approval"
  | "Medical_publication"
  | "Administrative_noise"

export type DocumentStatus = "current" | "superseded" | "unknown"

export type RelationType =
  | "BELONGS_TO_STUDY"
  | "ABOUT_PRODUCT"
  | "HAS_DOCUMENT_TYPE"
  | "IN_FAMILY"
  | "SUPERSEDES"
  | "SUPERSEDED_BY"
  | "DUPLICATE_OF"
  | "NEAR_DUPLICATE_OF"
  | "REFERS_TO"
  | "MENTIONS_SITE"
  | "MENTIONS_PATIENT"
  | "MENTIONS_SAFETY_EVENT"
  | "ISSUED_BY"
  | "SENT_TO"
  | "APPROVES"
  | "IMPLEMENTS_AMENDMENT"
  | "RELATED_TO"
  | "CONTRADICTS"
  | "HAS_ALERT"

export type AlertType =
  | "LOW_CONFIDENCE_CLASSIFICATION"
  | "AMBIGUOUS_CLASSIFICATION"
  | "SUPERSEDED_DOCUMENT"
  | "DUPLICATE_DOCUMENT"
  | "NEAR_DUPLICATE_DOCUMENT"
  | "CONTRADICTION"
  | "MISSING_EXPECTED_LINK"
  | "SUSPICIOUS_NOISE"
  | "ISOLATED_DOCUMENT"

export type AlertSeverity = "info" | "warning" | "error"

// ─── Graph payload (from /api/graph) ─────────────────────────────────────────

/** Flat node row returned from graph_nodes_v or equivalent */
export interface RawGraphNode {
  node_id: string
  node_type: "document" | "study" | "product" | "entity"
  label: string
  group_key: string
  document_id?: string
  study_id?: string
  document_class?: DocumentClass
  document_status?: DocumentStatus
  alert_count: number
  max_alert_severity?: AlertSeverity
  search_text?: string
}

/** Flat edge row returned from graph_edges_v or equivalent */
export interface RawGraphEdge {
  edge_id: string
  source: string
  target: string
  relation_type: RelationType
  confidence: number
  label?: string
}

export interface GraphPayload {
  nodes: RawGraphNode[]
  edges: RawGraphEdge[]
}

// ─── Document sidebar (from /api/documents/:id) ───────────────────────────────

export interface EntityMention {
  type: string
  value: string
}

export interface DocumentAlert {
  id: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  evidence_spans?: Record<string, unknown>[]
}

export interface DocumentDetail {
  id: string
  file_name: string
  final_label?: DocumentClass
  internal_label?: InternalDocumentClass
  classification_confidence?: number
  classification_explanation?: string
  document_status: DocumentStatus
  study_code?: string
  product_name?: string
  version_or_edition?: string
  language?: string
  top_entities: EntityMention[]
  alert_count: number
  top_2_labels?: DocumentClass[]
  preview_text?: string
  alerts?: DocumentAlert[]
}

// ─── Related documents (from /api/documents/:id/related) ─────────────────────

export interface RelatedDocument {
  relation_id: string
  relation_type: RelationType
  confidence: number
  source_rule_or_model: string
  evidence_spans?: Array<Record<string, unknown>>
  document: {
    id: string
    file_name: string
    final_label?: DocumentClass
    classification_confidence?: number
  } | null
}

// ─── Alerts (from /api/alerts) ────────────────────────────────────────────────

export interface Alert {
  id: string
  document_id: string
  file_name?: string
  alert_type: AlertType
  severity: AlertSeverity
  title: string
  description: string
  study_code?: string
  final_label?: DocumentClass
  status?: string
}
