import type { MetadataRoute } from "next";
import { absoluteUrl, SITE_URL } from "@/lib/seo";

/**
 * Served at /robots.txt.
 *
 * Everything public is crawlable. The two exclusions are `/api/` (endpoints,
 * not pages - and `/api/routine` costs a paid model call per request) and
 * `/profile`, which is auth-gated and renders a sign-in prompt to a crawler.
 * `/profile` is *also* marked noindex in its own metadata: robots.txt stops the
 * fetch, the meta tag stops indexing if it is reached another way.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/profile"],
      },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
    host: SITE_URL,
  };
}
