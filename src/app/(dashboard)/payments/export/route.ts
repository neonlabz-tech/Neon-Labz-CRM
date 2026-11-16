import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { can } from "@/lib/permissions";
import { escapeRegex } from "@/lib/pagination";
import { Invoice } from "@/models/invoice";
import { Payment } from "@/models/payment";

const cell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""').replace(/^([=+\-@])/, "'$1")}"`;

/** The payments list as a CSV file, with the same search and status filters as the page. */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "payments.export")) return new NextResponse("Not allowed", { status: 403 });
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const status = request.nextUrl.searchParams.get("status") ?? "";
  const filter: Record<string, unknown> = { owner: user.username };
  if (["pending", "confirmed", "cancelled"].includes(status)) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q.trim()), "i");
    filter.$or = [{ clientName: rx }, { saleCode: rx }, { clientCode: rx }];
  }

  await connectDb();
  const rows = await Payment.find(filter).select("saleCode clientName clientCode amount date type method transactionId status").sort({ createdAt: -1 }).limit(5000).lean();
  const invoices = await Invoice.find({ paymentId: { $in: rows.map((r) => r._id) } }).select("paymentId receiptNo").lean();
  const receipt = new Map(invoices.map((i) => [String(i.paymentId), i.receiptNo]));
  const head = ["Date", "Client", "Client code", "Sale ID", "Receipt", "Type", "Method", "Transaction no.", "Amount", "Status"];
  const lines = [head, ...rows.map((r) => [r.date, r.clientName, r.clientCode, r.saleCode, receipt.get(String(r._id)) ?? "", r.type, r.method, r.transactionId, r.amount, r.status])].map((row) => row.map(cell).join(","));
  return new NextResponse(`﻿${lines.join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="payments.csv"', "Cache-Control": "no-store" } });
}
