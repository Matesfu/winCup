import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { WinRuleToggle } from "@/app/room/create/_components/WinRuleToggle";

describe("WinRuleToggle", () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it("renders both win rule options", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} />);
    expect(screen.getByText("Last Team Standing")).toBeInTheDocument();
    expect(screen.getByText("Must Win the Cup")).toBeInTheDocument();
  });

  it("default (last_standing) option has aria-checked=true", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} />);
    expect(screen.getByTestId("win-rule-last_standing")).toHaveAttribute("aria-checked", "true");
    expect(screen.getByTestId("win-rule-strict")).toHaveAttribute("aria-checked", "false");
  });

  it("clicking strict calls onChange with 'strict'", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("win-rule-strict"));
    expect(onChange).toHaveBeenCalledWith("strict");
  });

  it("clicking last_standing calls onChange with 'last_standing'", () => {
    render(<WinRuleToggle value="strict" onChange={onChange} />);
    fireEvent.click(screen.getByTestId("win-rule-last_standing"));
    expect(onChange).toHaveBeenCalledWith("last_standing");
  });

  it("renders explanation text for each option", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} />);
    expect(screen.getByText(/last player whose country is still alive/i)).toBeInTheDocument();
    expect(screen.getByText(/only wins if their country wins the entire tournament/i)).toBeInTheDocument();
  });

  it("has role='radiogroup'", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });

  it("is disabled when disabled=true", () => {
    render(<WinRuleToggle value="last_standing" onChange={onChange} disabled />);
    const options = screen.getAllByRole("radio");
    options.forEach((opt) => expect(opt).toBeDisabled());
  });
});
