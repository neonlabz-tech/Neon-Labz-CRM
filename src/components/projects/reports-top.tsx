import { AccessBar } from "@/components/projects/access-bar";
import { User } from "@/models/user";

/** The Super Admin's account picker above the report lists. */
export async function ReportsTop({ own, pm }: { own: boolean; pm: string }) {
  const accounts = own ? [] : await User.find({ role: "pm" }).select("username fullName").sort({ username: 1 }).lean();
  return (
    <>
      <AccessBar own={own} editable pm={pm} path="/reports" accounts={accounts.map((a) => ({ username: a.username, label: a.fullName || a.username }))} />
    </>
  );
}
