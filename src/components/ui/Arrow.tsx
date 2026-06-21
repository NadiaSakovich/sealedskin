export function Arrow({ back }: { back?: boolean }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={back ? "-scale-x-100" : ""}>
      <path
        d="M3 7.5h8M8 4l3.5 3.5L8 11"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
