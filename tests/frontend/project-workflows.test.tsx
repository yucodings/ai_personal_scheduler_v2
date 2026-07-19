import { render, screen } from "@testing-library/react";
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
});
