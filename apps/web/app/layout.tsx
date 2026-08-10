import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Virtelon Platform",
  description: "AI-powered lead generation and outreach.",
};

const THEME_INIT_SCRIPT = `
  try {
    var t = localStorage.getItem("virtelon-theme");
    if (t === "light" || t === "dark") document.documentElement.setAttribute("data-theme", t);
  } catch (e) {}
`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Runs before paint so a saved theme choice doesn't flash the OS default first. */}
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      {/* suppressHydrationWarning: browser extensions (e.g. Grammarly) inject
          attributes like cz-shortcut-listen onto <body> before React
          hydrates — a false-positive mismatch, not an app bug. */}
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
