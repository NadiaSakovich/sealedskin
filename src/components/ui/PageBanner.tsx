import Image from "next/image";

/**
 * Full-width banner for the content routes (About, How it works). Spans the
 * reading column and is deliberately short — 21:9, so it's ~2.3x wider than it
 * is tall and doesn't eat the page's vertical space.
 */
export function PageBanner({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="relative w-full aspect-[21/9] overflow-hidden rounded-2xl border border-ss-hairline bg-ss-photo-bg">
      <Image src={src} alt={alt} fill priority sizes="(max-width: 720px) 100vw, 680px" className="object-cover" />
    </div>
  );
}
