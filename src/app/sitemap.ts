import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

/**
 * The public URL set, served at /sitemap.xml and pointed at by robots.txt.
 *
 * Only the three indexable routes belong here. `/profile` is auth-gated and
 * marked noindex, and `/api/*` is not a page - listing either would just spend
 * crawl budget on URLs that return nothing useful.
 *
 * `lastModified` is a hand-kept date rather than `new Date()`: a build-time
 * timestamp would tell crawlers every page changed on every deploy, which
 * teaches them to ignore the field. Bump the entry when the page's copy
 * actually changes.
 */
const ROUTES: { path: string; lastModified: string; changeFrequency: "monthly" | "yearly"; priority: number }[] = [
  { path: "/", lastModified: "2026-08-22", changeFrequency: "monthly", priority: 1 },
  { path: "/how-it-works", lastModified: "2026-08-22", changeFrequency: "monthly", priority: 0.8 },
  { path: "/about", lastModified: "2026-08-30", changeFrequency: "monthly", priority: 0.6 },
];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((route) => ({
    url: absoluteUrl(route.path),
    lastModified: new Date(route.lastModified),
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }));
}
