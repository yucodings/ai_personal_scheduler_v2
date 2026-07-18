export type ProjectType = "subject" | "assignment" | "examination" | "competition" | "hackathon" | "final_year_project" | "internship" | "event" | "personal" | "other";
export type ProjectStatus = "planned" | "active" | "paused" | "completed" | "archived";
export type Priority = "low" | "medium" | "high" | "critical";
export type RiskStatus = "on_track" | "at_risk" | "delayed" | "blocked" | "completed";
export type TaskStatus = "not_started" | "started" | "in_progress" | "nearly_complete" | "completed" | "blocked" | "cancelled";

export interface Project {
  id: string;
  title: string;
  projectType: ProjectType;
  description: string;
  status: ProjectStatus;
  priority: Priority;
  startDate: string;
  finalDeadline: string;
  internalDeadline?: string;
  estimatedTotalHours: number;
  calculatedProgress: number;
  manualProgress: number | null;
  displayedProgress: number;
  expectedProgress: number;
  progressVariance: number;
  riskStatus: RiskStatus;
  riskReason: string;
  isActiveContext: boolean;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  projectId: string;
  title: string;
  description: string;
  sequence: number;
  dueDate: string;
  status: "planned" | "active" | "completed" | "blocked";
  progress: number;
  estimatedHours: number;
  isAiGenerated: boolean;
}

export interface Task {
  id: string;
  projectId: string;
  milestoneId?: string;
  parentTaskId?: string;
  title: string;
  description: string;
  status: TaskStatus;
  progressPercent: number;
  priority: Priority;
  effortWeight: number;
  estimatedHours: number;
  actualHours: number;
  plannedStart: string;
  dueDate: string;
  blockedReason?: string;
  sequence: number;
  dependencies: string[];
  isAiGenerated: boolean;
}

export interface DocumentRecord {
  id: string;
  projectId: string;
  originalFilename: string;
  extension: string;
  mimeType: string;
  fileSize: number;
  extractionMethod: string;
  extractionStatus: "pending" | "processing" | "completed" | "failed";
  extractedText: string;
  processedSummary: string;
  detectedDeadlines: string[];
  detectedDeliverables: string[];
  ocrConfidence?: number;
}

export interface ProposalMilestone extends Milestone { tasks: Task[] }
export interface AiProposal {
  id: string;
  projectId: string;
  type: "project_plan" | "reschedule" | "task_breakdown";
  summary: string;
  approvalMode: "full_plan" | "milestone_by_milestone";
  status: "pending" | "partially_approved" | "approved" | "rejected";
  milestones: ProposalMilestone[];
  reviewedMilestoneIds: string[];
  createdAt: string;
}

export interface DailyPlanItem { id: string; taskId: string; title: string; projectTitle: string; plannedMinutes: number; reason: string; completed: boolean }
export interface DailyPlan { id: string; planDate: string; period: "morning" | "evening"; summary: string; totalPlannedHours: number; completionPercentage: number; riskSummary: string; items: DailyPlanItem[] }
export interface ChatMessage { id: string; role: "user" | "assistant"; content: string; citations?: { filename: string; reference: string }[]; proposalId?: string; createdAt: string }

