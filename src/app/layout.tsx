import type { Metadata } from "next";
import "@fontsource-variable/plus-jakarta-sans";
import "@fontsource-variable/jetbrains-mono";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Pistonpad", template: "%s · Pistonpad" },
  description: "Spare parts billing and stock, plus used bike sales, papers and loans, for a two-wheeler shop.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Browser extensions (Grammarly, password managers…) add attributes to <html> and <body> before React
    // loads; don't warn about those. This only affects these two tags' own attributes, not the page inside.
    <html lang="en-IN" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
