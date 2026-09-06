import type { Metadata } from "next";
import SkinQuiz from "@/components/SkinQuiz";
import { JsonLd } from "@/components/seo/JsonLd";
import { pageMetadata, SITE_DESCRIPTION, SITE_TITLE, SITE_URL } from "@/lib/seo";

export const metadata: Metadata = pageMetadata({
  title: SITE_TITLE,
  description: SITE_DESCRIPTION,
  path: "/",
});

/** The quiz itself, described for search engines as the free tool it is. */
const quizJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "@id": `${SITE_URL}/#quiz`,
  name: "SealedSkin skincare routine quiz",
  url: SITE_URL,
  applicationCategory: "HealthApplication",
  browserRequirements: "Requires JavaScript.",
  operatingSystem: "Any",
  description: SITE_DESCRIPTION,
  inLanguage: "en",
  isAccessibleForFree: true,
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  publisher: { "@id": `${SITE_URL}/#organization` },
  featureList: [
    "Seven-question skin type analysis",
    "Personalised morning and evening routine",
    "Ingredient recommendations for your concerns",
    "Product suggestions at several budgets",
    "Pregnancy-safe ingredient filtering",
  ],
};

export default function Home() {
  return (
    <>
      <JsonLd data={quizJsonLd} />
      <SkinQuiz />
    </>
  );
}
