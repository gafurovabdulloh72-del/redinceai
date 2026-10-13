/**
 * User-Agent'dan qurilma tavsifi (kutubxonasiz, taxminiy): brauzer + operatsion tizim.
 * Faqat "Faol sessiyalar" ro'yxati uchun — xavfsizlik qarorlari bunga tayanmaydi.
 */
export interface DeviceInfo {
  browser: string;
  os: string;
  mobile: boolean;
  /** "Chrome · Windows" */
  label: string;
}

const BROWSERS: Array<[RegExp, string]> = [
  [/Telegram/i, "Telegram"],
  [/YaBrowser\//, "Yandex Browser"],
  [/Edg(A|iOS)?\//, "Edge"],
  [/OPR\/|Opera/, "Opera"],
  [/SamsungBrowser\//, "Samsung Internet"],
  [/FxiOS\/|Firefox\//, "Firefox"],
  [/CriOS\/|Chrome\//, "Chrome"],
  [/Version\/[\d.]+.*Safari\//, "Safari"],
  [/curl\//i, "curl"],
  [/node|undici/i, "Node.js"],
];

const SYSTEMS: Array<[RegExp, string]> = [
  [/iPhone|iPod/, "iOS"],
  [/iPad/, "iPadOS"],
  [/Android/, "Android"],
  [/CrOS/, "ChromeOS"],
  [/Windows NT/, "Windows"],
  [/Mac OS X|Macintosh/, "macOS"],
  [/Linux/, "Linux"],
];

export function describeUserAgent(ua: string | null | undefined): DeviceInfo {
  const s = ua ?? "";
  const browser = BROWSERS.find(([re]) => re.test(s))?.[1] ?? "Noma'lum brauzer";
  const os = SYSTEMS.find(([re]) => re.test(s))?.[1] ?? "Noma'lum tizim";
  const mobile = /Mobile|Android|iPhone|iPod/.test(s);
  return { browser, os, mobile, label: `${browser} · ${os}` };
}
