import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Testify — Config-Driven JEE Test Platform",
  description: "Real exams, real analytics, real rank predictions for JEE/NEET students",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}