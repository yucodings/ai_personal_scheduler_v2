import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { AppProvider } from "@/components/providers/app-provider";
import { ProjectDetail } from "@/components/projects/project-detail";
import { PROJECT_IDS } from "@/lib/mock-data";

describe("Project workflows", () => {
  it("updates task status and confirms a proposal", async () => { const user = userEvent.setup(); render(<AppProvider><ProjectDetail projectId={PROJECT_IDS.assignment} /></AppProvider>); await user.click(screen.getByRole("button", { name: "Milestones & tasks" })); const status = screen.getByLabelText("Update Implement coordination service status"); await user.selectOptions(status, "completed"); expect(status).toHaveValue("completed"); await user.click(screen.getByRole("button", { name: /Proposals/ })); await user.click(screen.getByRole("button", { name: "Approve full plan" })); expect(screen.getByText("approved")).toBeInTheDocument(); });
  it("supports manual progress override and removal", async () => { const user = userEvent.setup(); render(<AppProvider><ProjectDetail projectId={PROJECT_IDS.assignment} /></AppProvider>); await user.click(screen.getByRole("button", { name: "Progress history" })); const input = screen.getByLabelText("Displayed progress"); await user.clear(input); await user.type(input, "44"); await user.click(screen.getByRole("button", { name: "Apply" })); expect(screen.getByText("Manual override active")).toBeInTheDocument(); await user.click(screen.getByRole("button", { name: /Return to calculated/ })); expect(screen.queryByText("Manual override active")).not.toBeInTheDocument(); });
});

