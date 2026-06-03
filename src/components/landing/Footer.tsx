export function Footer() {
  return (
    <footer className="border-t border-white/5 px-6 py-10 text-center">
      <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted">
        Create public or private World Cup rooms, follow assigned countries,
        and keep the competition moving from the first draw to the final result.
      </p>
      <p className="mt-4 text-xs text-muted/40">
        © {new Date().getFullYear()} WinCup
      </p>
    </footer>
  );
}
