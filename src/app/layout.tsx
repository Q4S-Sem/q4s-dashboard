import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

// Geist Sans — hetzelfde strakke, moderne schreefloos als het Studio Admin
// dashboard: neutrale lettervormen, uitstekend leesbaar in dichte tabellen.
const sans = Geist({
  variable: "--font-sans-family",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Q4S Dashboard",
    template: "%s · Q4S Dashboard",
  },
  description:
    "Het interne platform van Q4S voor detachering: werknemers, plaatsingen, urenregistratie, marges en facturatie.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="nl"
      className={`${sans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
