import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LuftGo",
  description: "AI travel planner powered by Lufthansa and Google ADK",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Google Sans font (matches the Figma design system) */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;700&family=Google+Sans+Text:wght@400;500&family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400;1,600&display=swap"
          rel="stylesheet"
        />

      </head>
      <body>{children}</body>
    </html>
  );
}
