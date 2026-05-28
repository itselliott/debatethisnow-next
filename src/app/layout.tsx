import type { Metadata } from "next";
import { Bevan, Oswald, Lora, Special_Elite } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";
import { AppShell } from "@/components/AppShell";

const bevan = Bevan({
  variable: "--font-bevan",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});
const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  display: "swap",
});
const specialElite = Special_Elite({
  variable: "--font-special-elite",
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "DebateThis",
  description:
    "An online arena for arguments. Three rounds. One winner. Real Elo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${bevan.variable} ${oswald.variable} ${lora.variable} ${specialElite.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <AppProviders>
          {/*
            AppShell decides whether to render the sidebar grid based on
            the current path. Public auth/landing pages (/, /login,
            /register) skip the grid entirely so the form is centered;
            authed pages get the 240px sidebar + main grid.
          */}
          <AppShell>{children}</AppShell>
        </AppProviders>
      </body>
    </html>
  );
}
