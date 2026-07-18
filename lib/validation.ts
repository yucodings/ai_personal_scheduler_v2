import { z } from "zod";

export const loginSchema = z.object({ password: z.string().min(1, "Enter your password").max(256) });
export const projectSchema = z.object({
  title: z.string().min(2).max(160),
  projectType: z.enum(["subject", "assignment", "examination", "competition", "hackathon", "final_year_project", "internship", "event", "personal", "other"]),
  description: z.string().max(5000).default(""),
  priority: z.enum(["low", "medium", "high", "critical"]),
  startDate: z.string().date(),
  finalDeadline: z.string().date(),
  internalDeadline: z.string().date().optional().or(z.literal("")),
  estimatedTotalHours: z.number().min(0).max(10000),
}).refine((data) => data.finalDeadline >= data.startDate, { message: "Deadline must be after the start date", path: ["finalDeadline"] });

export const taskProgressSchema = z.object({
  taskId: z.string().uuid(),
  progressPercent: z.number().min(0).max(100),
  status: z.enum(["not_started", "started", "in_progress", "nearly_complete", "completed", "blocked", "cancelled"]),
  actualHoursAdded: z.number().min(0).max(24).default(0),
  note: z.string().max(2000).optional(),
});

