import { redirect } from "next/navigation";

/** Quotations live under Sales now; keep old links working. */
export default function PackageQuotationsRedirect() {
  redirect("/quotations");
}
