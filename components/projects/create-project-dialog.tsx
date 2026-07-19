"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Priority, ProjectType } from "@/lib/types";

export function CreateProjectDialog({ open, onOpenChange }: { open: boolean; onOpenChange(open: boolean): void }) {
  const { addProject } = useApp();
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDate"));
    const finalDeadline = String(data.get("finalDeadline"));
    const internalDeadline = String(data.get("internalDeadline"));
    if (finalDeadline < startDate) {
      setError("Final deadline must be after the start date.");
      return;
    }
    setSaving(true);
    try {
      await addProject({
        title: String(data.get("title")),
        projectType: String(data.get("projectType")) as ProjectType,
        description: String(data.get("description")),
        priority: String(data.get("priority")) as Priority,
        startDate,
        finalDeadline,
        internalDeadline,
        estimatedTotalHours: Number(data.get("hours")),
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project could not be created.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog.Root open={open} onOpenChange={onOpenChange}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between">
          <div>
            <Dialog.Title className="text-2xl font-semibold">Create a project</Dialog.Title>
            <Dialog.Description className="mt-1 text-sm text-slate-500">Start with the deadline and scope. Files and AI planning come next.</Dialog.Description>
          </div>
          <Dialog.Close className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
        </div>
        <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <div className="sm:col-span-2"><Label htmlFor="title">Project title</Label><Input id="title" name="title" required minLength={2} placeholder="e.g. Robotics Innovation Challenge" /></div>
          <div><Label htmlFor="projectType">Project type</Label><Select id="projectType" name="projectType" className="w-full" defaultValue="assignment"><option value="subject">Subject</option><option value="assignment">Assignment</option><option value="examination">Examination preparation</option><option value="competition">Competition</option><option value="hackathon">Hackathon</option><option value="final_year_project">Final-year project</option><option value="internship">Internship</option><option value="event">Event</option><option value="personal">Personal project</option><option value="other">Other</option></Select></div>
          <div><Label htmlFor="priority">Priority</Label><Select id="priority" name="priority" className="w-full" defaultValue="high"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select></div>
          <div><Label htmlFor="startDate">Start date</Label><Input id="startDate" name="startDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
          <div><Label htmlFor="finalDeadline">Final deadline</Label><Input id="finalDeadline" name="finalDeadline" type="date" required /></div>
          <div><Label htmlFor="internalDeadline">Internal deadline</Label><Input id="internalDeadline" name="internalDeadline" type="date" /></div>
          <div><Label htmlFor="hours">Estimated total hours</Label><Input id="hours" name="hours" type="number" min="0" step="0.5" defaultValue="24" /></div>
          <div className="sm:col-span-2"><Label htmlFor="description">What does success look like?</Label><Textarea id="description" name="description" placeholder="Deliverables, constraints, context…" /></div>
          {error && <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p>}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5 sm:col-span-2"><Dialog.Close asChild><Button type="button" variant="secondary">Cancel</Button></Dialog.Close><Button type="submit" disabled={saving}>{saving ? "Creating…" : "Create project"}</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
