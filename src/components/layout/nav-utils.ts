/** Segment bo'yicha faol marshrut: /ishlar → /ishlar va /ishlar/…, lekin /ishlar-boshqa EMAS; "/" faqat aniq moslik */
export function routeActive(pathname: string, href: string, exact?: boolean): boolean {
  if (exact || href === "/") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Ota yo'l: /mutaxassislar/slug → /mutaxassislar; /narxlar → / */
export function parentPath(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length <= 1) return "/";
  return `/${parts.slice(0, -1).join("/")}`;
}
