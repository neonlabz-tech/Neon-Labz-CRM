import { redirect } from "next/navigation";
import { ActionForm } from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { requireUser } from "@/lib/auth";
import { changePasswordAction } from "@/server/auth-actions";
import { PasswordField } from "@/components/auth/password-field";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  if (!user.mustChangePassword) redirect("/dashboard");
  return (
    <>
      <h1 className="text-xl font-bold">Choose your own password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Your password was set by someone else. Pick a new one with at least 8 characters before you continue.</p>
      <ActionForm action={changePasswordAction} submit="Save and continue" toastOnSuccess={false}>
                  <>
            <PasswordField label="Current password" name="current" autoComplete="current-password" required />
            <PasswordField label="New password" name="next" autoComplete="new-password" required />
            <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" required />
          </>
      </ActionForm>
    </>
  );
}
