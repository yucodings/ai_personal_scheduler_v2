"use client";

import { useMemo, useState } from "react";
import { Archive, Loader2, Search } from "lucide-react";
import { useApp } from "@/components/providers/app-provider";
import { ProjectCard } from "@/components/projects/project-card";
import { Input } from "@/components/ui/field";

export default function ArchivedProjectsPage() {
  const { projects, restoreProject, loading, error } = useApp();
  const [query, setQuery] = useState("");
  const archived = useMemo(() => projects
    .filter((project) => project.status === "archived")
    .filter((project) => `${project.title} ${project.description}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, query]);

  return <div className="space-y-6">
    <div><p className="text-sm font-semibold text-sky-700">Portfolio</p><h1 className="mt-1 text-3xl font-semibold tracking-tight">Archived projects</h1><p className="mt-2 text-slate-500">Projects kept for reference. Restore one whenever you want to continue working on it.</p></div>
    <label className="relative block max-w-2xl"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input aria-label="Search archived projects" className="bg-white pl-10" placeholder="Search archived projects…" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
    {loading ? <div className="grid place-items-center py-20 text-slate-500"><Loader2 className="mb-3 h-6 w-6 animate-spin" /><p>Loading archived projects…</p></div> : null}
    {!loading && error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-800"><strong>Archive could not load.</strong><p className="mt-1">{error}</p></div> : null}
    {!loading && !error && archived.length ? <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">{archived.map((project) => <ProjectCard key={project.id} project={project} archived onArchive={() => void restoreProject(project.id)} />)}</div> : null}
    {!loading && !error && !archived.length ? <div className="rounded-3xl border border-dashed border-slate-300 py-20 text-center"><Archive className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 font-semibold">{query ? "No archived projects match your search." : "No archived projects yet."}</p><p className="mt-1 text-sm text-slate-500">Archived projects will appear here and can be restored.</p></div> : null}
  </div>;
}
