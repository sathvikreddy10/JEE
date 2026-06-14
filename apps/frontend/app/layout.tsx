import type { Metadata } from "next";
import { Preloader } from "@/components/Preloader";
import { CursorEffect } from "@/components/CursorEffect";
import "./globals.css";

export const metadata: Metadata = {
  title: "Testify — Learn. Test. Analyse.",
  description:
    "Testify is a minimal test platform for JEE/NEET students. Take focused tests, get instant analysis, and study smarter — without the noise.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="paper">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300..700;1,9..144,300..700&family=Space+Grotesk:wght@300..700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Preloader />
        <CursorEffect />
        <div className="grain" aria-hidden="true" />
        {children}
      </body>
    </html>
  );
}
