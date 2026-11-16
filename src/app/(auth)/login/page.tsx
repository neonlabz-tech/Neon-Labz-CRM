import Link from "next/link";
import { ActionForm } from "@/components/ui/form";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { loginAction } from "@/server/auth-actions";

export const metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <h1 className="text-center text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-center text-sm text-muted">Sign in with the username given to you, such as EMP_001.</p>
      <ActionForm action={loginAction} submit="Sign in" toastOnSuccess={false}>
        <>
          <Field label="Username" name="username" autoComplete="username" autoCapitalize="characters" required />
          <PasswordField dark label="Password" name="password" autoComplete="current-password" required />
        </>
      </ActionForm>
      <Link prefetch={false} href="/forgot-password" className="mt-5 block text-right text-sm font-medium text-brand-700 hover:underline">Forgot your password?</Link>
    </>
  );
}
