/**
 * Comprehensive toy data so the UI is fully explorable without Supabase.
 * Everything here mirrors the shapes returned by the API routes.
 */

import type {
  RawGraphNode,
  RawGraphEdge,
  DocumentDetail,
  RelatedDocument,
  Alert,
} from "./types"

// ── Documents ────────────────────────────────────────────────────────

export const TOY_DOCUMENTS: Record<string, DocumentDetail> = {
  "doc-001": {
    id: "doc-001",
    file_name: "Protocol_BRC471_v3.0_Final.pdf",
    final_label: "CSP",
    internal_label: "CSP_full",
    classification_confidence: 0.96,
    classification_explanation:
      "Contains protocol synopsis, eligibility criteria, primary/secondary endpoints, schedule of assessments, and statistical design sections. Matches the full Clinical Study Protocol template.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    version_or_edition: "v3.0",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "Site", value: "ES-01 (Hospital Clínic Barcelona)" },
      { type: "Person", value: "Dr. María Ferrer (PI)" },
    ],
    alert_count: 0,
    top_2_labels: ["CSP", "Synopsis"],
  },
  "doc-002": {
    id: "doc-002",
    file_name: "Protocol_BRC471_v2.0.pdf",
    final_label: "CSP",
    internal_label: "CSP_full",
    classification_confidence: 0.94,
    classification_explanation:
      "Full CSP with the same structure as v3.0 but using the earlier endpoint definitions before Amendment 2.",
    document_status: "superseded",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    version_or_edition: "v2.0",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Product", value: "BRC-471 (Lumitanib)" },
    ],
    alert_count: 1,
    top_2_labels: ["CSP"],
  },
  "doc-003": {
    id: "doc-003",
    file_name: "Protocol_Synopsis_BRC471.md",
    final_label: "Synopsis",
    internal_label: "CSP_synopsis",
    classification_confidence: 0.91,
    classification_explanation:
      "Abbreviated protocol overview with rationale, objectives, study design, population, and endpoints — no full statistical section.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    version_or_edition: "v1.0",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Product", value: "BRC-471 (Lumitanib)" },
    ],
    alert_count: 0,
    top_2_labels: ["Synopsis", "CSP"],
  },
  "doc-004": {
    id: "doc-004",
    file_name: "Investigator_Brochure_Lumitanib_Ed5.pdf",
    final_label: "IB",
    internal_label: "IB",
    classification_confidence: 0.97,
    classification_explanation:
      "Standard IB structure: physical/chemical properties, nonclinical studies, clinical pharmacology, prior clinical experience, and safety summary.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    version_or_edition: "Edition 5",
    language: "English",
    top_entities: [
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "SafetyEvent", value: "Grade 3 hepatotoxicity — 2 events" },
    ],
    alert_count: 0,
    top_2_labels: ["IB"],
  },
  "doc-005": {
    id: "doc-005",
    file_name: "ICF_Patient_Consent_v2.1_ES.pdf",
    final_label: "ICF",
    internal_label: "ICF",
    classification_confidence: 0.93,
    classification_explanation:
      "Informed consent form with subject rights, procedures, risks, benefits, and signature blocks. Includes Spanish-translated lay summary.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    version_or_edition: "v2.1",
    language: "Spanish",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Site", value: "ES-01 (Hospital Clínic Barcelona)" },
      { type: "Country", value: "Spain" },
    ],
    alert_count: 0,
    top_2_labels: ["ICF"],
  },
  "doc-006": {
    id: "doc-006",
    file_name: "ICF_Patient_Consent_v2.0.pdf",
    final_label: "ICF",
    internal_label: "ICF",
    classification_confidence: 0.89,
    classification_explanation:
      "Previous version of the informed consent form prior to Amendment 2 language updates.",
    document_status: "superseded",
    study_code: "BIORCE-ONC-2023-001",
    version_or_edition: "v2.0",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
    ],
    alert_count: 1,
    top_2_labels: ["ICF"],
  },
  "doc-007": {
    id: "doc-007",
    file_name: "CRF_BRC471_Baseline_Visit.html",
    final_label: "CRF",
    internal_label: "CRF_patient_form",
    classification_confidence: 0.48,
    classification_explanation:
      "Form-like structure with field labels and input areas. Could also be an info sheet — low confidence due to minimal distinguishing features.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Patient", value: "Subject screening fields" },
    ],
    alert_count: 1,
    top_2_labels: ["CRF", "Info_Sheet"],
  },
  "doc-008": {
    id: "doc-008",
    file_name: "CSR_BRC471_Phase2_Final.pdf",
    final_label: "CSR",
    internal_label: "CSR",
    classification_confidence: 0.95,
    classification_explanation:
      "Complete CSR with synopsis, efficacy results, safety analysis, discussion, and conclusions. References Protocol v3.0.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "Person", value: "Dr. James Liu (Medical Monitor)" },
    ],
    alert_count: 0,
    top_2_labels: ["CSR"],
  },
  "doc-009": {
    id: "doc-009",
    file_name: "eTMF_Filing_Index_2024Q1.csv",
    final_label: "eTMF",
    internal_label: "eTMF_index",
    classification_confidence: 0.88,
    classification_explanation:
      "Tabular filing index listing document zones, sections, and artifact references consistent with DIA TMF reference model.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
    ],
    alert_count: 0,
    top_2_labels: ["eTMF"],
  },
  "doc-010": {
    id: "doc-010",
    file_name: "Monitoring_Visit_Report_ES01_Oct2024.txt",
    final_label: "eTMF",
    internal_label: "eTMF_monitoring",
    classification_confidence: 0.82,
    classification_explanation:
      "Monitoring visit report for site ES-01 covering source data verification, protocol deviations, and action items.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Site", value: "ES-01 (Hospital Clínic Barcelona)" },
      { type: "Person", value: "Ana García (CRA)" },
    ],
    alert_count: 1,
    top_2_labels: ["eTMF", "Regulatory"],
  },
  "doc-011": {
    id: "doc-011",
    file_name: "Site_Qualification_Visit_FR02.md",
    final_label: "eTMF",
    internal_label: "eTMF_site_ops",
    classification_confidence: 0.85,
    classification_explanation:
      "Site qualification report assessing facilities, staff, and equipment at the French site.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Site", value: "FR-02 (Hôpital Saint-Louis Paris)" },
      { type: "Country", value: "France" },
    ],
    alert_count: 0,
    top_2_labels: ["eTMF"],
  },
  "doc-012": {
    id: "doc-012",
    file_name: "DSUR_BRC471_2024_Annual.pdf",
    final_label: "Regulatory",
    internal_label: "DSUR",
    classification_confidence: 0.62,
    classification_explanation:
      "Annual safety report with expected and unexpected adverse events. Borderline classification — could be a standalone safety report or IB addendum.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    language: "English",
    top_entities: [
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "SafetyEvent", value: "BIORCE-SAE-2023-008" },
      { type: "RegulatoryBody", value: "EMA" },
    ],
    alert_count: 1,
    top_2_labels: ["Regulatory", "IB"],
  },
  "doc-013": {
    id: "doc-013",
    file_name: "DSMB_Charter_ONC2023.pdf",
    final_label: "Regulatory",
    internal_label: "DSMB_charter",
    classification_confidence: 0.92,
    classification_explanation:
      "Data Safety Monitoring Board charter defining membership, meeting schedule, interim analysis rules, and stopping criteria.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Person", value: "Prof. Henrik Sørensen (DSMB Chair)" },
    ],
    alert_count: 0,
    top_2_labels: ["Regulatory"],
  },
  "doc-014": {
    id: "doc-014",
    file_name: "Ethics_Approval_CEIC_Barcelona.pdf",
    final_label: "Regulatory",
    internal_label: "Ethics_approval",
    classification_confidence: 0.90,
    classification_explanation:
      "Favorable opinion letter from the Clinical Research Ethics Committee approving the study at Hospital Clínic.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "Spanish",
    top_entities: [
      { type: "RegulatoryBody", value: "CEIC Hospital Clínic" },
      { type: "Site", value: "ES-01 (Hospital Clínic Barcelona)" },
      { type: "Country", value: "Spain" },
    ],
    alert_count: 0,
    top_2_labels: ["Regulatory"],
  },
  "doc-015": {
    id: "doc-015",
    file_name: "SmPC_Lumitanib_EU_Approved.md",
    final_label: "Info_Sheet",
    internal_label: "SmPC",
    classification_confidence: 0.87,
    classification_explanation:
      "Summary of Product Characteristics with posology, contra-indications, and pharmacological properties.",
    document_status: "current",
    product_name: "BRC-471 (Lumitanib)",
    language: "English",
    top_entities: [
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "RegulatoryBody", value: "EMA" },
    ],
    alert_count: 0,
    top_2_labels: ["Info_Sheet", "IB"],
  },
  "doc-016": {
    id: "doc-016",
    file_name: "Lumitanib_PhaseII_Efficacy_NEJM.pdf",
    final_label: "Medical_Publication",
    internal_label: "Medical_publication",
    classification_confidence: 0.94,
    classification_explanation:
      "Peer-reviewed publication with title, author list, abstract, introduction, methods, results, and discussion. Published in NEJM.",
    document_status: "current",
    product_name: "BRC-471 (Lumitanib)",
    language: "English",
    top_entities: [
      { type: "Product", value: "BRC-471 (Lumitanib)" },
      { type: "Person", value: "Ferrer M. et al." },
    ],
    alert_count: 1,
    top_2_labels: ["Medical_Publication"],
  },
  "doc-017": {
    id: "doc-017",
    file_name: "QoL_Patient_Survey_BRC471.html",
    final_label: "Patient_Questionnaire",
    classification_confidence: 0.86,
    classification_explanation:
      "Structured questionnaire with Likert scales measuring quality of life, fatigue, pain, and functional capacity.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    language: "English",
    top_entities: [
      { type: "Study", value: "BIORCE-ONC-2023-001" },
    ],
    alert_count: 0,
    top_2_labels: ["Patient_Questionnaire", "CRF"],
  },
  "doc-018": {
    id: "doc-018",
    file_name: "Press_Release_Biorce_Q3_Results.txt",
    final_label: "NOISE",
    internal_label: "Administrative_noise",
    classification_confidence: 0.78,
    classification_explanation:
      "Corporate press release about quarterly earnings. Contains clinical keywords but no study-specific content.",
    document_status: "current",
    language: "English",
    top_entities: [],
    alert_count: 1,
    top_2_labels: ["NOISE"],
  },
  "doc-019": {
    id: "doc-019",
    file_name: "Vendor_Invoice_LabCorp_Sept2024.pdf",
    final_label: "NOISE",
    internal_label: "Administrative_noise",
    classification_confidence: 0.81,
    classification_explanation:
      "Vendor invoice for central lab services. Administrative document with no clinical or regulatory content.",
    document_status: "current",
    language: "English",
    top_entities: [],
    alert_count: 1,
    top_2_labels: ["NOISE"],
  },
  "doc-020": {
    id: "doc-020",
    file_name: "Amendment_2_Notification_AEMPS.pdf",
    final_label: "Regulatory",
    internal_label: "eTMF_regulatory_correspondence",
    classification_confidence: 0.85,
    classification_explanation:
      "Substantial amendment notification letter submitted to AEMPS describing changes to secondary endpoints and ICF language.",
    document_status: "current",
    study_code: "BIORCE-ONC-2023-001",
    product_name: "BRC-471 (Lumitanib)",
    language: "Spanish",
    top_entities: [
      { type: "RegulatoryBody", value: "AEMPS" },
      { type: "Study", value: "BIORCE-ONC-2023-001" },
      { type: "Country", value: "Spain" },
    ],
    alert_count: 0,
    top_2_labels: ["Regulatory", "eTMF"],
  },
}

