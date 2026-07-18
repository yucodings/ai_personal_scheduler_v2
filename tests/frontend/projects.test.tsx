import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ProjectsPage from "@/app/(workspace)/projects/page";
import { AppProvider } from "@/components/providers/app-provider";

function renderPage() { return render(<AppProvider><ProjectsPage /></AppProvider>); }
describe("Projects", () => {
  it("filters by search and risk", async () => { const user = userEvent.setup(); renderPage(); await user.type(screen.getByLabelText("Search projects"), "AMD"); expect(screen.getByText("AMD Innovation Challenge")).toBeInTheDocument(); expect(screen.queryByText("Data Engineering")).not.toBeInTheDocument(); await user.clear(screen.getByLabelText("Search projects")); await user.selectOptions(screen.getByLabelText("Risk filter"), "delayed"); expect(screen.getByText("Distributed Systems Assignment")).toBeInTheDocument(); });
  it("creates a project with dates and scope", async () => { const user = userEvent.setup(); renderPage(); await user.click(screen.getByRole("button", { name: /create project/i })); await user.type(screen.getByLabelText("Project title"), "New Robotics Sprint"); await user.type(screen.getByLabelText("What does success look like?"), "Working prototype and report"); await user.click(screen.getByRole("button", { name: "Create project" })); await user.selectOptions(screen.getByLabelText("Status filter"), "planned"); expect(await screen.findByText("New Robotics Sprint")).toBeInTheDocument(); });
});
