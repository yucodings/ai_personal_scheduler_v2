import type {
  AiProposal,
  ChatMessage,
  DailyPlan,
  DocumentRecord,
  Priority,
  Project,
  ProjectStatus,
  ProjectType,
  RiskStatus,
  Task,
  TaskStatus,
} from "@/lib/types";

export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
  request_id: string;
}

export interface ProjectCreateInput {
  title: string;
  projectType: ProjectType;
  description: string;
  priority: Priority;
  startDate: string;
  finalDeadline: string;
  internalDeadline?: string;
  estimatedTotalHours: number;
}

export interface WorkspaceData {
  projects: Project[];
  tasks: Task[];
  documents: DocumentRecord[];
  proposals: AiProposal[];
  messages: ChatMessage[];
  dailyPlan: DailyPlan | null;
}

export type ServiceName = "supabase" | "deepseek" | "mimo" | "telegram";
export type ServiceStatus = Record<ServiceName, { configured: boolean; active?: boolean }>;

type Row = Record<string, unknown>;

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.success || payload.data === null) {
    throw new Error(payload.error?.message ?? "Request failed");
  }
  return payload.data;
}

const rows = (value: unknown): Row[] => Array.isArray(value) ? value.filter((item): item is Row => Boolean(item && typeof item === "object")) : [];
const row = (value: unknown): Row => value && typeof value === "object" && !Array.isArray(value) ? value as Row : {};
const number = (value: unknown): number => Number(value ?? 0);
const string = (value: unknown): string => typeof value === "string" ? value : "";

export function projectFromApi(value: unknown): Project {
  const item = row(value);
  return {
    id: string(item.id),
    title: string(item.title),
    projectType: string(item.project_type) as ProjectType,
    description: string(item.description),
    status: string(item.status) as ProjectStatus,
    priority: string(item.priority) as Priority,
    startDate: string(item.start_date),
    finalDeadline: string(item.final_deadline),
    internalDeadline: string(item.internal_deadline) || undefined,
    estimatedTotalHours: number(item.estimated_total_hours),
    calculatedProgress: number(item.calculated_progress),
    manualProgress: item.manual_progress === null || item.manual_progress === undefined ? null : number(item.manual_progress),
    displayedProgress: number(item.displayed_progress),
    expectedProgress: number(item.expected_progress),
    progressVariance: number(item.progress_variance),
    riskStatus: (string(item.risk_status) || "on_track") as RiskStatus,
    riskReason: string(item.risk_reason) || "No risk assessment has been recorded yet.",
    isActiveContext: Boolean(item.is_active_context),
    updatedAt: string(item.updated_at),
  };
}

export function taskFromApi(value: unknown): Task {
  const item = row(value);
  const dependencies = rows(item.task_dependencies).map((dependency) => string(dependency.predecessor_task_id)).filter(Boolean);
  return {
    id: string(item.id),
    projectId: string(item.project_id),
    milestoneId: string(item.milestone_id) || undefined,
    parentTaskId: string(item.parent_task_id) || undefined,
    title: string(item.title),
    description: string(item.description),
    status: string(item.status) as TaskStatus,
    progressPercent: number(item.progress_percent),
    priority: string(item.priority) as Priority,
    effortWeight: number(item.effort_weight),
    estimatedHours: number(item.estimated_hours),
    actualHours: number(item.actual_hours),
    plannedStart: string(item.planned_start),
    dueDate: string(item.due_date) || string(item.planned_start),
    blockedReason: string(item.blocked_reason) || undefined,
    sequence: number(item.sequence),
    dependencies,
    isAiGenerated: Boolean(item.is_ai_generated),
  };
}

export function documentFromApi(value: unknown): DocumentRecord {
  const item = row(value);
  return {
    id: string(item.id),
    projectId: string(item.project_id),
    originalFilename: string(item.original_filename),
    extension: string(item.extension),
    mimeType: string(item.mime_type),
    fileSize: number(item.file_size),
    extractionMethod: string(item.extraction_method),
    extractionStatus: string(item.extraction_status) as DocumentRecord["extractionStatus"],
    extractedText: string(item.extracted_text),
    processedSummary: string(item.processed_summary) || "Indexed project document.",
    detectedDeadlines: Array.isArray(item.detected_deadlines) ? item.detected_deadlines.map(string) : [],
    detectedDeliverables: Array.isArray(item.detected_deliverables) ? item.detected_deliverables.map(string) : [],
    ocrConfidence: item.ocr_confidence === null || item.ocr_confidence === undefined ? undefined : number(item.ocr_confidence),
  };
}

