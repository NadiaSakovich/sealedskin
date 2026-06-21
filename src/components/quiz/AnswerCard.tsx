import type { AnswerStyle, QuestionOption } from "../../types";
import { CheckDot } from "../ui/CheckDot";
import { PhotoSlot } from "../ui/PhotoSlot";

interface Props {
  option: QuestionOption;
  selected: boolean;
  onClick: () => void;
  style: AnswerStyle;
}

export function AnswerCard({ option, selected, onClick, style }: Props) {
  const base = `w-full text-left appearance-none cursor-pointer font-body text-ss-ink transition-[border-color,background,box-shadow,transform] duration-150 ${
    selected
      ? "border-[1.5px] border-ss-accent bg-ss-accent-tint shadow-[0_8px_22px_-16px_rgba(36,63,57,.55)]"
      : "border-[1.5px] border-ss-hairline bg-ss-surface shadow-[0_1px_2px_rgba(36,63,57,.04)]"
  }`;

  if (style === "list") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex items-center gap-[14px] px-[18px] py-4 rounded-xl`}>
        <CheckDot selected={selected} />
        <span className="text-[16.5px] font-medium tracking-[-0.01em]">{option.label}</span>
      </button>
    );
  }

  if (style === "photos") {
    return (
      <button type="button" onClick={onClick} className={`${base} flex items-center gap-4 p-[14px] rounded-2xl`}>
        <div className="basis-[76px] shrink-0">
          <PhotoSlot label={option.photo ?? ""} radius={11} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[16.5px] font-semibold tracking-[-0.01em] mb-[3px]">{option.label}</div>
          <div className="text-[13.5px] leading-[1.4] text-ss-ink-soft">{option.desc}</div>
        </div>
        <CheckDot selected={selected} />
      </button>
    );
  }

  // "cards" — label + description, no photo (the locked default)
  return (
    <button type="button" onClick={onClick} className={`${base} flex items-start gap-[14px] px-[18px] py-[18px] rounded-[14px]`}>
      <CheckDot selected={selected} />
      <div className="flex-1 min-w-0">
        <div className="text-[16.5px] font-semibold tracking-[-0.01em] mb-[3px]">{option.label}</div>
        <div className="text-[13.5px] leading-[1.4] text-ss-ink-soft">{option.desc}</div>
      </div>
    </button>
  );
}
