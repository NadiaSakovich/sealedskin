import type { Metadata } from "next";

/**
 * Site-level SEO constants and structured-data builders.
 *
 * `SITE_URL` is the canonical origin every absolute URL is built from - the
 * sitemap, robots.txt, `metadataBase`, the OG tags and the JSON-LD all read it,
 * so a domain change is one edit (or one env var) rather than a grep.
 *
 * It must be an absolute origin with no trailing slash: `metadataBase` composes
 * relative metadata paths onto it, and a trailing slash would double up.
 *
 * It must also be the host that answers 200, not one that redirects there. The
 * apex `sealedskin.com` 308s to `www` (Vercel's primary domain for the project),
 * so a canonical pointing at the apex would send every crawler through a hop and
 * name a URL that is not the one finally served. Flip this only together with
 * the primary domain in the Vercel dashboard, and with `next.config.ts`.
 */
const RAW_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://www.sealedskin.com";

export const SITE_URL = RAW_SITE_URL.replace(/\/+$/, "");

export const SITE_NAME = "SealedSkin";

/** Used as the home page title and the OG title. Kept under ~60 characters. */
export const SITE_TITLE = "SealedSkin - Build your personalised skincare routine";

/** Used as the default meta description. Kept under ~160 characters. */
export const SITE_DESCRIPTION =
  "Answer seven questions about your skin and get a personalised morning and evening skincare routine, the ingredients that suit you, and products at every budget.";

/**
 * The link-preview card, generated from `design-drafts/og-image/card.html`.
 * `src/app/opengraph-image.jpg` is a Next file convention, so this path is a
 * real route - referencing it explicitly (rather than letting the convention
 * inject it) keeps the URL stable and identical on every page.
 */
export const OG_IMAGE = {
  url: "/opengraph-image.jpg",
  type: "image/jpeg",
  width: 1200,
  height: 630,
  alt: "SealedSkin - build your personalised skincare routine. Seven questions about your skin, and a morning and evening routine you can actually keep.",
} as const;

/** Absolute URL for a site-relative path, e.g. `/about` -> `https://…/about`. */
export function absoluteUrl(path: string): string {
  return path === "/" ? SITE_URL : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * The site's identity, emitted once from the root layout. `Organization` is
 * what Google reads for the knowledge panel / site name; `WebSite` is what it
 * reads to show "SealedSkin" rather than the bare domain in results.
 */
export function siteJsonLd() {
  return [
    {
      "@context": "https://schema.org",
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
      description: SITE_DESCRIPTION,
    },
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      name: SITE_NAME,
      url: SITE_URL,
      description: SITE_DESCRIPTION,
      inLanguage: "en",
      publisher: { "@id": `${SITE_URL}/#organization` },
    },
  ];
}

/**
 * Per-page metadata: canonical URL plus a complete Open Graph and Twitter card.
 *
 * The completeness is the point. Next does NOT deep-merge `openGraph` - a page
 * that sets it replaces the layout's object entirely, silently dropping
 * `og:image`, `og:type` and `og:site_name`. Building the whole object here means
 * a page cannot half-set it. `twitter` is restated for the same reason: leaving
 * it to the layout gave every page the home page's title and description.
 *
 * `title` is the bare page title ("About"); the layout's template appends the
 * brand for `<title>`, and `brandedTitle` does the same for the social cards,
 * which get no template.
 */
export function pageMetadata({
  title,
  description,
  path,
}: {
  title: string;
  description: string;
  path: string;
}): Metadata {
  const brandedTitle = path === "/" ? SITE_TITLE : `${title} - ${SITE_NAME}`;
  return {
    title: path === "/" ? { absolute: brandedTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "en_US",
      url: path,
      title: brandedTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: brandedTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}
