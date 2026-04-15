import { NextResponse } from "next/server"
import { createServiceClient, isSupabaseConfigured } from "@/lib/supabase"
import { TOY_ALERTS } from "@/lib/toy-data"

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const severity = searchParams.get("severity")
  const studyId = searchParams.get("studyId")
  const documentClass = searchParams.get("documentClass")
  const alertType = searchParams.get("alertType")

  // ── Toy data path ──────────────────────────────────────────────────
  if (!isSupabaseConfigured()) {
    let alerts = TOY_ALERTS
    if (severity) alerts = alerts.filter((a) => a.severity === severity)
    if (documentClass) alerts = alerts.filter((a) => a.final_label === documentClass)
    if (alertType) alerts = alerts.filter((a) => a.alert_type === alertType)
    if (studyId) alerts = alerts.filter((a) => a.study_code === studyId)
    return NextResponse.json(alerts)
  }

  // ── Supabase path ──────────────────────────────────────────────────
  const supabase = createServiceClient()

  let query = supabase
    .from("alerts_sidebar_v")
    .select("*")
    .order("severity", { ascending: true })

  if (severity) query = query.eq("severity", severity)
  if (studyId) query = query.eq("study_id", studyId)
  if (documentClass) query = query.eq("final_label", documentClass)
  if (alertType) query = query.eq("alert_type", alertType)

  const { data: viewRows, error: viewError } = await query

  if (!viewError && viewRows) {
    return NextResponse.json(viewRows)
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