function proposalFromApi(value: unknown): AiProposal {
  const item = row(value);
  const payload = row(item.proposed_payload);
  const reviewState = row(item.review_state);
  const projectId = string(item.project_id);
  const milestones = rows(payload.milestones).map((milestone, milestoneIndex) => {
    const milestoneId = string(milestone.id) || string(milestone.client_id) || `milestone-${milestoneIndex}`;
    return {
      id: milestoneId,
      projectId,
      title: string(milestone.title),
      description: string(milestone.description),
      sequence: number(milestone.sequence),
      dueDate: string(milestone.due_date),
      status: "planned" as const,
      progress: 0,
      estimatedHours: number(milestone.estimated_hours),
      isAiGenerated: true,
      tasks: rows(milestone.tasks).map((task, taskIndex) => ({
        id: string(task.id) || string(task.client_id) || `${milestoneId}-task-${taskIndex}`,
        projectId,
        milestoneId,
        title: string(task.title),
        description: string(task.description),
        status: "not_started" as const,
        progressPercent: 0,
        priority: (string(task.priority) || "medium") as Priority,
        effortWeight: number(task.effort_weight) || 1,
        estimatedHours: number(task.estimated_hours),
        actualHours: 0,
        plannedStart: string(task.planned_start),
        dueDate: string(task.due_date) || string(milestone.due_date),
        sequence: taskIndex,
        dependencies: Array.isArray(task.depends_on) ? task.depends_on.map(string) : [],
        isAiGenerated: true,
      })),
    };
  });
  return {
    id: string(item.id),
    projectId,
    type: string(item.proposal_type) as AiProposal["type"],
    summary: string(item.human_summary),
    approvalMode: string(item.approval_mode) as AiProposal["approvalMode"],
    status: string(item.status) as AiProposal["status"],
    milestones,
    reviewedMilestoneIds: Array.isArray(reviewState.reviewed_milestones) ? reviewState.reviewed_milestones.map(string) : [],
    createdAt: string(item.created_at),
  };
}

function messageFromApi(value: unknown): ChatMessage | null {
  const item = row(value);
  const role = string(item.role);
  if (role !== "user" && role !== "assistant") return null;
  const structured = row(row(item.structured_action_data).envelope);
  const citations = rows(structured.citations).map((citation) => ({ filename: string(citation.filename), reference: string(citation.reference) }));
  return {
    id: string(item.id),
    role,
    content: string(item.content),
    citations: citations.length ? citations : undefined,
    proposalId: string(structured.proposal_id) || undefined,
    createdAt: string(item.created_at),
  };
}

function dailyPlanFromApi(value: unknown): DailyPlan | null {
  if (!value || typeof value !== "object") return null;
  const item = row(value);
  const items = rows(item.daily_plan_items).sort((a, b) => number(a.ordering) - number(b.ordering)).map((planItem) => {
    const task = row(planItem.tasks);
    const project = row(task.projects);
    return {
      id: string(planItem.id),
      taskId: string(planItem.task_id),
      title: string(task.title) || "Task",
      projectTitle: string(project.title) || "Project",
      plannedMinutes: number(planItem.planned_duration_minutes),
      reason: "Scheduled from priority, dependencies, deadlines, and available capacity.",
      completed: Boolean(planItem.is_completed),
    };
  });
  return {
    id: string(item.id),
    planDate: string(item.plan_date),
    period: string(item.period) as DailyPlan["period"],
    summary: string(item.generated_summary),
    totalPlannedHours: number(item.total_planned_hours),
    completionPercentage: number(item.completion_percentage),
    riskSummary: string(item.risk_summary),
    items,
  };
}

function workspaceFromApi(value: unknown): WorkspaceData {
  const item = row(value);
  return {
    projects: rows(item.projects).map(projectFromApi),
    tasks: rows(item.tasks).map(taskFromApi),
    documents: rows(item.documents).map(documentFromApi),
    proposals: rows(item.proposals).map(proposalFromApi),
    messages: rows(item.messages).map(messageFromApi).filter((message): message is ChatMessage => message !== null),
    dailyPlan: dailyPlanFromApi(item.daily_plan),
  };
}

