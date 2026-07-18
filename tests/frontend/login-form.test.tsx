import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";

describe("LoginForm", () => {
  beforeEach(() => vi.stubEnv("NEXT_PUBLIC_MOCK_MODE", "true"));
  it("shows clear errors and accepts the demo password", async () => {
    const user = userEvent.setup(); render(<LoginForm />);
    await user.type(screen.getByLabelText("Password"), "wrong"); await user.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("use password: demo");
    await user.clear(screen.getByLabelText("Password")); await user.type(screen.getByLabelText("Password"), "demo"); await user.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(sessionStorage.getItem("skyler-demo-auth")).toBe("true");
  });
  it("toggles password visibility", async () => { const user = userEvent.setup(); render(<LoginForm />); const input = screen.getByLabelText("Password"); expect(input).toHaveAttribute("type", "password"); await user.click(screen.getByRole("button", { name: "Show password" })); expect(input).toHaveAttribute("type", "text"); });
});

