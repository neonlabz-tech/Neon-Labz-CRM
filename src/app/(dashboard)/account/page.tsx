import { Card, PageHeader } from "@/components/ui/card";
import { ActionForm } from "@/components/ui/form";
import { requireUser } from "@/lib/auth";
import { changePasswordAction } from "@/server/auth-actions";
import { PasswordField } from "@/components/auth/password-field";

export const metadata = { title: "My account" };

export default async function AccountPage() {
  const me = await requireUser();

  return (
    <>
      <PageHeader title="My account" subtitle={`Signed in as ${me.username}`} />
      <div className="max-w-xl">
        <Card>
          <h2 className="mb-4 font-semibold">Change password</h2>
          <ActionForm action={changePasswordAction} submit="Change password" resetOnSuccess>
                          <>
                <PasswordField label="Current password" name="current" autoComplete="current-password" required />
                <PasswordField label="New password" name="next" autoComplete="new-password" required />
                <PasswordField label="Confirm new password" name="confirm" autoComplete="new-password" required />
              </>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}
