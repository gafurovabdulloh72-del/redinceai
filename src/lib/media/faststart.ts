/**
 * MP4/MOV «faststart» — video boshlanishini tezlatish (qt-faststart algoritmi, sof JS, klient va serverda ishlaydi).
 *
 * Ko'p montaj dasturlari va ba'zi telefonlar `moov` atomini (videoning mundarijasi: kadrlar qayerda turgani) faylning
 * OXIRIGA yozadi. Brauzer mundarijasiz o'ynata olmaydi — avval butun faylni yuklab olishga majbur bo'ladi (100 MB video
 * bir necha daqiqa «aylanib turadi»). Bu yerda `moov` fayl BOSHIGA ko'chiriladi va undagi bo'lak manzillari
 * (`stco`/`co64`) mos ravishda suriladi. Video qayta kodlanmaydi — sifat, hajm o'zgarmaydi.
 *
 * Xotira: faqat `moov` (odatda bir necha yuz KB) o'qiladi; qolgan qismlar `Blob.slice` bilan bog'lanadi (fayl to'liq
 * xotiraga yuklanmaydi). Tushunarsiz/siqilgan `moov` yoki 32-bit manzil to'lib ketsa — asl fayl qaytariladi (xavfsiz).
 */

interface Atom {
  type: string;
  start: number;
  size: number;
}

const CONTAINERS = new Set(["moov", "trak", "mdia", "minf", "stbl", "edts", "dinf", "udta"]);

async function readTopLevel(file: Blob): Promise<Atom[] | null> {
  const atoms: Atom[] = [];
  let pos = 0;
  while (pos < file.size) {
    if (file.size - pos < 8) return null;
    const head = new DataView(await file.slice(pos, Math.min(pos + 16, file.size)).arrayBuffer());
    let size = head.getUint32(0);
    const type = String.fromCharCode(head.getUint8(4), head.getUint8(5), head.getUint8(6), head.getUint8(7));
    if (size === 1) {
      if (head.byteLength < 16) return null;
      const big = head.getBigUint64(8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return null;
      size = Number(big);
    } else if (size === 0) {
      size = file.size - pos;
    }
    if (size < 8 || pos + size > file.size) return null;
    atoms.push({ type, start: pos, size });
    pos += size;
    if (atoms.length > 1000) return null;
  }
  return atoms;
}

/** moov ichidagi stco/co64 jadvallarini topib, har bir manzilga `shift(offset)` qo'llaydi. false — qo'llab bo'lmaydi */
function patchOffsets(buf: DataView, start: number, end: number, shift: (o: number) => number): boolean {
  let pos = start;
  while (pos + 8 <= end) {
    let size = buf.getUint32(pos);
    const type = String.fromCharCode(buf.getUint8(pos + 4), buf.getUint8(pos + 5), buf.getUint8(pos + 6), buf.getUint8(pos + 7));
    let header = 8;
    if (size === 1) {
      const big = buf.getBigUint64(pos + 8);
      if (big > BigInt(Number.MAX_SAFE_INTEGER)) return false;
      size = Number(big);
      header = 16;
    } else if (size === 0) size = end - pos;
    if (size < header || pos + size > end) return false;
    if (type === "cmov") return false; // siqilgan mundarija — tegmaymiz
    if (CONTAINERS.has(type)) {
      if (!patchOffsets(buf, pos + header, pos + size, shift)) return false;
    } else if (type === "stco" || type === "co64") {
      const count = buf.getUint32(pos + header + 4);
      let p = pos + header + 8;
      const width = type === "stco" ? 4 : 8;
      if (p + count * width > pos + size) return false;
      for (let i = 0; i < count; i++, p += width) {
        if (type === "stco") {
          const next = shift(buf.getUint32(p));
          if (next > 0xffffffff) return false; // 32-bit to'lib ketdi — xavf qilmaymiz
          buf.setUint32(p, next);
        } else {
          const cur = buf.getBigUint64(p);
          if (cur > BigInt(Number.MAX_SAFE_INTEGER)) return false;
          buf.setBigUint64(p, BigInt(shift(Number(cur))));
        }
      }
    }
    pos += size;
  }
  return true;
}

/** `moov` allaqachon `mdat`dan oldinmi (yoki MP4 emasmi) — tekshiruv uchun */
export async function needsFaststart(file: Blob): Promise<boolean> {
  const atoms = await readTopLevel(file).catch(() => null);
  if (!atoms) return false;
  const moov = atoms.findIndex((a) => a.type === "moov");
  const mdat = atoms.findIndex((a) => a.type === "mdat");
  return moov > -1 && mdat > -1 && moov > mdat;
}

/**
 * `moov`ni boshiga ko'chirgan yangi Blob (o'sha MIME bilan). Kerak bo'lmasa yoki xavfli bo'lsa — asl fayl o'zi.
 * `maxMoovBytes` — g'ayritabiiy katta mundarijani xotiraga o'qimaslik uchun.
 */
export async function faststart<T extends Blob>(file: T, maxMoovBytes = 64 * 1024 * 1024): Promise<T | Blob> {
  try {
    const atoms = await readTopLevel(file);
    if (!atoms) return file;
    const moovIdx = atoms.findIndex((a) => a.type === "moov");
    const mdatIdx = atoms.findIndex((a) => a.type === "mdat");
    if (moovIdx < 0 || mdatIdx < 0 || moovIdx < mdatIdx) return file;
    const moov = atoms[moovIdx];
    if (moov.size > maxMoovBytes) return file;

    // Yangi joy: birinchi mdat'dan oldin (ftyp va boshqa bosh atomlardan keyin)
    const insertPos = atoms[mdatIdx].start;
    const moovBuf = new DataView((await file.slice(moov.start, moov.start + moov.size).arrayBuffer()).slice(0));
    const shift = (o: number) => (o >= insertPos && o < moov.start ? o + moov.size : o);
    const header = moovBuf.getUint32(0) === 1 ? 16 : 8;
    if (!patchOffsets(moovBuf, header, moov.size, shift)) return file;

    const parts: BlobPart[] = [];
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      if (i === moovIdx) continue;
      if (i === mdatIdx) parts.push(moovBuf.buffer as ArrayBuffer);
      parts.push(file.slice(a.start, a.start + a.size));
    }
    const out = new Blob(parts, { type: file.type });
    if (out.size !== file.size) return file;
    return out;
  } catch {
    return file;
  }
}
