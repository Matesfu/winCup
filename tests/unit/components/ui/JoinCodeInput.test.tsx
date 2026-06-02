import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { JoinCodeInput } from "@/components/ui/JoinCodeInput";

describe("JoinCodeInput", () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders an input field with a WC- prefix label", () => {
    render(<JoinCodeInput value="" onChange={onChange} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
    expect(screen.getByText("WC-")).toBeInTheDocument();
  });

  it("calls onChange with WC-XXXX format on typed input", () => {
    render(<JoinCodeInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ab23" } });
    expect(onChange).toHaveBeenCalledWith("WC-AB23");
  });

  it("auto-uppercases input", () => {
    render(<JoinCodeInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "abcd" } });
    expect(onChange).toHaveBeenCalledWith("WC-ABCD");
  });

  it("strips non-alphanumeric characters", () => {
    render(<JoinCodeInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "A!B@2" } });
    expect(onChange).toHaveBeenCalledWith("WC-AB2");
  });

  it("limits suffix to 4 characters", () => {
    render(<JoinCodeInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ABCDE" } });
    expect(onChange).toHaveBeenCalledWith("WC-ABCD");
  });

  it("shows error message when error prop provided", () => {
    render(<JoinCodeInput value="" onChange={onChange} error="Invalid code" />);
    expect(screen.getByText("Invalid code")).toBeInTheDocument();
  });

  it("calls onChange with empty string when input is empty", () => {
    render(<JoinCodeInput value="WC-AB23" onChange={onChange} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "" } });
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("displays the suffix portion of the current value", () => {
    render(<JoinCodeInput value="WC-XY99" onChange={onChange} />);
    expect(screen.getByRole("textbox")).toHaveValue("XY99");
  });
});