// ── Graph nodes ──────────────────────────────────────────────────────

export const TOY_GRAPH_NODES: RawGraphNode[] = [
  // Hub entities
  {
    node_id: "study-1",
    node_type: "study",
    label: "BIORCE-ONC-2023-001",
    group_key: "study",
    study_id: "study-1",
    alert_count: 0,
  },
  {
    node_id: "product-1",
    node_type: "product",
    label: "BRC-471 (Lumitanib)",
    group_key: "product",
    alert_count: 0,
  },
  // Documents (derived from TOY_DOCUMENTS)
  ...Object.values(TOY_DOCUMENTS).map((d) => ({
    node_id: d.id,
    node_type: "document" as const,
    label: d.file_name.replace(/\.[^.]+$/, "").replace(/_/g, " "),
    group_key: d.final_label ?? "unknown",
    document_id: d.id,
    study_id: d.study_code ? "study-1" : undefined,
    document_class: d.final_label,
    document_status: d.document_status,
    alert_count: d.alert_count,
    max_alert_severity:
      d.alert_count > 0
        ? d.classification_confidence != null && d.classification_confidence < 0.6
          ? ("warning" as const)
          : ("info" as const)
        : undefined,
  })),
]

// ── Graph edges ──────────────────────────────────────────────────────

export const TOY_GRAPH_EDGES: RawGraphEdge[] = [
  // Study links
  { edge_id: "e-001", source: "doc-001", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.98 },
  { edge_id: "e-002", source: "doc-002", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.97 },
  { edge_id: "e-003", source: "doc-003", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.95 },
  { edge_id: "e-004", source: "doc-005", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.96 },
  { edge_id: "e-005", source: "doc-008", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.96 },
  { edge_id: "e-006", source: "doc-009", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.90 },
  { edge_id: "e-007", source: "doc-013", target: "study-1", relation_type: "BELONGS_TO_STUDY", confidence: 0.92 },
  // Product links
  { edge_id: "e-010", source: "doc-001", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.97 },
  { edge_id: "e-011", source: "doc-004", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.98 },
  { edge_id: "e-012", source: "doc-008", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.96 },
  { edge_id: "e-013", source: "doc-012", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.88 },
  { edge_id: "e-014", source: "doc-015", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.91 },
  { edge_id: "e-015", source: "doc-016", target: "product-1", relation_type: "ABOUT_PRODUCT", confidence: 0.93 },
  // Version chains
  { edge_id: "e-020", source: "doc-001", target: "doc-002", relation_type: "SUPERSEDES", confidence: 0.97, label: "supersedes" },
  { edge_id: "e-021", source: "doc-005", target: "doc-006", relation_type: "SUPERSEDES", confidence: 0.95, label: "supersedes" },
  // Cross-references
  { edge_id: "e-030", source: "doc-003", target: "doc-001", relation_type: "REFERS_TO", confidence: 0.90, label: "synopsis of" },
  { edge_id: "e-031", source: "doc-008", target: "doc-001", relation_type: "REFERS_TO", confidence: 0.93, label: "reports on" },
  { edge_id: "e-032", source: "doc-020", target: "doc-001", relation_type: "IMPLEMENTS_AMENDMENT", confidence: 0.87, label: "amends" },
  { edge_id: "e-033", source: "doc-014", target: "doc-005", relation_type: "APPROVES", confidence: 0.88, label: "approves" },
  { edge_id: "e-034", source: "doc-010", target: "doc-011", relation_type: "RELATED_TO", confidence: 0.72 },
  { edge_id: "e-035", source: "doc-007", target: "doc-017", relation_type: "RELATED_TO", confidence: 0.65 },
  { edge_id: "e-036", source: "doc-012", target: "doc-004", relation_type: "REFERS_TO", confidence: 0.80, label: "cites safety from" },
]

