import { Button } from "@/components/ui/Button";

export function Hero() {
  return (
    <section className="relative flex min-h-[85svh] flex-col items-center justify-center px-6 py-20 text-center">
      {/* Subtle radial glow behind the trophy */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 flex items-center justify-center"
      >
        <div className="h-[500px] w-[500px] rounded-full bg-gold/5 blur-[120px]" />
      </div>

      {/* Trophy + wordmark */}
      <div className="animate-slide-up relative z-10">
        <div className="mb-4 text-7xl" aria-hidden="true">
          🏆
        </div>
        <h1 className="mb-4 text-5xl font-extrabold tracking-tight text-gold sm:text-6xl md:text-7xl">
          WinCup
        </h1>
        <p className="mx-auto mb-10 max-w-xl text-lg text-muted sm:text-xl">
          Pick a country. Follow the cup.{" "}
          <span className="text-white font-medium">One winner takes it all.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
          <Button href="/room/create" size="lg" variant="primary">
            Create Room
          </Button>
          <Button href="/room/join" size="lg" variant="outline">
            Join Room
          </Button>
        </div>
      </div>
    </section>
  );
}
