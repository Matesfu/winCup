import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { Input } from "@/components/ui/Input";

describe("Input", () => {
  it("renders the label", () => {
    render(<Input label="Email address" />);
    expect(screen.getByLabelText("Email address")).toBeInTheDocument();
  });

  it("renders helper text when provided", () => {
    render(<Input label="Username" helperText="3–30 characters" />);
    expect(screen.getByText("3–30 characters")).toBeInTheDocument();
  });

  it("renders error message and sets aria-invalid", () => {
    render(<Input label="Username" error="Username is required" />);
    expect(screen.getByText("Username is required")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("prefers error over helperText when both are provided", () => {
    render(<Input label="X" error="Error!" helperText="Help" />);
    expect(screen.getByText("Error!")).toBeInTheDocument();
    expect(screen.queryByText("Help")).not.toBeInTheDocument();
  });

  it("shows character count when showCount=true and maxLength given", () => {
    render(<Input label="Name" showCount maxLength={40} value="hello" onChange={() => {}} />);
    expect(screen.getByText("5/40")).toBeInTheDocument();
  });

  it("forwards ref to the input element", () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input label="Test" ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it("passes additional HTML attributes", () => {
    render(<Input label="Test" placeholder="Enter text" data-testid="my-input" />);
    expect(screen.getByTestId("my-input")).toHaveAttribute("placeholder", "Enter text");
  });
});
