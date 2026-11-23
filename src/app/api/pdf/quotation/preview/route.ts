import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { quotationAssets } from "@/lib/pdf/store";
import { quotationHtml } from "@/lib/pdf/documents";
import { can, ownerScope } from "@/lib/permissions";
import { quoteFigures, round2 } from "@/lib/money";
import { cleanRich, richHasText } from "@/lib/rich-text";
import { Lead } from "@/models/lead";
import { Package } from "@/models/package";
import { quotationSchema } from "@/schemas/quotation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "quotations.manage")) return NextResponse.json({ message: "Please sign in with quotation access." }, { status: 401 });

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ message: "Quotation preview data is invalid." }, { status: 400 });
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return NextResponse.json({ message: "Quotation preview data is invalid." }, { status: 400 });
  const body = raw as Record<string, unknown>;
  const parsed = quotationSchema.safeParse({
    leadId: String(body.leadId ?? ""),
    date: String(body.date ?? ""),
    valid: String(body.valid ?? ""),
    discount: body.discount,
    terms: String(body.terms ?? ""),
    lines: typeof body.lines === "string" ? body.lines : JSON.stringify(body.lines ?? []),
  });
  if (!parsed.success) return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Check the quotation details." }, { status: 400 });

  try {
    await connectDb();
    const lead = await Lead.findOne({ leadId: parsed.data.leadId, ...ownerScope(user) }).select("business address email phone").lean();
    if (!lead) return NextResponse.json({ message: "Lead not found." }, { status: 404 });

    const ids = parsed.data.lines.map((line) => line.packageId).filter((id) => id !== "custom");
    const packages = await Package.find({ _id: { $in: ids } }).select("name category duration icon").lean();
    const items = [];
    for (const line of parsed.data.lines) {
      const custom = line.packageId === "custom";
      const pkg = packages.find((candidate) => String(candidate._id) === line.packageId);
      if (!custom && !pkg) return NextResponse.json({ message: "Choose an available package on every line." }, { status: 400 });
      const name = custom ? line.customName : pkg!.name;
      if (!name || !richHasText(line.scope)) return NextResponse.json({ message: "Every package needs a title and scope." }, { status: 400 });
      items.push({
        packageName: name,
        service: custom ? "" : pkg!.category,
        period: custom ? "Custom quotation" : pkg!.duration,
        icon: custom ? line.icon : pkg!.icon,
        price: round2(line.price),
        scope: cleanRich(line.scope),
      });
    }

    const figures = quoteFigures(items.reduce((sum, item) => sum + item.price, 0), parsed.data.discount);
    const html = await quotationHtml({
      number: "PREVIEW",
      client: lead.business,
      address: lead.address,
      email: lead.email,
      phone: lead.phone,
      date: parsed.data.date,
      valid: parsed.data.valid,
      items,
      subtotal: figures.subtotal,
      discountPercent: figures.discountPercent,
      discount: figures.discount,
      total: figures.total,
      terms: richHasText(parsed.data.terms) ? cleanRich(parsed.data.terms) : "As agreed with the client.",
    }, await quotationAssets());
    return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store" } });
  } catch (error) {
    console.error("Quotation preview failed", error);
    return NextResponse.json({ message: "Could not open the quotation preview." }, { status: 500 });
  }
}
