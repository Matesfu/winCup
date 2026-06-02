import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { PasswordInput } from "@/components/ui/PasswordInput";

describe("PasswordInput", () => {
  it("renders as type='password' by default", () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("toggle button shows the password (type='text')", () => {
    render(<PasswordInput label="Password" />);
    const toggle = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "text");
  });

  it("toggle button hides the password again on second click", () => {
    render(<PasswordInput label="Password" />);
    const toggle = screen.getByRole("button", { name: /show password/i });
    fireEvent.click(toggle);
    const hideToggle = screen.getByRole("button", { name: /hide password/i });
    fireEvent.click(hideToggle);
    expect(screen.getByLabelText("Password")).toHaveAttribute("type", "password");
  });

  it("toggle has accessible aria-label", () => {
    render(<PasswordInput label="Password" />);
    expect(screen.getByRole("button", { name: /show password/i })).toBeInTheDocument();
  });

  it("renders error message and sets aria-invalid", () => {
    render(<PasswordInput label="Password" error="Too short" />);
    expect(screen.getByText("Too short")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toHaveAttribute("aria-invalid", "true");
  });

  it("renders helper text when no error", () => {
    render(<PasswordInput label="Password" helperText="Min 8 characters" />);
    expect(screen.getByText("Min 8 characters")).toBeInTheDocument();
  });
});
