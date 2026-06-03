export function WalletPreviewCard() {
  return (
    <section className="rounded-3xl border border-white/8 bg-surface p-4">
      <div className="flex items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gold/15 text-xl">
          💼
        </div>
        <div>
          <p className="text-lg font-extrabold text-white">Wallet</p>
          <p className="mt-1 text-sm text-muted">
            Coming soon: manage deposits, withdrawals, room payments, and wallet history from here.
          </p>
          <span className="mt-3 inline-flex rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-muted">
            Coming soon
          </span>
        </div>
      </div>
    </section>
  );
}