function projectPayload(input: ProjectCreateInput): Row {
  return {
    title: input.title,
    project_type: input.projectType,
    description: input.description,
    priority: input.priority,
    start_date: input.startDate,
    final_deadline: input.finalDeadline,
    internal_deadline: input.internalDeadline || null,
    estimated_total_hours: input.estimatedTotalHours,
  };
}

function projectChanges(changes: Partial<Project>): Row {
  const payload: Row = {};
  const mapping: Partial<Record<keyof Project, string>> = {
    title: "title",
    description: "description",
    status: "status",
    priority: "priority",
    startDate: "start_date",
    finalDeadline: "final_deadline",
    internalDeadline: "internal_deadline",
    estimatedTotalHours: "estimated_total_hours",
    manualProgress: "manual_progress",
    isActiveContext: "is_active_context",
  };
  for (const [key, apiKey] of Object.entries(mapping)) {
    if (key in changes && apiKey) payload[apiKey] = changes[key as keyof Project] ?? null;
  }
  return payload;
}

function fileBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("The selected file could not be read."));
    reader.onload = () => resolve(String(reader.result).split(",", 2)[1] ?? "");
    reader.readAsDataURL(file);
  });
}

export const apiClient = {
  login: (password: string) => request<{ authenticated: boolean }>("/api/auth/login", { method: "POST", body: JSON.stringify({ password }) }),
  logout: () => request<{ authenticated: boolean }>("/api/auth/logout", { method: "POST" }),
  session: () => request<{ authenticated: boolean; expires_at: string }>("/api/auth/session"),
  workspace: async () => workspaceFromApi(await request<unknown>("/api/workspace")),
  createProject: async (input: ProjectCreateInput) => projectFromApi(await request<unknown>("/api/projects", { method: "POST", body: JSON.stringify(projectPayload(input)) })),
  updateProject: async (id: string, changes: Partial<Project>) => projectFromApi(await request<unknown>(`/api/project?id=${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(projectChanges(changes)) })),
  updateTaskProgress: (taskId: string, status: TaskStatus, progressPercent: number, note?: string) => request<unknown>("/api/progress", { method: "POST", body: JSON.stringify({ task_id: taskId, status, progress_percent: progressPercent, actual_hours_added: 0, note: note || null, source: "web" }) }),
  uploadDocument: async (projectId: string, file: File) => documentFromApi(await request<unknown>("/api/documents/upload", { method: "POST", body: JSON.stringify({ project_id: projectId, filename: file.name, mime_type: file.type || "application/octet-stream", content_base64: await fileBase64(file) }) })),
  finalizeDocument: async (documentId: string, projectId: string, text: string, method: string, confidence?: number) => documentFromApi(await request<unknown>("/api/documents/finalize", { method: "POST", body: JSON.stringify({ document_id: documentId, project_id: projectId, extracted_text: text, extraction_method: method, ocr_confidence: confidence ?? null }) })),
  extractDocument: async (documentId: string, projectId: string, file: File) => documentFromApi(await request<unknown>("/api/documents/extract", { method: "POST", body: JSON.stringify({ document_id: documentId, project_id: projectId, filename: file.name, content_base64: await fileBase64(file) }) })),
  chat: (message: string, projectId?: string, documentId?: string) => request<Row>("/api/ai/chat", { method: "POST", body: JSON.stringify({ message, project_id: projectId || null, document_id: documentId || null }) }),
  analyzeProject: (projectId: string) => request<Row>("/api/ai/analyze-project", { method: "POST", body: JSON.stringify({ project_id: projectId }) }),
  reviewProposal: (proposalId: string, action: "approve" | "reject" | "approve_milestone", milestoneId?: string) => request<unknown>("/api/ai/proposal", { method: "POST", body: JSON.stringify({ proposal_id: proposalId, action, milestone_id: milestoneId || null }) }),
  serviceStatus: () => request<ServiceStatus>("/api/services/status"),
  testService: (service: ServiceName) => request<{ service: ServiceName; connected: boolean; message: string }>("/api/services/test", { method: "POST", body: JSON.stringify({ service }) }),
};
