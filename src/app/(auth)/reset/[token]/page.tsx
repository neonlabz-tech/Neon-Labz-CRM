import { ActionForm } from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { resetPasswordAction } from "@/server/auth-actions";
import { PasswordField } from "@/components/auth/password-field";

export const metadata = { title: "Set new password" };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="text-xl font-bold">Set a new password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">Use at least 8 characters.</p>
      <ActionForm action={resetPasswordAction} submit="Save password" toastOnSuccess={false}>
                  <>
            <input type="hidden" name="token" value={token} />
            <PasswordField label="New password" name="next" autoComplete="new-password" required />
            <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" required />
          </>
      </ActionForm>
    </>
  );
}
