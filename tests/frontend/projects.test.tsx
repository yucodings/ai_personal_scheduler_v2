import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(workspace)/projects/page";
import ArchivedProjectsPage from "@/app/(workspace)/archived/page";
import { AppProvider } from "@/components/providers/app-provider";
import { apiClient } from "@/lib/api-client";
import { workspaceFixture } from "@/tests/frontend/fixtures";

function renderPage() { return render(<AppProvider initialData={workspaceFixture} loadOnMount={false}><ProjectsPage /></AppProvider>); }

describe("Projects", () => {
  afterEach(() => vi.restoreAllMocks());

  it("filters real workspace records by search and risk", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByLabelText("Search projects"), "Beta");
    expect(screen.getByText("Beta Challenge")).toBeInTheDocument();
    expect(screen.queryByText("Gamma Course")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("Search projects"));
    await user.selectOptions(screen.getByLabelText("Risk filter"), "delayed");
    expect(screen.getByText("Alpha Assignment")).toBeInTheDocument();
  });

  it("persists a new project through the API client", async () => {
    vi.spyOn(apiClient, "createProject").mockImplementation(async (input) => ({
      ...workspaceFixture.projects[0],
      ...input,
      id: "99999999-9999-4999-8999-999999999999",
      status: "planned",
      calculatedProgress: 0,
      manualProgress: null,
      displayedProgress: 0,
      expectedProgress: 0,
      progressVariance: 0,
      riskStatus: "on_track",
      riskReason: "No risk assessment has been recorded yet.",
      isActiveContext: false,
      updatedAt: new Date().toISOString(),
    }));
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /create project/i }));
    await user.type(screen.getByLabelText("Project title"), "New Robotics Sprint");
    fireEvent.change(screen.getByLabelText("Final deadline"), { target: { value: "2026-08-19" } });
    await user.type(screen.getByLabelText("What does success look like?"), "Working prototype and report");
    await user.click(screen.getByRole("button", { name: "Create project" }));
    expect(await screen.findByText("New Robotics Sprint")).toBeInTheDocument();
    expect(apiClient.createProject).toHaveBeenCalledOnce();
  });

  it("archives the active project and activates the next available project", async () => {
    vi.spyOn(apiClient, "updateProject").mockImplementation(async (id, changes) => {
      const project = workspaceFixture.projects.find((item) => item.id === id)!;
      return { ...project, ...changes };
    });
    const user = userEvent.setup();
    renderPage();

    const actions = screen.getByLabelText("Project actions for Alpha Assignment");
    const projectCard = actions.closest("article")!;
    await user.click(actions);
    await user.click(within(projectCard).getByRole("button", { name: "Archive" }));

    expect(screen.queryByText("Alpha Assignment")).not.toBeInTheDocument();
    expect(apiClient.updateProject).toHaveBeenNthCalledWith(1, workspaceFixture.projects[0].id, { status: "archived" });
    expect(apiClient.updateProject).toHaveBeenNthCalledWith(2, workspaceFixture.projects[1].id, { isActiveContext: true });
  });

  it("keeps archived projects on a separate page and restores them", async () => {
    const archivedProject = {
      ...workspaceFixture.projects[0],
      id: "99999999-9999-4999-8999-999999999998",
      title: "Archived Venture",
      status: "archived" as const,
      isActiveContext: false,
    };
    const archivedWorkspace = { ...workspaceFixture, projects: [...workspaceFixture.projects, archivedProject] };
    const activeView = render(<AppProvider initialData={archivedWorkspace} loadOnMount={false}><ProjectsPage /></AppProvider>);
    expect(screen.queryByText("Archived Venture")).not.toBeInTheDocument();
    activeView.unmount();

    vi.spyOn(apiClient, "updateProject").mockResolvedValue({ ...archivedProject, status: "active" });
    const user = userEvent.setup();
    render(<AppProvider initialData={archivedWorkspace} loadOnMount={false}><ArchivedProjectsPage /></AppProvider>);
    expect(screen.getByText("Archived Venture")).toBeInTheDocument();
    await user.click(screen.getByLabelText("Project actions for Archived Venture"));
    await user.click(screen.getByRole("button", { name: "Restore" }));

    expect(apiClient.updateProject).toHaveBeenCalledWith(archivedProject.id, { status: "active" });
    expect(screen.queryByText("Archived Venture")).not.toBeInTheDocument();
  });
});
