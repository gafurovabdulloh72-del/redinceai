/** Reels yuklanayotganda — qora slayd o'rinbosari */
export default function Loading() {
  return (
    <div className="grid h-[calc(100dvh-3.5rem)] place-items-center bg-black md:h-dvh" aria-busy="true" aria-live="polite">
      <span className="skeleton h-[70%] max-h-[820px] aspect-[9/16] !rounded-[26px] opacity-30" />
    </div>
  );
}
