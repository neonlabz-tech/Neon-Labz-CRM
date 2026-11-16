"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shown when a page fails. The details stay in the server log. */
export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="grid min-h-[60vh] place-items-center px-4">
      <div className="max-w-md text-center">
        <p className="brand-gradient mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl font-bold text-white">!</p>
        <h1 className="mt-5 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted">This page could not be loaded. Your work was not lost. Try again, and if it keeps happening tell the Super Admin.</p>
        <Button onClick={reset} className="mt-6"><RotateCcw className="h-4 w-4" />Try again</Button>
      </div>
    </main>
  );
}
