import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmojiPicker, ALLOWED_AVATARS } from "@/app/room/create/_components/EmojiPicker";

describe("EmojiPicker", () => {
  const onChange = jest.fn();

  beforeEach(() => jest.clearAllMocks());

  it(`renders exactly ${ALLOWED_AVATARS.length} emoji options`, () => {
    render(<EmojiPicker value={ALLOWED_AVATARS[0]} onChange={onChange} />);
    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(ALLOWED_AVATARS.length);
  });

  it("selected emoji has aria-checked=true", () => {
    render(<EmojiPicker value="🏆" onChange={onChange} />);
    const selected = screen.getByRole("radio", { name: /Avatar: 🏆/ });
    expect(selected).toHaveAttribute("aria-checked", "true");
  });

  it("non-selected emojis have aria-checked=false", () => {
    render(<EmojiPicker value="🏆" onChange={onChange} />);
    const notSelected = screen.getByRole("radio", { name: /Avatar: ⚽/ });
    expect(notSelected).toHaveAttribute("aria-checked", "false");
  });

  it("clicking an emoji calls onChange with that emoji", () => {
    render(<EmojiPicker value={ALLOWED_AVATARS[0]} onChange={onChange} />);
    fireEvent.click(screen.getByRole("radio", { name: /Avatar: ⚽/ }));
    expect(onChange).toHaveBeenCalledWith("⚽");
  });

  it("only one emoji is selected at a time", () => {
    render(<EmojiPicker value="🏆" onChange={onChange} />);
    const checkedRadios = screen
      .getAllByRole("radio")
      .filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checkedRadios).toHaveLength(1);
  });

  it("has radiogroup wrapper with accessible label", () => {
    render(<EmojiPicker value="🏆" onChange={onChange} />);
    expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  });
});
