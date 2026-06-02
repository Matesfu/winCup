export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10 text-center">
      <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted">
        WinCup is for entertainment only. It does not handle, hold, or process
        any payments. All stakes are settled offline between friends.
      </p>
      <p className="mt-2 text-xs text-muted/60">
        18+ only. Check your local regulations before wagering.
      </p>
      <p className="mt-4 text-xs text-muted/40">
        © {new Date().getFullYear()} WinCup
      </p>
    </footer>
  );
}
