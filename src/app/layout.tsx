import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

/* The heading face. Packages sharing one face are hard to tell apart. */
const display = Newsreader({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["700"],
});

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  applicationName: "image-to-pdf",
  description:
    "Rebuild a photo of a paper document as a clean PDF with real text, tables and boxes, using Claude, OpenAI or Gemini with your own API key.",
  formatDetection: { telephone: false },
  metadataBase: new URL("https://image-to-pdf.kkweb.io"),
  title: "image-to-pdf - Photo In, Typeset PDF Out",
};

export const viewport: Viewport = {
  themeColor: "#0d0f12",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${display.variable} font-sans antialiased`}
      >
        {children}
        <Analytics />
      </body>
    </html>
  );
}
