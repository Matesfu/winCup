import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/actions/profile", () => ({
  updateProfile: jest.fn(),
  updatePassword: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initial: unknown
    ) => [initial, (fd: FormData) => action(initial, fd), false],
  };
});

import { PasswordForm } from "@/app/profile/_components/PasswordForm";
import { ProfileForm } from "@/app/profile/_components/ProfileForm";
import { WalletPreviewCard } from "@/app/profile/_components/WalletPreviewCard";

describe("Profile settings components", () => {
  it("renders the username form", () => {
    render(<ProfileForm username="tesfu" />);

    expect(screen.getByRole("heading", { name: "Profile" })).toBeInTheDocument();
    expect(screen.getByLabelText("Username")).toHaveValue("tesfu");
    expect(screen.getByRole("button", { name: /save profile/i })).toBeInTheDocument();
  });

  it("renders the password form", () => {
    render(<PasswordForm />);

    expect(screen.getByRole("heading", { name: "Password" })).toBeInTheDocument();
    expect(screen.getByLabelText("New password")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: /update password/i })).toBeInTheDocument();
  });

  it("renders the future wallet placeholder", () => {
    render(<WalletPreviewCard />);

    expect(screen.getByText("Wallet")).toBeInTheDocument();
    expect(screen.getByText("Coming soon")).toBeInTheDocument();
    expect(screen.getByText(/deposits, withdrawals/i)).toBeInTheDocument();
  });
});
