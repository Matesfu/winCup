import { Card } from "@/components/ui/Card";

const steps = [
  {
    emoji: "🎯",
    title: "Pick Countries & Invite Friends",
    description:
      "The host selects the group-stage countries and shares a short room code. Friends join from any device.",
  },
  {
    emoji: "🎲",
    title: "The Draw",
    description:
      "One country per player, assigned by a cryptographically secure random draw. Watch it unfold live, one dramatic reveal at a time.",
  },
  {
    emoji: "🏟️",
    title: "Follow the Tournament",
    description:
      "Results update automatically. Your country advances — you advance. Last player standing wins the pot.",
  },
];

export function HowItWorks() {
  return (
    <section className="px-6 py-20">
      <div className="mx-auto max-w-5xl">
        <h2 className="mb-12 text-center text-3xl font-bold text-white sm:text-4xl">
          How it works
        </h2>

        <ol className="grid gap-6 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li key={step.title} data-testid="how-step">
              <Card lift className="h-full text-center">
                <div className="mb-4 text-4xl" aria-hidden="true">
                  {step.emoji}
                </div>
                <div className="mb-2 flex items-center justify-center gap-2">
                  <span className="tabular-nums text-sm font-bold text-gold">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="text-base font-semibold text-white">
                    {step.title}
                  </h3>
                </div>
                <p className="text-sm leading-relaxed text-muted">
                  {step.description}
                </p>
              </Card>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
