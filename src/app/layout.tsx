import type { Metadata } from "next";
import { Bevan, Oswald, Lora, Special_Elite } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar/Sidebar";
import { AppProviders } from "@/components/providers/AppProviders";

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
            App-shell grid: 240px sidebar + flexible main, mirroring main.css's
            `grid-template-columns: 240px 1fr`. Sidebar collapse state is owned
            by the Sidebar component itself (localStorage-persisted).
          */}
          <div className="app-shell grid min-h-screen grid-cols-[240px_1fr] data-[collapsed=true]:grid-cols-[0_1fr]">
            <Sidebar />
            <main className="relative z-10 p-9 px-11 max-w-[1400px]">
              {children}
            </main>
          </div>
        </AppProviders>
      </body>
    </html>
  );
}
