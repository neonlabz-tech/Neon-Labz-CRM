import { SalesSetting, SalesTarget } from "@/models/sales-target";

type Goals = { target: number; rate: number; leads: number; calls: number };

/** Company defaults, or zeros before the Super Admin has saved any. */
export async function companyGoals() {
  const saved = await SalesSetting.findOne({ key: "sales" }).select("monthlyTarget monthlyConversions dailyLeads dailyCalls defaultRate").lean();
  return { monthlyTarget: saved?.monthlyTarget ?? 0, monthlyConversions: saved?.monthlyConversions ?? 0, dailyLeads: saved?.dailyLeads ?? 0, dailyCalls: saved?.dailyCalls ?? 0, defaultRate: saved?.defaultRate ?? 0 };
}

/** A salesperson's own numbers; any left at zero fall back to the company defaults. */
export async function goalsFor(username: string): Promise<Goals> {
  const [own, company] = await Promise.all([SalesTarget.findOne({ username }).select("target rate dailyLeads dailyCalls").lean(), companyGoals()]);
  return {
    target: own?.target || company.monthlyTarget,
    rate: own?.rate || company.defaultRate,
    leads: own?.dailyLeads || company.dailyLeads,
    calls: own?.dailyCalls || company.dailyCalls,
  };
}

/** The monthly target scaled to the chosen period: one month, twelve for a whole year, none for "all". */
export function periodTarget(monthly: number, year: string, month: string): number {
  if (!year) return 0;
  return month ? monthly : monthly * 12;
}

/** Only the target fixed for this person. Unlike goalsFor, it never falls back to the company default; 0 means "not fixed". */
export async function personalTarget(username: string): Promise<number> {
  const own = await SalesTarget.findOne({ username }).select("target").lean();
  return own?.target ?? 0;
}
