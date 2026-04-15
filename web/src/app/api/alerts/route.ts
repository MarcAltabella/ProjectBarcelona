import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@/lib/supabase";

export async function GET(request: NextRequest) {
  const supabase = createServerClient();
  const params = request.nextUrl.searchParams;

  const severity = params.get("severity");
  const alertType = params.get("type");
  const study = params.get("study");
  const documentClass = params.get("class");

  let query = supabase.from("alerts_sidebar_v").select("*");

  if (severity) query = query.eq("severity", severity);
  if (alertType) query = query.eq("alert_type", alertType);
  if (study) query = query.eq("study_code", study);
  if (documentClass) query = query.eq("final_label", documentClass);

  query = query.order("severity", { ascending: false });

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ alerts: data ?? [] });
}
