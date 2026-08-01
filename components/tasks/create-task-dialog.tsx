"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useState } from "react";
import { Plus, X } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { Button } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import type { Priority } from "@/lib/types";

export function CreateTaskDialog({
  projectId,
  sequence,
  open,
  onOpenChange,
}: {
  projectId: string;
  sequence: number;
  open: boolean;
  onOpenChange(open: boolean): void;
}) {
  const { addTask } = useApp();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const plannedStart = String(data.get("plannedStart"));
    const dueDate = String(data.get("dueDate"));
    if (plannedStart && dueDate && dueDate < plannedStart) {
      setError("Task due date must be on or after its planned start date.");
      return;
    }

    setSaving(true);
    try {
      await addTask({
        projectId,
        title: String(data.get("title")).trim(),
        description: String(data.get("description")).trim(),
        priority: String(data.get("priority")) as Priority,
        estimatedHours: Number(data.get("estimatedHours")),
        effortWeight: Number(data.get("effortWeight")),
        plannedStart: plannedStart || undefined,
        dueDate: dueDate || undefined,
        sequence,
      });
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Task could not be created.");
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
      <Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between"><div><Dialog.Title className="text-2xl font-semibold">Add task</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">Create a real task in this project. You can update its status and progress afterwards.</Dialog.Description></div><Dialog.Close className="rounded-lg p-2 hover:bg-slate-100" aria-label="Close"><X className="h-5 w-5" /></Dialog.Close></div>
        <form className="mt-7 grid gap-5 sm:grid-cols-2" onSubmit={(event) => void submit(event)}>
          <div className="sm:col-span-2"><Label htmlFor="task-title">Task title</Label><Input id="task-title" name="title" required minLength={2} maxLength={240} placeholder="e.g. Draft business model canvas" /></div>
          <div><Label htmlFor="task-priority">Priority</Label><Select id="task-priority" name="priority" className="w-full" defaultValue="medium"><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="critical">Critical</option></Select></div>
          <div><Label htmlFor="task-hours">Estimated hours</Label><Input id="task-hours" name="estimatedHours" type="number" min="0" max="10000" step="0.5" defaultValue="1" /></div>
          <div><Label htmlFor="task-start">Planned start</Label><Input id="task-start" name="plannedStart" type="date" /></div>
          <div><Label htmlFor="task-due">Due date</Label><Input id="task-due" name="dueDate" type="date" /></div>
          <div><Label htmlFor="task-weight">Progress weight</Label><Input id="task-weight" name="effortWeight" type="number" min="0.1" max="1000" step="0.1" defaultValue="1" /></div>
          <div className="sm:col-span-2"><Label htmlFor="task-description">Description</Label><Textarea id="task-description" name="description" maxLength={10000} placeholder="What needs to be completed?" /></div>
          {error ? <p role="alert" className="text-sm text-rose-600 sm:col-span-2">{error}</p> : null}
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-5 sm:col-span-2"><Dialog.Close asChild><Button type="button" variant="secondary">Cancel</Button></Dialog.Close><Button type="submit" disabled={saving}>{saving ? "Adding…" : <><Plus className="h-4 w-4" />Add task</>}</Button></div>
        </form>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
