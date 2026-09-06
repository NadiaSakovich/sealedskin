import type { Metadata } from "next";
import "./globals.css";
import { JsonLd } from "@/components/seo/JsonLd";
import { OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL, siteJsonLd } from "@/lib/seo";

export const metadata: Metadata = {
  /* Lets every route below express canonical/OG URLs as relative paths. */
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    /* Pages set a bare title ("About"); the suffix is added here. */
    template: "%s - SealedSkin",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "skincare routine",
    "personalised skincare",
    "skin type quiz",
    "skincare quiz",
    "morning and evening routine",
    "skincare ingredients",
    "AM PM routine",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      /* Let Google show the full snippet and a large thumbnail. */
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },
  /* Defaults only. Every page sets its own complete card via `pageMetadata`,
     because Next replaces `openGraph` wholesale rather than merging it. */
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: "/",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [OG_IMAGE.url],
  },
  /* Search Console's HTML-tag verification. Unset locally, so nothing renders;
     DNS verification at the registrar works just as well and needs no deploy. */
  verification: {
    google: process.env.GOOGLE_SITE_VERIFICATION,
  },
  category: "health",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Apply the saved (or system) theme before first paint to avoid a flash.
            Runs synchronously during HTML parsing. Keep in sync with ThemeToggle. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("ss-theme");if(t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches)){document.documentElement.classList.add("dark")}}catch(e){}})()`,
          }}
        />
        <JsonLd data={siteJsonLd()} />
      </head>
      <body>{children}</body>
    </html>
  );
}
