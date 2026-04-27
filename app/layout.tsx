import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HistoGuess",
  description: "Guess the historical event",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
