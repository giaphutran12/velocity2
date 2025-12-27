import { NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export async function GET() {
  const supabase = getSupabase();

  const tables = [
    "vl_deals",
    "vl_borrowers",
    "vl_borrower_addresses",
    "vl_borrower_employment",
    "vl_borrower_liabilities",
    "vl_borrower_assets",
    "vl_borrower_properties",
    "vl_subject_properties",
    "vl_mortgage_requests",
    "vl_mortgages",
    "vl_conditions",
    "vl_notes",
  ];

  const counts: Record<string, number> = {};

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    counts[table] = count ?? 0;
  }

  // Get deal details
  const { data: deals } = await supabase
    .from("vl_deals")
    .select("loan_code, agent, status_code, date_created")
    .order("date_created", { ascending: false })
    .limit(10);

  return NextResponse.json({
    counts,
    total_records: Object.values(counts).reduce((a, b) => a + b, 0),
    recent_deals: deals,
  });
}
