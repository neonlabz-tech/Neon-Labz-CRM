import { Card, EmptyState, PageHeader } from "@/components/ui/card";
import { Field, SelectField, TextareaField } from "@/components/ui/field";
import { ActionForm } from "@/components/ui/form";
import { requireAction } from "@/lib/auth";
import { connectDb } from "@/lib/db";
import { ownView } from "@/lib/own";
import { param, type SearchParams } from "@/lib/pagination";
import { backfillWorkTypes } from "@/lib/client-work";
import { clientWorkFilter, workTypeOfClient } from "@/lib/work-type";
import Link from "next/link";
import { Client } from "@/models/client";
import { createProjectAction } from "@/server/project-actions";

export const metadata = { title: "New project" };

const TYPES = {
  superadmin: [["software", "Software"], ["marketing", "Marketing"], ["both", "Software and marketing"]],
  pm: [["software", "Software"], ["both", "Software and marketing"]],
  marketing: [["marketing", "Marketing"]],
} as const;

export default async function NewProjectPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await requireAction("projects.manage");
  const chosen = param(await searchParams, "client");
  await backfillWorkTypes();
  await connectDb();
  const own = ownView(user.role, await searchParams);
  const clients = await Client.find({ $and: [clientWorkFilter(user.role), ...(own ? [{ salesOwner: user.username }] : [{ ownOnly: { $ne: true } }])] }).select("code name workType service").sort({ name: 1 }).limit(500).lean();
  const types = TYPES[user.role as keyof typeof TYPES] ?? [];

  return (
    <>
      <PageHeader title="New project" subtitle="Only clients whose payment was approved can have a project." />
      <p className="mb-4 text-sm text-muted">
        Create the project first. Then {user.role === "superadmin" || user.role === "pm"
          ? <>open <Link href="/reports/proposals" className="font-semibold text-brand-700 hover:underline">Reports → Proposals</Link> and choose this project to prepare its proposal.</>
          : "ask the Project Manager or Super Admin to open Reports → Proposals and choose this project."}
      </p>
      {clients.length === 0 ? (
        <EmptyState title="No clients yet" text={own ? "A client appears here once one of your own leads is converted and its payment is confirmed." : "A client appears here after the Super Admin approves their payment."} />
      ) : (
        <Card>
          <ActionForm action={createProjectAction} submit="Create project" toastOnSuccess={false} className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Client" name="clientCode" defaultValue={chosen} required>
              <option value="" disabled>Choose a client</option>
              {clients.map((c) => <option key={c.code} value={c.code}>{c.name} ({c.code}) · {workTypeOfClient(c)}</option>)}
            </SelectField>
            <SelectField label="Type of project" name="type" defaultValue={types[0]?.[0]}>
              {types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </SelectField>
            <div className="sm:col-span-2"><Field label="Project name" name="name" required /></div>
            <Field label="Start" name="startDate" type="date" required />
            <Field label="Due" name="dueDate" type="date" required />
            <div className="sm:col-span-2"><TextareaField label="Description" name="description" /></div>
          </ActionForm>
        </Card>
      )}
    </>
  );
}
