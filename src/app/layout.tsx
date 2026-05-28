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

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "https://debatethisnow.com";

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: "DebateThis — Online Debate Practice, 1v1 vs Humans or AI",
    template: "%s · DebateThis",
  },
  description:
    "Free online debate platform. Practice structured 1v1 debates against real opponents or AI bots. Three rounds, real Elo ranking, no signup wall. Best debate practice app for students, debate clubs, and anyone who likes to argue.",
  applicationName: "DebateThis",
  keywords: [
    "debate",
    "online debate",
    "debate practice",
    "debate app",
    "debate game",
    "debate platform",
    "1v1 debate",
    "AI debate",
    "AI debate practice",
    "debate against AI",
    "free debate",
    "debate club",
    "debate topics",
    "debate training",
    "argument practice",
    "competitive debate",
    "Lincoln-Douglas debate",
    "Public Forum debate",
    "policy debate",
    "Congressional debate",
    "PF debate",
    "speech and debate",
    "debate coach online",
    "debate tournament",
    "debate Elo",
    "structured argument",
    "argue online",
  ],
  authors: [{ name: "DebateThis" }],
  creator: "DebateThis",
  publisher: "DebateThis",
  alternates: { canonical: BASE_URL },
  openGraph: {
    type: "website",
    url: BASE_URL,
    title: "DebateThis — Online Debate Practice, 1v1 vs Humans or AI",
    description:
      "Free 1v1 debate practice. Three rounds. Real Elo. Bot opponents 24/7. The fastest way to get reps in.",
    siteName: "DebateThis",
    locale: "en_US",
    images: [{ url: `${BASE_URL}/og-default.png`, width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "DebateThis — Online Debate Practice, 1v1 vs Humans or AI",
    description: "Three rounds. One winner. Real Elo. Free practice against AI.",
    images: [`${BASE_URL}/og-default.png`],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

// Site-wide JSON-LD. Two blocks:
//   1. WebSite with SearchAction — unlocks the Google sitelinks search
//      box for branded "debatethis" queries.
//   2. Organization — establishes DebateThis as a real entity Google
//      can attribute articles to and show in the knowledge panel.
// Both inlined in the <head> via a single <script> per Next.js
// recommendation. Stays static, no JS, gets indexed on every crawl.
const siteJsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${BASE_URL}#website`,
      url: BASE_URL,
      name: "DebateThis",
      description:
        "Free online debate platform. Practice 1v1 against humans or AI.",
      publisher: { "@id": `${BASE_URL}#organization` },
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${BASE_URL}/blog?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
      inLanguage: "en-US",
    },
    {
      "@type": "Organization",
      "@id": `${BASE_URL}#organization`,
      name: "DebateThis",
      url: BASE_URL,
      logo: {
        "@type": "ImageObject",
        url: `${BASE_URL}/og-default.png`,
        width: 1200,
        height: 630,
      },
      description:
        "Online debate practice platform. 1v1 debates against humans or AI, structured rounds, real Elo ranking.",
    },
  ],
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
      <head>
        {/* Site-wide JSON-LD. WebSite + Organization on every page so
            Google can resolve the entity consistently across the corpus. */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(siteJsonLd) }}
        />
      </head>
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
