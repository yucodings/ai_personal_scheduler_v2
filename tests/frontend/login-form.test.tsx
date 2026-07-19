import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "@/components/auth/login-form";
import { apiClient } from "@/lib/api-client";

describe("LoginForm", () => {
  afterEach(() => vi.restoreAllMocks());

  it("submits the configured production password to the login API", async () => {
    vi.spyOn(apiClient, "login").mockResolvedValue({ authenticated: true });
    const user = userEvent.setup();
    render(<LoginForm />);
    await user.type(screen.getByLabelText("Password"), "a-secure-password");
    await user.click(screen.getByRole("button", { name: "Open workspace" }));
    expect(apiClient.login).toHaveBeenCalledWith("a-secure-password");
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument();
  });

  it("toggles password visibility", async () => {
    const user = userEvent.setup();
    render(<LoginForm />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");
    await user.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");
  });
});
