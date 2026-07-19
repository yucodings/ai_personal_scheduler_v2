import type { WorkspaceData } from "@/lib/api-client";
import type { AiProposal, Project, Task } from "@/lib/types";

export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

export const projects: Project[] = [
  { id: PROJECT_ID, title: "Alpha Assignment", projectType: "assignment", description: "Build and evaluate the assigned system.", status: "active", priority: "critical", startDate: "2026-07-01", finalDeadline: "2026-07-28", internalDeadline: "2026-07-25", estimatedTotalHours: 28, calculatedProgress: 38, manualProgress: null, displayedProgress: 38, expectedProgress: 58, progressVariance: -20, riskStatus: "delayed", riskReason: "A critical task is overdue.", isActiveContext: true, updatedAt: "2026-07-19T09:20:00Z" },
  { id: "22222222-2222-4222-8222-222222222222", title: "Beta Challenge", projectType: "competition", description: "Prepare a prototype and report.", status: "active", priority: "high", startDate: "2026-06-29", finalDeadline: "2026-08-06", internalDeadline: "2026-08-02", estimatedTotalHours: 72, calculatedProgress: 61, manualProgress: null, displayedProgress: 61, expectedProgress: 55, progressVariance: 6, riskStatus: "at_risk", riskReason: "One external dependency is blocked.", isActiveContext: false, updatedAt: "2026-07-18T13:10:00Z" },
  { id: "33333333-3333-4333-8333-333333333333", title: "Gamma Course", projectType: "subject", description: "Complete course deliverables.", status: "active", priority: "high", startDate: "2026-06-15", finalDeadline: "2026-09-07", internalDeadline: "2026-09-01", estimatedTotalHours: 80, calculatedProgress: 52, manualProgress: null, displayedProgress: 52, expectedProgress: 48, progressVariance: 4, riskStatus: "on_track", riskReason: "Progress is within plan.", isActiveContext: false, updatedAt: "2026-07-17T04:50:00Z" },
];

export const tasks: Task[] = [
  { id: "10000000-0000-4000-8000-000000000001", projectId: PROJECT_ID, title: "Implement core service", description: "Complete the primary implementation.", status: "in_progress", progressPercent: 65, priority: "critical", effortWeight: 5, estimatedHours: 7, actualHours: 5, plannedStart: "2026-07-15", dueDate: "2026-07-19", sequence: 1, dependencies: [], isAiGenerated: true },
];

export const proposal: AiProposal = {
  id: "e0000000-0000-4000-8000-000000000001",
  projectId: PROJECT_ID,
  type: "project_plan",
  summary: "A reviewable project plan.",
  approvalMode: "full_plan",
  status: "pending",
  milestones: [{ id: "m1", projectId: PROJECT_ID, title: "Implementation", description: "Build the solution.", sequence: 1, dueDate: "2026-07-25", status: "planned", progress: 0, estimatedHours: 7, isAiGenerated: true, tasks }],
  reviewedMilestoneIds: [],
  createdAt: "2026-07-19T00:00:00Z",
};

export const workspaceFixture: WorkspaceData = {
  projects,
  tasks,
  documents: [],
  proposals: [proposal],
  messages: [],
  dailyPlan: null,
};
