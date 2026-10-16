import type { Metadata } from "next";
// Self-hosted variable font, so builds don't depend on reaching Google Fonts.
import "@fontsource-variable/schibsted-grotesk";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ezepue James, fullstack software engineer",
  description:
    "Fullstack engineer in Lagos building web and mobile products in TypeScript, React, Next.js, React Native, Node.js and PostgreSQL. Open to remote roles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
