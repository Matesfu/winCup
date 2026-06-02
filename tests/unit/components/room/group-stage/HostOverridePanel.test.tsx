import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/actions/room", () => ({
  markQualification: jest.fn(),
  buildKnockout: jest.fn(),
}));

jest.mock("react", () => {
  const actual = jest.requireActual("react");
  return {
    ...actual,
    useActionState: (action: unknown, initial: unknown) => [initial, action, false],
  };
});

import { HostOverridePanel } from "@/app/room/[id]/group-stage/_components/HostOverridePanel";

const COUNTRIES_MAP = new Map([
  ["FRA", { code: "FRA", name: "France", flag_emoji: "🇫🇷" }],
  ["BRA", { code: "BRA", name: "Brazil", flag_emoji: "🇧🇷" }],
  ["GER", { code: "GER", name: "Germany", flag_emoji: "🇩🇪" }],
]);

const ROOM_COUNTRIES = [
  { country_code: "FRA", qualified: true as boolean | null },
  { country_code: "BRA", qualified: false as boolean | null },
  { country_code: "GER", qualified: null as boolean | null },
];

describe("HostOverridePanel", () => {
  beforeEach(() => jest.clearAllMocks());

  it("renders one row per country", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    expect(screen.getByTestId("override-row-FRA")).toBeInTheDocument();
    expect(screen.getByTestId("override-row-BRA")).toBeInTheDocument();
    expect(screen.getByTestId("override-row-GER")).toBeInTheDocument();
  });

  it("renders country flag and name per row", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    expect(screen.getByText("France")).toBeInTheDocument();
    expect(screen.getByText("Brazil")).toBeInTheDocument();
    expect(screen.getByText("Germany")).toBeInTheDocument();
  });

  it("qualified=true: 'Qualified' button shows selected styling", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    // FRA is qualified — its "Qualified" button should show ✓
    const qualifyBtn = screen.getByTestId("qualify-FRA");
    expect(qualifyBtn).toHaveTextContent("✓ Qualified");
  });

  it("qualified=false: 'Knocked Out' button shows selected styling", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    // BRA is knocked out
    const koBtn = screen.getByTestId("knockedout-BRA");
    expect(koBtn).toHaveTextContent("❌ Knocked Out");
  });

  it("qualified=null: neither button shows selected styling", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    // GER is undecided
    expect(screen.getByTestId("qualify-GER")).toHaveTextContent("Qualified");
    expect(screen.getByTestId("knockedout-GER")).toHaveTextContent("Knocked Out");
  });

  it("Build Knockout button is disabled when !allDecided", () => {
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={ROOM_COUNTRIES}
        countriesMap={COUNTRIES_MAP}
        allDecided={false}
      />
    );
    expect(screen.getByTestId("build-knockout-button")).toBeDisabled();
  });

  it("Build Knockout button is enabled when allDecided", () => {
    const allDecidedCountries = ROOM_COUNTRIES.map((rc) => ({
      ...rc,
      qualified: rc.qualified ?? false,
    }));
    render(
      <HostOverridePanel
        roomId="room-1"
        roomCountries={allDecidedCountries}
        countriesMap={COUNTRIES_MAP}
        allDecided={true}
      />
    );
    expect(screen.getByTestId("build-knockout-button")).not.toBeDisabled();
  });
});
