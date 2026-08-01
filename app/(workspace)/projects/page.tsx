"use client";

import { useMemo, useState } from "react";
import { Filter, Loader2, Plus, Search } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { CreateProjectDialog } from "@/components/projects/create-project-dialog";
import { ProjectCard } from "@/components/projects/project-card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";

export default function ProjectsPage() {
  const { projects, archiveProject, setActiveProject, loading, error } = useApp();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("all");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("deadline");
  const [open, setOpen] = useState(false);
  const activeProjects = useMemo(() => projects.filter((project) => project.status !== "archived"), [projects]);
  const filtered = useMemo(() => activeProjects
    .filter((project) => (status === "all" || project.status === status)
      && (risk === "all" || project.riskStatus === risk)
      && `${project.title} ${project.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => sort === "deadline" ? a.finalDeadline.localeCompare(b.finalDeadline)
      : sort === "progress" ? b.displayedProgress - a.displayedProgress
        : sort === "priority" ? ["critical", "high", "medium", "low"].indexOf(a.priority) - ["critical", "high", "medium", "low"].indexOf(b.priority)
          : b.updatedAt.localeCompare(a.updatedAt)), [activeProjects, query, risk, status, sort]);

  return <div className="space-y-6">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-sm font-semibold text-sky-700">Portfolio</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Projects</h1><p className="mt-2 text-slate-500">Deadlines, progress, and risk—stored in your Supabase project.</p></div>
      <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Create project</Button>
    </div>
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 lg:flex-row">
      <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Search projects" className="border-0 bg-slate-50 pl-10 focus:ring-0" placeholder="Search title or description…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
      <div className="flex flex-wrap gap-2"><div className="flex items-center gap-2 px-2 text-sm text-slate-400"><Filter className="h-4 w-4" />Filters</div><Select aria-label="Status filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">All status</option><option value="active">Active</option><option value="planned">Planned</option><option value="paused">Paused</option><option value="completed">Completed</option></Select><Select aria-label="Risk filter" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="all">All risk</option><option value="on_track">On track</option><option value="at_risk">At risk</option><option value="delayed">Delayed</option><option value="blocked">Blocked</option></Select><Select aria-label="Sort projects" value={sort} onChange={(event) => setSort(event.target.value)}><option value="deadline">Deadline</option><option value="progress">Progress</option><option value="priority">Priority</option><option value="updated">Recently updated</option></Select></div>
    </div>
    {loading && <div className="grid place-items-center py-20 text-slate-500"><Loader2 className="mb-3 h-6 w-6 animate-spin" /><p>Loading your Supabase workspace…</p></div>}
    {!loading && error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><strong>Workspace could not load.</strong><p className="mt-1">{error}</p></div>}
    {!loading && !error && filtered.length > 0 && <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{filtered.map((project) => <ProjectCard key={project.id} project={project} onArchive={() => void archiveProject(project.id)} onActivate={() => void setActiveProject(project.id)} />)}</div>}
    {!loading && !error && filtered.length === 0 && <div className="rounded-3xl border border-dashed border-slate-300 py-20 text-center"><p className="font-semibold">{activeProjects.length ? "No projects match these filters." : "Your active workspace is empty."}</p><p className="mt-1 text-sm text-slate-500">{activeProjects.length ? "Try clearing a filter." : "Create a project here, or restore one from Archived."}</p></div>}
    <CreateProjectDialog open={open} onOpenChange={setOpen} />
  </div>;
}
