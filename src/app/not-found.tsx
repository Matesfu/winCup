import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-20 text-center">
      <div className="text-6xl" aria-hidden="true">🏳️</div>
      <h1 className="mt-4 text-4xl font-bold text-white">Page Not Found</h1>
      <p className="mt-3 text-muted">
        That room code or page doesn&apos;t exist.
      </p>
      <div className="mt-8">
        <Button href="/" variant="outline">
          Back to Home
        </Button>
      </div>
    </main>
  );
}
