import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LH Travel Agent",
  description: "AI travel agent powered by Lufthansa and Google ADK",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
