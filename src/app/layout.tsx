import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

/**
 * Using Inter as a reliable system-available fallback.
 * Swap for Plus_Jakarta_Sans once network fonts are confirmed:
 *   import { Plus_Jakarta_Sans } from "next/font/google";
 *   const font = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta" });
 */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "WinCup — Pick a country. Follow the cup.",
  description:
    "A social game for friends during the football World Cup. One random country per player. Last one standing wins.",
  openGraph: {
    title: "WinCup",
    description: "Pick a country. Follow the cup. One winner takes it all.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="flex min-h-full flex-col bg-background text-white antialiased">
        {children}
      </body>
    </html>
  );
}
