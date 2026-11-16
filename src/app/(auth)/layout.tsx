import Image from "next/image";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d0a1f] px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full bg-brand-600/35 blur-[120px]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-40 -right-32 h-[26rem] w-[26rem] rounded-full bg-magenta/25 blur-[120px]" />
      <div className="auth-dark relative w-full max-w-md">
        <div className="mb-7 flex flex-col items-center gap-4">
          <Image src="/logo-white.png" alt="NeonLabz" width={220} height={24} priority className="h-6 w-auto" />
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">{children}</div>
      </div>
    </main>
  );
}
