import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { HowItWorks } from "@/components/landing/HowItWorks";

describe("HowItWorks", () => {
  beforeEach(() => {
    render(<HowItWorks />);
  });

  it('renders the "How it works" section heading', () => {
    expect(
      screen.getByRole("heading", { name: /How it works/i })
    ).toBeInTheDocument();
  });

  it("renders exactly 3 steps", () => {
    const steps = screen.getAllByTestId("how-step");
    expect(steps).toHaveLength(3);
  });

  it("renders step 1 content about picking countries", () => {
    expect(
      screen.getByText(/Pick Countries/i)
    ).toBeInTheDocument();
  });

  it("renders step 2 content about the draw", () => {
    expect(screen.getByText(/The Draw/i)).toBeInTheDocument();
  });

  it("renders step 3 content about following the tournament", () => {
    expect(
      screen.getByText(/Follow the Tournament/i)
    ).toBeInTheDocument();
  });

  it("renders step numbers 01, 02, 03", () => {
    expect(screen.getByText("01")).toBeInTheDocument();
    expect(screen.getByText("02")).toBeInTheDocument();
    expect(screen.getByText("03")).toBeInTheDocument();
  });
});
