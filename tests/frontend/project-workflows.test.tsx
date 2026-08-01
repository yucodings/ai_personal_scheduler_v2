import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppProvider } from "@/components/providers/app-provider";
import { ProjectDetail } from "@/components/projects/project-detail";
import { apiClient } from "@/lib/api-client";
import { PROJECT_ID, workspaceFixture } from "@/tests/frontend/fixtures";

describe("Project workflows", () => {
  afterEach(() => vi.restoreAllMocks());

  it("persists task status and proposal approval", async () => {
    vi.spyOn(apiClient, "updateTaskProgress").mockResolvedValue({});
    vi.spyOn(apiClient, "reviewProposal").mockResolvedValue({});
    vi.spyOn(apiClient, "workspace").mockResolvedValue({
      ...workspaceFixture,
      proposals: workspaceFixture.proposals.map((proposal) => ({ ...proposal, status: "approved" })),
    });
    const user = userEvent.setup();
    render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><ProjectDetail projectId={PROJECT_ID} /></AppProvider>);
    await user.click(screen.getByRole("button", { name: "Tasks" }));
    const status = screen.getByLabelText("Update Implement core service status");
    await user.selectOptions(status, "completed");
    expect(status).toHaveValue("completed");
    expect(apiClient.updateTaskProgress).toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: /Proposals/ }));
    await user.click(screen.getByRole("button", { name: "Approve full plan" }));
    expect(await screen.findByText("approved")).toBeInTheDocument();
  });

  it("persists a manual progress override and removal", async () => {
    vi.spyOn(apiClient, "updateProject").mockImplementation(async (_id, changes) => {
      const manualProgress = changes.manualProgress ?? null;
      return {
        ...workspaceFixture.projects[0],
        manualProgress,
        displayedProgress: manualProgress ?? workspaceFixture.projects[0].calculatedProgress,
      };
    });
    const user = userEvent.setup();
    render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><ProjectDetail projectId={PROJECT_ID} /></AppProvider>);
    const input = screen.getByLabelText("Displayed progress");
    await user.clear(input);
    await user.type(input, "44");
    await user.click(screen.getByRole("button", { name: "Apply" }));
    expect(await screen.findByRole("button", { name: /Return to calculated progress/ })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Return to calculated progress/ }));
    expect(screen.queryByRole("button", { name: /Return to calculated progress/ })).not.toBeInTheDocument();
  });

  it("edits the project name and project details", async () => {
    vi.spyOn(apiClient, "updateProject").mockImplementation(async (_id, changes) => ({
      ...workspaceFixture.projects[0],
      ...changes,
      updatedAt: "2026-08-02T01:00:00Z",
    }));
    const user = userEvent.setup();
    render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><ProjectDetail projectId={PROJECT_ID} /></AppProvider>);

    await user.click(screen.getByRole("button", { name: "Edit project" }));
    const dialog = screen.getByRole("dialog", { name: "Edit project" });
    const title = within(dialog).getByLabelText("Project title");
    await user.clear(title);
    await user.type(title, "Digital Entrepreneurship");
    await user.selectOptions(within(dialog).getByLabelText("Project type"), "subject");
    await user.click(within(dialog).getByRole("button", { name: "Save changes" }));

    expect(await screen.findByRole("heading", { name: "Digital Entrepreneurship" })).toBeInTheDocument();
    expect(apiClient.updateProject).toHaveBeenCalledWith(PROJECT_ID, expect.objectContaining({
      title: "Digital Entrepreneurship",
      projectType: "subject",
    }));
  });

  it("adds a manual task inside the project", async () => {
    const newTask = {
      ...workspaceFixture.tasks[0],
      id: "20000000-0000-4000-8000-000000000002",
      title: "Draft business model canvas",
      description: "Complete the first canvas draft.",
      status: "not_started" as const,
      progressPercent: 0,
      priority: "high" as const,
      estimatedHours: 3,
      effortWeight: 2,
      actualHours: 0,
      plannedStart: "2026-08-03",
      dueDate: "2026-08-05",
      sequence: 1,
      dependencies: [],
      isAiGenerated: false,
    };
    vi.spyOn(apiClient, "createTask").mockResolvedValue(newTask);
    vi.spyOn(apiClient, "workspace").mockResolvedValue({
      ...workspaceFixture,
      tasks: [...workspaceFixture.tasks, newTask],
    });
    const user = userEvent.setup();
    render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><ProjectDetail projectId={PROJECT_ID} /></AppProvider>);

    await user.click(screen.getByRole("button", { name: "Tasks" }));
    await user.click(screen.getByRole("button", { name: "Add task" }));
    const dialog = screen.getByRole("dialog", { name: "Add task" });
    await user.type(within(dialog).getByLabelText("Task title"), "Draft business model canvas");
    await user.type(within(dialog).getByLabelText("Description"), "Complete the first canvas draft.");
    await user.selectOptions(within(dialog).getByLabelText("Priority"), "high");
    await user.clear(within(dialog).getByLabelText("Estimated hours"));
    await user.type(within(dialog).getByLabelText("Estimated hours"), "3");
    await user.clear(within(dialog).getByLabelText("Progress weight"));
    await user.type(within(dialog).getByLabelText("Progress weight"), "2");
    fireEvent.change(within(dialog).getByLabelText("Planned start"), { target: { value: "2026-08-03" } });
    fireEvent.change(within(dialog).getByLabelText("Due date"), { target: { value: "2026-08-05" } });
    await user.click(within(dialog).getByRole("button", { name: "Add task" }));

    expect(await screen.findByText("Draft business model canvas")).toBeInTheDocument();
    expect(apiClient.createTask).toHaveBeenCalledWith(expect.objectContaining({
      projectId: PROJECT_ID,
      title: "Draft business model canvas",
      priority: "high",
      estimatedHours: 3,
      effortWeight: 2,
    }));
  });
});
