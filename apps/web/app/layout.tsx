import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtelon Platform",
  description: "AI-powered lead generation and outreach.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like cz-shortcut-listen onto <body> before React
          hydrates — a false-positive mismatch, not an app bug. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
