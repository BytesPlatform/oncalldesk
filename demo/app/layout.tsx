import type { Metadata, Viewport } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const clerkConfigured = Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && process.env.CLERK_SECRET_KEY);

const SITE_URL = "https://hvac-ai-receptionist-lovat.vercel.app";
const TITLE = "AI Receptionist for HVAC | 24/7 Emergency Dispatch";
const DESCRIPTION =
  "AI receptionist for HVAC contractors that answers every call, triages no-heat and no-AC emergencies, books jobs and texts your on-call tech. See the demo.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Northline Heating and Cooling AI service line",
  keywords: [
    "AI receptionist for HVAC",
    "HVAC answering service",
    "after hours HVAC dispatch",
    "HVAC emergency call answering",
    "Jobber AI receptionist",
    "Retell AI HVAC",
  ],
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large", "max-video-preview": -1 },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "AI Receptionist for HVAC demo",
    title: TITLE,
    description: DESCRIPTION,
    locale: "en_US",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: "AI receptionist for HVAC demo: the call, the dispatch board and the revenue it recovers" }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/opengraph-image"],
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fb" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0e17" },
  ],
};

const STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "AI Receptionist for HVAC",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: SITE_URL,
  description: DESCRIPTION,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD", description: "Live demo" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Clerk wraps the tree only when its keys exist, so the public demo still
  // builds and deploys before the Clerk application is created.
  const body = clerkConfigured ? <ClerkProvider afterSignOutUrl="/">{children}</ClerkProvider> : children;
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&display=swap"
        />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(STRUCTURED_DATA) }} />
      </head>
      <body>{body}</body>
    </html>
  );
}
