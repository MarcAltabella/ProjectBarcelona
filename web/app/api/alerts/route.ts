import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_ALERTS } from "@/lib/toy-data"
import type { Alert } from "@/lib/types"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const severity = searchParams.get("severity")
  const studyId = searchParams.get("studyId")
  const documentClass = searchParams.get("documentClass")
  const alertType = searchParams.get("alertType")

  if (!isSupabaseConfigured()) {
    let alerts = TOY_ALERTS
    if (severity) alerts = alerts.filter((alert) => alert.severity === severity)
    if (documentClass) {
      alerts = alerts.filter((alert) => alert.final_label === documentClass)
    }
    if (alertType) alerts = alerts.filter((alert) => alert.alert_type === alertType)
    if (studyId) alerts = alerts.filter((alert) => alert.study_code === studyId)
    return NextResponse.json(alerts)
  }

  const supabase = createServiceClient()
  let query = supabase
    .from("alerts_sidebar_v")
    .select("*")
    .order("severity", { ascending: true })

  if (severity) query = query.eq("severity", severity)
  if (documentClass) query = query.eq("final_label", documentClass)
  if (alertType) query = query.eq("alert_type", alertType)

  const { data: viewRows, error: viewError } = await query

  if (!viewError && viewRows) {
    const alerts: Alert[] = viewRows
      .filter((row) => {
        if (!studyId) return true
        return row.study_code === studyId || row.study_id === studyId
      })
      .map((row) => ({
        id: String(row.alert_id ?? row.id),
        document_id: String(row.document_id),
        file_name: row.file_name ? String(row.file_name) : undefined,
        alert_type: row.alert_type as Alert["alert_type"],
        severity: row.severity as Alert["severity"],
        title: String(row.title),
        description: String(row.description),
        study_code: row.study_code ? String(row.study_code) : undefined,
        final_label: row.final_label as Alert["final_label"],
      }))

    return NextResponse.json(alerts)
  }

  let rawQuery = supabase
    .from("alerts")
    .select("id, document_id, alert_type, severity, title, description, status")
    .eq("status", "open")
    .order("severity", { ascending: true })

  if (severity) rawQuery = rawQuery.eq("severity", severity)
  if (alertType) rawQuery = rawQuery.eq("alert_type", alertType)

  const { data: rawAlerts } = await rawQuery

  return NextResponse.json(rawAlerts ?? [])
}
