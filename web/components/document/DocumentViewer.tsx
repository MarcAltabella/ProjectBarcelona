"use client"

import { ArrowUp } from "lucide-react"
import { useQuery } from "@tanstack/react-query"
import { fetchDocument } from "@/lib/api"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/Card"
import { ClassBadge } from "@/components/ui/ClassBadge"

export function DocumentViewer({
  documentId,
  onClose,
}: {
  documentId: string | null
  onClose: () => void
}) {
  const { data: doc, isLoading } = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => fetchDocument(documentId!),
    enabled: !!documentId,
  })

  if (!documentId || !doc) return null

  return (
    <div className="w-full min-h-screen bg-white">
      {/* Header with back button */}
      <div className="sticky top-0 z-20 bg-white border-b border-black/[.06]">
        <div className="max-w-3xl mx-auto px-8 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-ink">{doc.file_name}</h1>
          <button
            onClick={onClose}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-lg",
              "text-[13px] font-medium text-[#86868B]",
              "bg-black/[.04] hover:bg-black/[.08] transition-colors"
            )}
          >
            <ArrowUp className="w-4 h-4" />
            Back to graph
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-8 py-12">
        {/* Metadata */}
        <div className="mb-8 pb-8 border-b border-black/[.06]">
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <ClassBadge label={doc.final_label} />
            {doc.document_status && (
              <span
                className={cn(
                  "inline-block text-[11px] font-medium px-2.5 py-0.5 rounded-full border",
                  doc.document_status === "current"
                    ? "border-[#7EBC8E]/40 text-[#5A9E6A] bg-[#7EBC8E]/10"
                    : "border-[#D9A766]/40 text-[#B08840] bg-[#D9A766]/10"
                )}
              >
                {doc.document_status}
              </span>
            )}
          </div>

          {doc.classification_confidence != null && (
            <div className="mb-4">
              <p className="text-[12px] text-[#86868B] mb-2">
                Classification confidence
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-black/[.04] rounded-full overflow-hidden max-w-xs">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      doc.classification_confidence >= 0.8
                        ? "bg-[#7EBC8E]"
                        : doc.classification_confidence >= 0.6
                        ? "bg-[#D9A766]"
                        : "bg-[#D98080]"
                    )}
                    style={{ width: `${doc.classification_confidence * 100}%` }}
                  />
                </div>
                <span className="text-[12px] text-[#86868B] w-10">
                  {Math.round(doc.classification_confidence * 100)}%
                </span>
              </div>
            </div>
          )}

          {(doc.study_code || doc.product_name || doc.version_or_edition) && (
            <div className="grid grid-cols-2 gap-4 text-[13px]">
              {doc.study_code && (
                <div>
                  <p className="text-[#86868B] text-[11px] font-medium uppercase tracking-wider mb-1">
                    Study
                  </p>
                  <p className="text-ink">{doc.study_code}</p>
                </div>
              )}
              {doc.product_name && (
                <div>
                  <p className="text-[#86868B] text-[11px] font-medium uppercase tracking-wider mb-1">
                    Product
                  </p>
                  <p className="text-ink">{doc.product_name}</p>
                </div>
              )}
              {doc.version_or_edition && (
                <div>
                  <p className="text-[#86868B] text-[11px] font-medium uppercase tracking-wider mb-1">
                    Version
                  </p>
                  <p className="text-ink">{doc.version_or_edition}</p>
                </div>
              )}
              {doc.language && (
                <div>
                  <p className="text-[#86868B] text-[11px] font-medium uppercase tracking-wider mb-1">
                    Language
                  </p>
                  <p className="text-ink">{doc.language}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Classification explanation */}
        {doc.classification_explanation && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-ink mb-3">
              Classification Rationale
            </h2>
            <p className="text-[15px] text-[#555555] leading-relaxed">
              {doc.classification_explanation}
            </p>
          </div>
        )}

        {/* Key entities */}
        {doc.top_entities && doc.top_entities.length > 0 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-ink mb-4">
              Key Entities
            </h2>
            <div className="grid gap-3">
              {doc.top_entities.map((entity, i) => (
                <Card key={i} className="!p-3.5 !rounded-xl">
                  <div className="flex gap-3">
                    <span className="text-[11px] font-semibold text-[#86868B] uppercase tracking-wider w-20 flex-shrink-0">
                      {entity.type}
                    </span>
                    <p className="text-[13px] text-ink">{entity.value}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Document content preview */}
        <div className="mb-12">
          <h2 className="text-lg font-semibold text-ink mb-4">
            Document Preview
          </h2>
          <Card className="!p-6 !rounded-xl">
            <div className="prose prose-sm max-w-none">
              <div className="text-[14px] text-[#555555] leading-relaxed space-y-4">
                <p>
                  This is a preview of the document content. In a production
                  environment, this would display the actual document text
                  extracted from the PDF or other file format.
                </p>

                {doc.file_name.toLowerCase().includes("protocol") && (
                  <>
                    <h3 className="font-semibold text-ink mt-4">Study Design</h3>
                    <p>
                      This study is designed as a randomized, double-blind,
                      placebo-controlled phase II trial evaluating the efficacy
                      and safety of the investigational compound. The primary
                      objective is to assess clinical benefit in the target
                      population.
                    </p>

                    <h3 className="font-semibold text-ink mt-4">
                      Primary Endpoints
                    </h3>
                    <ul className="list-disc list-inside space-y-1">
                      <li>Disease-specific response rate at week 12</li>
                      <li>Progression-free survival at 6 months</li>
                      <li>Overall survival at 12 months</li>
                    </ul>
                  </>
                )}

                {doc.file_name.toLowerCase().includes("investigator") && (
                  <>
                    <h3 className="font-semibold text-ink mt-4">
                      Physical and Chemical Properties
                    </h3>
                    <p>
                      The compound is a selective inhibitor with molecular weight
                      of approximately 450 g/mol. It exhibits good solubility in
                      aqueous media and demonstrates stable pharmacokinetics in
                      preclinical models.
                    </p>

                    <h3 className="font-semibold text-ink mt-4">
                      Nonclinical Studies
                    </h3>
                    <p>
                      Comprehensive preclinical evaluation in rodent and primate
                      models demonstrated target engagement and dose-dependent
                      efficacy. No major safety signals were observed at
                      exposures up to 10-fold the anticipated clinical dose.
                    </p>
                  </>
                )}

                {doc.file_name.toLowerCase().includes("consent") && (
                  <>
                    <h3 className="font-semibold text-ink mt-4">
                      Purpose of the Study
                    </h3>
                    <p>
                      You are invited to participate in a clinical research study
                      evaluating a new investigational treatment. This study will
                      help us understand whether this treatment is safe and
                      effective for your condition.
                    </p>

                    <h3 className="font-semibold text-ink mt-4">
                      Study Procedures
                    </h3>
                    <p>
                      If you agree to participate, you will be randomly assigned
                      to receive either the investigational treatment or placebo.
                      You will be required to visit the clinic weekly for the
                      first month, then monthly for the duration of the study.
                    </p>
                  </>
                )}

                <p className="text-[#86868B] pt-4 border-t border-black/[.06]">
                  [Additional document content would be displayed here]
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Alternate labels */}
        {doc.top_2_labels && doc.top_2_labels.length > 1 && (
          <div className="mb-12">
            <h2 className="text-lg font-semibold text-ink mb-3">
              Alternative Classifications
            </h2>
            <p className="text-[13px] text-[#86868B] mb-3">
              The classifier also considered the following labels:
            </p>
            <div className="flex flex-wrap gap-2">
              {doc.top_2_labels
                .filter((l) => l !== doc.final_label)
                .map((l) => (
                  <ClassBadge key={l} label={l} size="sm" />
                ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
