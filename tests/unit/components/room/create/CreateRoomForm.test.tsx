import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock the createRoom Server Action before importing the form
jest.mock("@/actions/room", () => ({
  createRoom: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: (
      action: (prevState: unknown, formData: FormData) => Promise<unknown>,
      initial: unknown
    ) => {
      return [initial, (fd: FormData) => action(initial, fd), false];
    },
  };
});

import { CreateRoomForm } from "@/app/room/create/_components/CreateRoomForm";

const COUNTRIES = [
  { code: "ARG", name: "Argentina", flag_emoji: "🇦🇷" },
  { code: "BRA", name: "Brazil", flag_emoji: "🇧🇷" },
  { code: "FRA", name: "France", flag_emoji: "🇫🇷" },
  { code: "ENG", name: "England", flag_emoji: "🏴󠁧󠁢󠁥󠁮󠁧󠁿" },
  { code: "GER", name: "Germany", flag_emoji: "🇩🇪" },
];

function renderForm(props = {}) {
  return render(
    <CreateRoomForm
      countries={COUNTRIES.map((country) => ({ ...country, is_knocked_out: false }))}
      defaultHostName="golazo99"
      {...props}
    />
  );
}

function enterStake(value = "10") {
  fireEvent.change(screen.getByLabelText(/stake amount/i), {
    target: { value },
  });
}

function selectRequiredCountries() {
  ["ARG", "BRA"].forEach((code) => {
    fireEvent.click(screen.getByTestId(`country-card-${code}`));
  });
}

describe("CreateRoomForm", () => {
  beforeEach(() => jest.clearAllMocks());

  it("pre-fills host name with defaultHostName", () => {
    renderForm();
    const nameInput = document.querySelector<HTMLInputElement>('input[name="hostName"]');
    expect(nameInput?.value).toBe("golazo99");
  });

  it("submit button is disabled when fewer than 2 countries selected", () => {
    renderForm();
    const btn = screen.getByTestId("create-room-submit");
    expect(btn).toBeDisabled();
  });

  it("submit button becomes enabled after selecting 2 countries", () => {
    renderForm();
    enterStake();
    selectRequiredCountries();
    expect(screen.getByTestId("create-room-submit")).not.toBeDisabled();
  });

  it("keeps submit disabled until a stake is entered", () => {
    renderForm();
    selectRequiredCountries();

    expect(screen.getByTestId("create-room-submit")).toBeDisabled();
    expect(screen.getByText(/Enter a stake amount greater than 0/i)).toBeInTheDocument();

    enterStake();
    expect(screen.getByTestId("create-room-submit")).not.toBeDisabled();
  });

  it("submit button is disabled if name is cleared", () => {
    renderForm({ defaultHostName: "" });
    enterStake();
    selectRequiredCountries();
    // Name is still empty
    expect(screen.getByTestId("create-room-submit")).toBeDisabled();
  });

  it("selecting and deselecting a country updates the counter", () => {
    renderForm();
    fireEvent.click(screen.getByTestId("country-card-ARG"));
    expect(screen.getByText(/Selected: 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("country-card-ARG"));
    expect(screen.getByText(/Selected: 0/)).toBeInTheDocument();
  });

  it("selects and clears all available countries from the bulk selector", () => {
    renderForm();

    const selectAll = screen.getByTestId("select-all-countries");
    fireEvent.click(selectAll);

    expect(screen.getByText(/Selected: 5 \/ 5/)).toBeInTheDocument();
    expect(selectAll).toHaveAttribute("aria-checked", "true");
    expect(document.querySelectorAll<HTMLInputElement>('input[name="countries"]')).toHaveLength(5);

    fireEvent.click(selectAll);

    expect(screen.getByText(/Selected: 0 \/ 5/)).toBeInTheDocument();
    expect(selectAll).toHaveAttribute("aria-checked", "false");
    expect(document.querySelectorAll<HTMLInputElement>('input[name="countries"]')).toHaveLength(0);
  });

  it("renders all form sections", () => {
    renderForm();
    expect(screen.getByText("1. Room Setup")).toBeInTheDocument();
    expect(screen.getByText("2. Your Info")).toBeInTheDocument();
    expect(screen.getByText("3. Assignment Mode")).toBeInTheDocument();
    expect(screen.getByText("4. Win Rule")).toBeInTheDocument();
    expect(screen.getByText("5. Pick Countries")).toBeInTheDocument();
    expect(screen.getByText("6. Stake")).toBeInTheDocument();
  });

  it("does not render knocked-out countries in the picker", () => {
    renderForm({
      countries: [
        ...COUNTRIES.slice(0, 4).map((country) => ({ ...country, is_knocked_out: false })),
        { code: "ITA", name: "Italy", flag_emoji: "🇮🇹", is_knocked_out: true },
      ],
    });

    expect(screen.queryByTestId("country-card-ITA")).not.toBeInTheDocument();
    expect(screen.queryByText("Italy")).not.toBeInTheDocument();
    expect(screen.getByText(/Selected: 0 \/ 4/)).toBeInTheDocument();
  });

  it("select all ignores knocked-out countries", () => {
    renderForm({
      countries: [
        ...COUNTRIES.slice(0, 4).map((country) => ({ ...country, is_knocked_out: false })),
        { code: "ITA", name: "Italy", flag_emoji: "🇮🇹", is_knocked_out: true },
      ],
    });

    fireEvent.click(screen.getByTestId("select-all-countries"));

    expect(screen.getByText(/Selected: 4 \/ 4/)).toBeInTheDocument();
    expect(document.querySelectorAll<HTMLInputElement>('input[name="countries"]')).toHaveLength(4);
    expect(document.querySelector<HTMLInputElement>('input[name="countries"][value="ITA"]')).toBeNull();
  });

  it("requires a host country when player choice is selected and the host is playing", () => {
    renderForm();

    enterStake();
    selectRequiredCountries();

    fireEvent.click(screen.getByRole("button", { name: /Player choice/i }));
    expect(screen.getByTestId("create-room-submit")).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Choose your country"), {
      target: { value: "ARG" },
    });
    expect(screen.getByTestId("create-room-submit")).not.toBeDisabled();
  });
});
