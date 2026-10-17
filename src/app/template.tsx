/**
 * Sahifa o'tish animatsiyasi: template har navigatsiyada qayta o'rnatiladi, shuning uchun kontent
 * yumshoq kirib keladi (ijtimoiy tarmoqdagi kabi). Reduced-motion'da o'chadi (globals.css).
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="animate-page-in">{children}</div>;
}
