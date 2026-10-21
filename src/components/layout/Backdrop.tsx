/** Fon (v6 «Sokin»): bitta tekis --bg rangi — hech qanday nur dog'i yoki gradient yo'q */
export function Backdrop() {
  return <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 bg-bg" />;
}
