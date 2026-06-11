import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "rfjs — RoyFW's TypeScript utility toolkit",
  description:
    "Utilities, playgrounds, and developer data tools for JSON, objects, filters, and query workflows.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
