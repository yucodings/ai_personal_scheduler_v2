"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Pencil, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Priority, Project, ProjectStatus, ProjectType } from "@/lib/types";

export function EditProjectDialog({
  project,
  open,
  onOpenChange,
}: {
  project: Project;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { editProject } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const startDate = String(data.get("startDate"));
    const finalDeadline = String(data.get("finalDeadline"));
    const internalDeadline = String(data.get("internalDeadline"));
    if (finalDeadline < startDate) {
      setError("Final deadline must be on or after the start date.");
      return;
    }
    if (internalDeadline && (internalDeadline < startDate || internalDeadline > finalDeadline)) {
      setError("Internal deadline must be between the start date and final deadline.");
      return;
    }

    setSaving(true);
    try {
      await editProject(project.id, {
        title: String(data.get("title")).trim(),
        projectType: String(data.get("projectType")) as ProjectType,
        description: String(data.get("description")).trim(),
        status: String(data.get("status")) as ProjectStatus,
        priority: String(data.get("priority")) as Priority,
        startDate,
        finalDeadline,
        internalDeadline: internalDeadline || undefined,
        estimatedTotalHours: Number(data.get("hours")),
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Project details could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog.Root open={open} onOpenChange={(nextOpen) => {
    if (nextOpen) setError("");
    onOpenChange(nextOpen);
  }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/45 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between">
          <div><Dialog.Title className="text-2xl font-semibold">Edit project</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">Update the project name, type, scope, dates, priority, and effort.</Dialog.Description></div>
          <Dialog.Close className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close>
        </div>
        <form key={project.updatedAt} className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <div className="sm:col-span-2"><Label htmlFor="edit-title">Project title</Label><Input id="edit-title" name="title" required minLength={2} maxLength={160} defaultValue={project.title} /></div>
          <div><Label htmlFor="edit-project-type">Project type</Label><Select id="edit-project-type" name="projectType" className="w-full" defaultValue={project.projectType}><option value="subject">Subject</option><option value="assignment">Assignment</option><option value="examination">Examination preparation</option><option value="competition">Competition</option><option value="hackathon">Hackathon</option><option value="final_year_project">Final-year project</option><option value="internship">Internship</option><option value="event">Event</option><option value="personal">Personal project</option><option value="other">Other</option></Select></div>
          <div><Label htmlFor="edit-status">Status</Label><Select id="edit-status" name="status" className="w-full" defaultValue={project.status}><option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option>{project.status === "archived" ? <option value="archived">Archived</option> : null}</Select></div>
          <div><Label htmlFor="edit-priority">Priority</Label><Select id="edit-priority" name="priority" className="w-full" defaultValue={project.priority}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select></div>
          <div><Label htmlFor="edit-hours">Estimated total hours</Label><Input id="edit-hours" name="hours" type="number" min="0" max="10000" step="0.5" defaultValue={project.estimatedTotalHours} /></div>
          <div><Label htmlFor="edit-start-date">Start date</Label><Input id="edit-start-date" name="startDate" type="date" required defaultValue={project.startDate} /></div>
          <div><Label htmlFor="edit-final-deadline">Final deadline</Label><Input id="edit-final-deadline" name="finalDeadline" type="date" required defaultValue={project.finalDeadline} /></div>
          <div><Label htmlFor="edit-internal-deadline">Internal deadline</Label><Input id="edit-internal-deadline" name="internalDeadline" type="date" defaultValue={project.internalDeadline ?? ""} /></div>
          <div className="sm:col-span-2"><Label htmlFor="edit-description">Project description and success criteria</Label><Textarea id="edit-description" name="description" maxLength={5000} defaultValue={project.description} /></div>
          {error ? <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5 sm:col-span-2"><Dialog.Close asChild><Button type="button" variant="secondary">Cancel</Button></Dialog.Close><Button type="submit" disabled={saving}>{saving ? "Saving…" : <><Pencil className="h-4 w-4" />Save changes</>}</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
