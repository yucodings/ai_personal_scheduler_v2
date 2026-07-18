"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { AiProposal, ChatMessage, DocumentRecord, Project, Task } from "@/lib/types";
import * as demo from "@/lib/mock-data";

type NewProject = Pick<Project, "title" | "projectType" | "description" | "priority" | "startDate" | "finalDeadline" | "estimatedTotalHours"> & { internalDeadline?: string };
interface AppState {
  projects: Project[]; tasks: Task[]; documents: DocumentRecord[]; proposals: AiProposal[]; messages: ChatMessage[];
  activeProject: Project | undefined; setActiveProject(id: string): void; addProject(input: NewProject): Project; archiveProject(id: string): void;
  updateTask(id: string, progress: number, status?: Task["status"], blocker?: string): void; setManualProgress(projectId: string, value: number | null): void;
  addDocument(record: DocumentRecord): void; reviewProposal(id: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string): void;
  sendMessage(content: string, projectId?: string): void;
}
const Context = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<Project[]>(demo.projects); const [tasks, setTasks] = useState<Task[]>(demo.tasks); const [documents, setDocuments] = useState<DocumentRecord[]>(demo.documents); const [proposals, setProposals] = useState<AiProposal[]>(demo.proposals); const [messages, setMessages] = useState<ChatMessage[]>(demo.chatMessages);
  const activeProject = projects.find((project) => project.isActiveContext) ?? projects[0];
  function setActiveProject(id: string) { setProjects((current) => current.map((project) => ({ ...project, isActiveContext: project.id === id }))); }
  function addProject(input: NewProject) { const project: Project = { ...input, id: crypto.randomUUID(), status: "planned", internalDeadline: input.internalDeadline || undefined, calculatedProgress: 0, manualProgress: null, displayedProgress: 0, expectedProgress: 0, progressVariance: 0, riskStatus: "on_track", riskReason: "Planning has not started yet.", isActiveContext: false, updatedAt: new Date().toISOString() }; setProjects((current) => [project, ...current]); return project; }
  function archiveProject(id: string) { setProjects((current) => current.map((project) => project.id === id ? { ...project, status: "archived" } : project)); }
  function updateTask(id: string, progress: number, status?: Task["status"], blocker?: string) { setTasks((current) => current.map((task) => task.id === id ? { ...task, progressPercent: Math.max(0, Math.min(100, progress)), status: status ?? (progress >= 100 ? "completed" : progress > 0 ? "in_progress" : "not_started"), blockedReason: blocker } : task)); }
  function setManualProgress(projectId: string, value: number | null) { setProjects((current) => current.map((project) => project.id === projectId ? { ...project, manualProgress: value, displayedProgress: value ?? project.calculatedProgress, progressVariance: (value ?? project.calculatedProgress) - project.expectedProgress } : project)); }
  function addDocument(record: DocumentRecord) { setDocuments((current) => [record, ...current]); }
  function reviewProposal(id: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string) { setProposals((current) => current.map((proposal) => { if (proposal.id !== id) return proposal; if (action === "reject") return { ...proposal, status: "rejected" }; if (action === "approve") return { ...proposal, status: "approved", reviewedMilestoneIds: proposal.milestones.map((milestone) => milestone.id) }; const reviewed = milestoneId ? [...new Set([...proposal.reviewedMilestoneIds, milestoneId])] : proposal.reviewedMilestoneIds; return { ...proposal, reviewedMilestoneIds: reviewed, status: reviewed.length === proposal.milestones.length ? "approved" : "partially_approved" }; })); }
  function sendMessage(content: string, projectId?: string) { const now = new Date().toISOString(); setMessages((current) => [...current, { id: crypto.randomUUID(), role: "user", content, createdAt: now }, { id: crypto.randomUUID(), role: "assistant", content: answerFor(content, projects.find((project) => project.id === (projectId ?? activeProject?.id)) ?? activeProject), citations: content.toLowerCase().includes("missing") ? [{ filename: "distributed-systems-assignment-brief.pdf", reference: "page 6" }] : undefined, createdAt: now }]); }
  const value = { projects, tasks, documents, proposals, messages, activeProject, setActiveProject, addProject, archiveProject, updateTask, setManualProgress, addDocument, reviewProposal, sendMessage };
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

function answerFor(message: string, project?: Project) { const lower = message.toLowerCase(); if (lower.includes("overdue")) return "The coordination service is due today, and failure-mode testing is now the main schedule risk. Finish the service, then either secure the device or define a simulator-based fallback before starting the evaluation section."; if (lower.includes("risk")) return `${project?.title ?? "This project"} is ${project?.riskStatus.replace("_", " ") ?? "being assessed"}. ${project?.riskReason ?? "I need a project context to explain it."}`; if (lower.includes("missing")) return "The brief still requires a source archive, technical report, and test evidence. The current plan covers all three, but the evaluation section cannot be completed until failure-mode evidence is available."; return `For ${project?.title ?? "your active work"}, start with the highest-priority task that unlocks dependants. I would protect the internal deadline and keep the final two days for verification and submission.`; }
export function useApp() { const value = useContext(Context); if (!value) throw new Error("useApp must be used inside AppProvider"); return value; }
