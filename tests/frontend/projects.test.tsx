import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import ProjectsPage from "@/app/(workspace)/projects/page";
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
});