// ── Alerts ───────────────────────────────────────────────────────────

export const TOY_ALERTS: Alert[] = [
  {
    id: "alert-001",
    document_id: "doc-002",
    file_name: "Protocol_BRC471_v2.0.pdf",
    alert_type: "SUPERSEDED_DOCUMENT",
    severity: "warning",
    title: "Superseded protocol still in corpus",
    description:
      "Protocol v2.0 has been superseded by v3.0. Ensure downstream references point to the current version.",
    study_code: "BIORCE-ONC-2023-001",
    final_label: "CSP",
  },
  {
    id: "alert-002",
    document_id: "doc-006",
    file_name: "ICF_Patient_Consent_v2.0.pdf",
    alert_type: "SUPERSEDED_DOCUMENT",
    severity: "warning",
    title: "Superseded consent form",
    description:
      "ICF v2.0 has been replaced by v2.1 with updated Amendment 2 language. Active sites should not use this version.",
    study_code: "BIORCE-ONC-2023-001",
    final_label: "ICF",
  },
  {
    id: "alert-003",
    document_id: "doc-007",
    file_name: "CRF_BRC471_Baseline_Visit.html",
    alert_type: "LOW_CONFIDENCE_CLASSIFICATION",
    severity: "warning",
    title: "Low-confidence classification (48%)",
    description:
      "This file has form-like structure but insufficient distinguishing features. It could be a CRF or an Info Sheet. Manual review recommended.",
    study_code: "BIORCE-ONC-2023-001",
    final_label: "CRF",
  },
  {
    id: "alert-004",
    document_id: "doc-012",
    file_name: "DSUR_BRC471_2024_Annual.pdf",
    alert_type: "AMBIGUOUS_CLASSIFICATION",
    severity: "warning",
    title: "Ambiguous: Regulatory vs IB addendum",
    description:
      "Annual safety report with characteristics of both a standalone DSUR and an IB safety update. The final label is Regulatory but confidence is only 62%.",
    study_code: "BIORCE-ONC-2023-001",
    final_label: "Regulatory",
  },
  {
    id: "alert-005",
    document_id: "doc-010",
    file_name: "Monitoring_Visit_Report_ES01_Oct2024.txt",
    alert_type: "MISSING_EXPECTED_LINK",
    severity: "info",
    title: "No linked follow-up report",
    description:
      "This monitoring report for site ES-01 has no linked follow-up visit report or close-out letter in the corpus.",
    study_code: "BIORCE-ONC-2023-001",
    final_label: "eTMF",
  },
  {
    id: "alert-006",
    document_id: "doc-016",
    file_name: "Lumitanib_PhaseII_Efficacy_NEJM.pdf",
    alert_type: "ISOLATED_DOCUMENT",
    severity: "info",
    title: "Publication weakly connected to study",
    description:
      "This medical publication references BRC-471 but does not explicitly cite the study ID BIORCE-ONC-2023-001. The link is inferred from product name only.",
    final_label: "Medical_Publication",
  },
  {
    id: "alert-007",
    document_id: "doc-018",
    file_name: "Press_Release_Biorce_Q3_Results.txt",
    alert_type: "SUSPICIOUS_NOISE",
    severity: "info",
    title: "Administrative noise — verify exclusion",
    description:
      "Corporate press release flagged as noise. Contains clinical keywords (e.g. 'Phase II', 'endpoint') but no study-specific data.",
    final_label: "NOISE",
  },
  {
    id: "alert-008",
    document_id: "doc-019",
    file_name: "Vendor_Invoice_LabCorp_Sept2024.pdf",
    alert_type: "SUSPICIOUS_NOISE",
    severity: "info",
    title: "Administrative noise — vendor invoice",
    description:
      "Financial document with no clinical or regulatory content. Classified as noise with 81% confidence.",
    final_label: "NOISE",
  },
]

