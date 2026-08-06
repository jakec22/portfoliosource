import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Clip Combiner",
  description: "Combine short clips into one video, with AI-proposed edit options.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-neutral-950 text-neutral-100">{children}</body>
    </html>
  );
}
