import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { can, ownerScope } from "@/lib/permissions";
import { escapeRegex } from "@/lib/pagination";
import { todayISO } from "@/lib/dates";
import { dayRange, periodRange } from "@/lib/sales-range";
import { LEAD_SOURCES, LEAD_STAGES, Lead } from "@/models/lead";

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

/** The lead register as a CSV file, with the same search, stage, salesperson and date filters as the list. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "leads.export")) return new NextResponse("Not allowed", { status: 403 });
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const { range } = periodRange(params, todayISO());
  const own = user.role === "superadmin" && params.own === "1";
  const filter: Record<string, unknown> = { ...ownerScope(user), ...(own ? { owner: user.username } : {}) };
  if (LEAD_STAGES.includes(params.status as never)) filter.status = params.status;
  if (LEAD_SOURCES.includes(params.source as never)) filter.source = params.source;
  if (user.role === "superadmin" && !own && range.seller) filter.owner = range.seller;
  const created = dayRange(range);
  if (created) filter.date = created;
  if (params.q) {
    const rx = new RegExp(escapeRegex(params.q.trim()), "i");
    filter.$or = [{ business: rx }, { leadId: rx }, { phone: rx }, { clientCode: rx }];
  }

  await connectDb();
  const rows = await Lead.find(filter).select("leadId date business phone email address service source status next clientCode owner").sort({ createdAt: -1 }).limit(5000).lean();
  const head = ["Lead ID", "Date", "Business", "Phone", "Email", "Address", "Service", "Source", "Stage", "Next follow-up", "Client code", "Owner"];
  const lines = [head, ...rows.map((r) => [r.leadId, r.date, r.business, r.phone, r.email, r.address, r.service, r.source, r.status, r.next, r.clientCode, r.owner])].map((row) => row.map(cell).join(","));
  return new NextResponse(`﻿${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="lead-register.csv"', "Cache-Control": "no-store" } });
}
