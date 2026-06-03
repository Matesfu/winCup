interface PageBackdropProps {
  imageSrc: string;
  fit?: "container" | "viewport";
}

export function PageBackdrop({ imageSrc, fit = "container" }: PageBackdropProps) {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute inset-0 bg-center bg-no-repeat opacity-68 saturate-125"
        style={{
          backgroundImage: `url("${imageSrc}")`,
          backgroundSize: fit === "viewport" ? "auto 100svh" : "auto max(100svh, 100%)",
        }}
      />
      <div className="absolute inset-0 bg-background/42" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_16%,rgba(255,215,0,0.18),transparent_36%),radial-gradient(circle_at_10%_48%,rgba(16,185,129,0.1),transparent_32%),linear-gradient(180deg,rgba(10,14,26,0.14),rgba(10,14,26,0.5)_52%,rgba(10,14,26,0.82)_96%)]" />
    </div>
  );
}
