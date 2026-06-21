import Image from "next/image";

interface Props {
  label: string;
  ratio?: string;
  radius?: number;
  /** When set, renders the real image (object-cover) instead of the striped placeholder. */
  src?: string;
}

/** Skin imagery slot. Renders `src` when provided, else a striped placeholder. */
export function PhotoSlot({ label, ratio = "1 / 1", radius = 14, src }: Props) {
  if (src) {
    return (
      <div
        className="relative w-full overflow-hidden border border-ss-hairline bg-ss-photo-bg"
        style={{ aspectRatio: ratio, borderRadius: radius }}
      >
        <Image
          src={src}
          alt={label}
          fill
          sizes="(max-width: 700px) 50vw, 320px"
          className="object-cover"
        />
      </div>
    );
  }

  return (
    <div
      className="relative w-full flex items-center justify-center overflow-hidden border border-ss-hairline bg-ss-photo-bg [background-image:repeating-linear-gradient(135deg,rgba(55,100,88,0.13)_0_1px,transparent_1px_9px)]"
      style={{ aspectRatio: ratio, borderRadius: radius }}
    >
      <span className="font-mono text-[10.5px] tracking-[0.04em] lowercase text-ss-photo-text bg-ss-surface px-[7px] py-[3px] rounded-full text-center max-w-[84%] leading-[1.25]">
        {label}
      </span>
    </div>
  );
}
