interface Props {
  stageIndex: number;
  stageCount: number;
  fraction: number;
}

export function ProgressRail({ stageIndex, stageCount, fraction }: Props) {
  return (
    <div className="flex gap-2 w-full">
      {Array.from({ length: stageCount }).map((_, i) => {
        const fill = i < stageIndex ? 1 : i === stageIndex ? fraction : 0;
        return (
          <div key={i} className="flex-1 h-[5px] rounded-full bg-ss-track overflow-hidden">
            <div
              className="h-full rounded-full bg-ss-accent transition-[width] duration-[400ms] ease-[cubic-bezier(.22,1,.36,1)]"
              style={{ width: `${fill * 100}%` }}
            />
          </div>
        );
      })}
    </div>
  );
}