// ── Related documents (keyed by doc id) ──────────────────────────────

export const TOY_RELATED: Record<string, RelatedDocument[]> = {
  "doc-001": [
    { relation_id: "e-030", relation_type: "REFERS_TO", confidence: 0.90, source_rule_or_model: "explicit_reference", document: { id: "doc-003", file_name: "Protocol_Synopsis_BRC471.md", final_label: "Synopsis", classification_confidence: 0.91 } },
    { relation_id: "e-031", relation_type: "REFERS_TO", confidence: 0.93, source_rule_or_model: "explicit_reference", document: { id: "doc-008", file_name: "CSR_BRC471_Phase2_Final.pdf", final_label: "CSR", classification_confidence: 0.95 } },
    { relation_id: "e-020", relation_type: "SUPERSEDES", confidence: 0.97, source_rule_or_model: "version_chain", document: { id: "doc-002", file_name: "Protocol_BRC471_v2.0.pdf", final_label: "CSP", classification_confidence: 0.94 } },
    { relation_id: "e-032", relation_type: "IMPLEMENTS_AMENDMENT", confidence: 0.87, source_rule_or_model: "explicit_reference", document: { id: "doc-020", file_name: "Amendment_2_Notification_AEMPS.pdf", final_label: "Regulatory", classification_confidence: 0.85 } },
  ],
  "doc-008": [
    { relation_id: "e-031", relation_type: "REFERS_TO", confidence: 0.93, source_rule_or_model: "explicit_reference", document: { id: "doc-001", file_name: "Protocol_BRC471_v3.0_Final.pdf", final_label: "CSP", classification_confidence: 0.96 } },
  ],
  "doc-005": [
    { relation_id: "e-021", relation_type: "SUPERSEDES", confidence: 0.95, source_rule_or_model: "version_chain", document: { id: "doc-006", file_name: "ICF_Patient_Consent_v2.0.pdf", final_label: "ICF", classification_confidence: 0.89 } },
    { relation_id: "e-033", relation_type: "APPROVES", confidence: 0.88, source_rule_or_model: "explicit_reference", document: { id: "doc-014", file_name: "Ethics_Approval_CEIC_Barcelona.pdf", final_label: "Regulatory", classification_confidence: 0.90 } },
  ],
  "doc-004": [
    { relation_id: "e-036", relation_type: "REFERS_TO", confidence: 0.80, source_rule_or_model: "explicit_reference", document: { id: "doc-012", file_name: "DSUR_BRC471_2024_Annual.pdf", final_label: "Regulatory", classification_confidence: 0.62 } },
  ],
}

// ── Search index (flat list for the SearchPill) ──────────────────────

export const TOY_SEARCH_INDEX = Object.values(TOY_DOCUMENTS).map((d) => ({
  id: d.id,
  label: d.file_name,
  sublabel: d.study_code ?? d.product_name ?? undefined,
  category: d.final_label ?? "Unknown",
}))
