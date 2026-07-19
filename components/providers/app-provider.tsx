"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { apiClient, type ProjectCreateInput, type WorkspaceData } from "@/lib/api-client";
import type { AiProposal, ChatMessage, DailyPlan, DocumentRecord, Project, Task } from "@/lib/types";

interface AppState {
  projects: Project[];
  tasks: Task[];
  documents: DocumentRecord[];
  proposals: AiProposal[];
  messages: ChatMessage[];
  dailyPlan: DailyPlan | null;
  loading: boolean;
  error: string;
  activeProject: Project | undefined;
  refresh(): Promise<void>;
  setActiveProject(id: string): Promise<void>;
  addProject(input: ProjectCreateInput): Promise<Project>;
  archiveProject(id: string): Promise<void>;
  updateTask(id: string, progress: number, status?: Task["status"], blocker?: string): Promise<void>;
  setManualProgress(projectId: string, value: number | null): Promise<void>;
  addDocument(record: DocumentRecord): void;
  reviewProposal(id: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string): Promise<void>;
  sendMessage(content: string, projectId?: string): Promise<void>;
  analyzeProject(projectId: string): Promise<string>;
}

const emptyWorkspace: WorkspaceData = {
  projects: [],
  tasks: [],
  documents: [],
  proposals: [],
  messages: [],
  dailyPlan: null,
};

const Context = createContext<AppState | null>(null);

export function AppProvider({
  children,
  initialData,
  loadOnMount = true,
}: {
  children: ReactNode;
  initialData?: WorkspaceData;
  loadOnMount?: boolean;
}) {
  const initial = initialData ?? emptyWorkspace;
  const [projects, setProjects] = useState<Project[]>(initial.projects);
  const [tasks, setTasks] = useState<Task[]>(initial.tasks);
  const [documents, setDocuments] = useState<DocumentRecord[]>(initial.documents);
  const [proposals, setProposals] = useState<AiProposal[]>(initial.proposals);
  const [messages, setMessages] = useState<ChatMessage[]>(initial.messages);
  const [dailyPlan, setDailyPlan] = useState<DailyPlan | null>(initial.dailyPlan);
  const [loading, setLoading] = useState(loadOnMount && !initialData);
  const [error, setError] = useState("");

  const applyWorkspace = useCallback((workspace: WorkspaceData) => {
    setProjects(workspace.projects);
    setTasks(workspace.tasks);
    setDocuments(workspace.documents);
    setProposals(workspace.proposals);
    setMessages(workspace.messages);
    setDailyPlan(workspace.dailyPlan);
  }, []);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      applyWorkspace(await apiClient.workspace());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load workspace data.");
    } finally {
      setLoading(false);
    }
  }, [applyWorkspace]);

  useEffect(() => {
    if (loadOnMount && !initialData) void refresh();
  }, [initialData, loadOnMount, refresh]);

  const activeProject = projects.find((project) => project.isActiveContext) ?? projects[0];

  async function setActiveProject(id: string) {
    const updated = await apiClient.updateProject(id, { isActiveContext: true });
    setProjects((current) => current.map((project) => ({
      ...project,
      isActiveContext: project.id === updated.id,
    })));
  }

  async function addProject(input: ProjectCreateInput) {
    const project = await apiClient.createProject(input);
    setProjects((current) => [project, ...current]);
    return project;
  }

  async function archiveProject(id: string) {
    const updated = await apiClient.updateProject(id, { status: "archived" });
    setProjects((current) => current.map((project) => project.id === id ? updated : project));
  }

  async function updateTask(id: string, progress: number, status?: Task["status"], blocker?: string) {
    const normalizedProgress = Math.max(0, Math.min(100, progress));
    const normalizedStatus = status ?? (normalizedProgress >= 100 ? "completed" : normalizedProgress > 0 ? "in_progress" : "not_started");
    await apiClient.updateTaskProgress(id, normalizedStatus, normalizedProgress, blocker);
    setTasks((current) => current.map((task) => task.id === id ? {
      ...task,
      progressPercent: normalizedProgress,
      status: normalizedStatus,
      blockedReason: blocker,
    } : task));
  }

  async function setManualProgress(projectId: string, value: number | null) {
    const updated = await apiClient.updateProject(projectId, { manualProgress: value });
    setProjects((current) => current.map((project) => project.id === projectId ? updated : project));
  }

  function addDocument(record: DocumentRecord) {
    setDocuments((current) => [record, ...current.filter((document) => document.id !== record.id)]);
  }

  async function reviewProposal(id: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string) {
    await apiClient.reviewProposal(id, action, milestoneId);
    await refresh();
  }

  async function sendMessage(content: string, projectId?: string) {
    const createdAt = new Date().toISOString();
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt };
    setMessages((current) => [...current, userMessage]);
    try {
      const response = await apiClient.chat(content, projectId);
      const citations = Array.isArray(response.citations)
        ? response.citations.flatMap((value) => {
            if (!value || typeof value !== "object") return [];
            const citation = value as Record<string, unknown>;
            return [{ filename: String(citation.filename ?? "Source"), reference: String(citation.reference ?? "") }];
          })
        : undefined;
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: String(response.reply ?? "Skyler did not return a response."),
        citations,
        proposalId: response.proposal_id ? String(response.proposal_id) : undefined,
        createdAt: new Date().toISOString(),
      }]);
      if (response.proposal_id) await refresh();
    } catch (cause) {
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: "assistant",
        content: cause instanceof Error ? cause.message : "Skyler could not complete the request.",
        createdAt: new Date().toISOString(),
      }]);
    }
  }

  async function analyzeProject(projectId: string) {
    const response = await apiClient.analyzeProject(projectId);
    await refresh();
    return String(response.reply ?? "Analysis completed.");
  }

  return <Context.Provider value={{
    projects,
    tasks,
    documents,
    proposals,
    messages,
    dailyPlan,
    loading,
    error,
    activeProject,
    refresh,
    setActiveProject,
    addProject,
    archiveProject,
    updateTask,
    setManualProgress,
    addDocument,
    reviewProposal,
    sendMessage,
    analyzeProject,
  }}>{children}</Context.Provider>;
}

export function useApp() {
  const value = useContext(Context);
  if (!value) throw new Error("useApp must be used inside AppProvider");
  return value;
}
