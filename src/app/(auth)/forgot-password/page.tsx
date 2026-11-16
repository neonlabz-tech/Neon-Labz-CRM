import Link from "next/link";
import { ActionForm } from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { forgotPasswordAction } from "@/server/auth-actions";

export const metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-xl font-bold">Reset your password</h1>
      <p className="mb-6 mt-1 text-sm text-muted">
        Super Admin: enter your email and we will send a link. Everyone else: enter your username and the Super Admin will give you a temporary password.
      </p>
      <ActionForm action={forgotPasswordAction} submit="Send request" toastOnSuccess={false}>
        <Field label="Username or email" name="identifier" required />
      </ActionForm>
      <Link href="/login" className="mt-5 block text-center text-sm font-medium text-brand-700 hover:underline">Back to sign in</Link>
    </>
  );
}
