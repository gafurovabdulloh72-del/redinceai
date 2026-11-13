"use strict";
/**
 * Kasb Egalari — kompyuter ilovasi (Electron). Sayt (config.json `siteUrl`) o'z oynasida ochiladi: hisob, chat,
 * qo'ng'iroq, efir — hammasi saytdagidek, ma'lumot serverda. Ilova faqat qobiq qo'shadi:
 *  - doimiy sessiya (`persist:kasb` — qayta ochganda kirgan holda qoladi);
 *  - Google bilan kirish tizim brauzerida (Google ichki oynada kirishni taqiqlaydi) → `kasbegalari://auth?code=…`
 *    bilan qaytadi, PKCE verifier faqat ilovada (sayt: /ilova/ulash, /api/auth/ilova[/kirish]);
 *  - tashqi havolalar (Telegram, Instagram, to'lov) tizim brauzerida;
 *  - o'qilmagan xabarlar soni ikonka nishonida + yangi xabar kelganda tizim bildirishnomasi;
 *  - internet yo'q bo'lsa — «Qayta urinish» ekrani; avtomatik yangilanish (electron-updater, sozlangan bo'lsa).
 */
const { app, BrowserWindow, Menu, Notification, session, shell, nativeImage, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { pkcePair, parseDeepLink, deepLinkFromArgv, classifyUrl, unreadFromTitle } = require("./logic.cjs");

const config = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "config.json"), "utf8"));
const SITE = (process.env.KASB_SITE_URL || config.siteUrl).replace(/\/+$/, "");
const EXTRA_HOSTS = config.extraHosts || [];
const PARTITION = "persist:kasb";
const UA_MARK = `KasbEgalariDesktop/${app.getVersion()}`;

let win = null;
let pendingDeepLink = deepLinkFromArgv(process.argv);
let lastUnread = 0;

// ── Bitta nusxa: ikkinchi marta ochilsa (yoki deep link bilan) — mavjud oyna oldinga chiqadi ──────────────
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const link = deepLinkFromArgv(argv);
    if (link) handleDeepLink(link);
    focusWindow();
  });
}

// kasbegalari:// protokoli (Windows/Linux'da dev rejimida electron yo'li bilan ro'yxatdan o'tadi)
if (process.defaultApp && process.argv.length >= 2) {
  app.setAsDefaultProtocolClient("kasbegalari", process.execPath, [path.resolve(process.argv[1])]);
} else {
  app.setAsDefaultProtocolClient("kasbegalari");
}
// macOS deep link
app.on("open-url", (e, url) => {
  e.preventDefault();
  if (app.isReady() && win) handleDeepLink(url);
  else pendingDeepLink = url;
});

if (process.platform === "win32") app.setAppUserModelId("uz.kasbegalari.desktop");

// ── PKCE verifier: ilova qayta ishga tushsa ham (brauzerdan qaytguncha yopilgan bo'lsa) 10 daqiqa saqlanadi ──
const pkceFile = () => path.join(app.getPath("userData"), "pkce.json");
function savePkce(verifier) {
  try {
    fs.writeFileSync(pkceFile(), JSON.stringify({ verifier, at: Date.now() }), { mode: 0o600 });
  } catch {
    /* yozib bo'lmasa — xotiradagisi bilan ishlaymiz */
  }
}
let memVerifier = null;
function takePkce() {
  let v = memVerifier;
  try {
    const j = JSON.parse(fs.readFileSync(pkceFile(), "utf8"));
    if (!v && j && Date.now() - j.at < 10 * 60 * 1000) v = j.verifier;
    fs.unlinkSync(pkceFile());
  } catch {
    /* fayl yo'q */
  }
  memVerifier = null;
  return v;
}

function startGoogleLogin() {
  const { verifier, challenge } = pkcePair();
  memVerifier = verifier;
  savePkce(verifier);
  void shell.openExternal(`${SITE}/ilova/ulash?usul=google&c=${challenge}`);
  if (win) {
    void win.webContents.executeJavaScript(
      `(()=>{const d=document.createElement('div');d.textContent='Brauzerda Google bilan kiring — keyin ilovaga avtomatik qaytasiz';` +
        `Object.assign(d.style,{position:'fixed',left:'50%',bottom:'24px',transform:'translateX(-50%)',zIndex:2147483647,background:'#1a1a1c',color:'#f6f4ee',padding:'12px 18px',borderRadius:'12px',font:'600 14px system-ui',boxShadow:'0 8px 30px rgba(0,0,0,.25)'});` +
        `document.body.appendChild(d);setTimeout(()=>d.remove(),8000);})()`,
    ).catch(() => undefined);
  }
}

function handleDeepLink(raw) {
  const link = parseDeepLink(raw);
  if (!link || !win) {
    pendingDeepLink = raw;
    return;
  }
  pendingDeepLink = null;
  if (link.kind === "auth") {
    const verifier = takePkce();
    if (!verifier) {
      void dialog.showMessageBox(win, { type: "warning", message: "Kirish muddati tugadi", detail: "«Google bilan davom etish»ni qaytadan bosing." });
      return;
    }
    void win.loadURL(`${SITE}/api/auth/ilova/kirish?code=${encodeURIComponent(link.code)}&v=${encodeURIComponent(verifier)}`);
  } else if (link.kind === "open") {
    void win.loadURL(SITE + link.path);
  }
  focusWindow();
}

function focusWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

// ── Oyna o'lchami va joyi eslab qolinadi ───────────────────────────────────────────────────────────────
const stateFile = () => path.join(app.getPath("userData"), "window.json");
function loadState() {
  try {
    const s = JSON.parse(fs.readFileSync(stateFile(), "utf8"));
    if (s && s.width >= 400 && s.height >= 400) return s;
  } catch {
    /* birinchi ishga tushish */
  }
  return { width: 1280, height: 840 };
}
function saveState() {
  if (!win || win.isDestroyed()) return;
  try {
    const b = win.getNormalBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch {
    /* muhim emas */
  }
}

function offlinePage(target) {
  return `file://${path.join(__dirname, "offline.html")}?to=${encodeURIComponent(target || SITE)}`;
}

function createWindow() {
  const st = loadState();
  const ses = session.fromPartition(PARTITION);
  ses.setUserAgent(`${ses.getUserAgent().replace(/\s?Electron\/\S+/, "")} ${UA_MARK}`);

  // Ruxsatlar: faqat o'z saytimizga — kamera/mikrofon/ekran (qo'ng'iroq, efir, ovozli xabar), bildirishnoma, buferga nusxa
  const ALLOWED = new Set(["media", "notifications", "clipboard-sanitized-write", "fullscreen", "display-capture", "speaker-selection"]);
  ses.setPermissionRequestHandler((wc, permission, cb) => {
    cb(ALLOWED.has(permission) && classifyUrl(wc.getURL(), SITE, EXTRA_HOSTS) === "app");
  });
  ses.setPermissionCheckHandler((_wc, permission, origin) => ALLOWED.has(permission) && classifyUrl(origin || "", SITE, EXTRA_HOSTS) === "app");
  // Ekranni ulashish (efir/qo'ng'iroq) — butun ekran yoki oyna tanlovi
  ses.setDisplayMediaRequestHandler((_req, cb) => {
    const { desktopCapturer } = require("electron");
    desktopCapturer.getSources({ types: ["screen", "window"] }).then((sources) => cb({ video: sources[0] }), () => cb({}));
  });

  win = new BrowserWindow({
    width: st.width,
    height: st.height,
    x: st.x,
    y: st.y,
    minWidth: 380,
    minHeight: 560,
    title: "Kasb Egalari",
    backgroundColor: "#fafaf8",
    icon: path.join(__dirname, "..", "assets", "icon.png"),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      partition: PARTITION,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (st.maximized) win.maximize();
  win.once("ready-to-show", () => win.show());
  win.on("close", saveState);
  win.on("closed", () => {
    win = null;
  });

  const wc = win.webContents;
  // Yangi oyna (target=_blank): o'z saytimiz — shu oynada; Google — PKCE oqimi; qolgani — tizim brauzerida
  wc.setWindowOpenHandler(({ url }) => {
    const kind = classifyUrl(url, SITE, EXTRA_HOSTS);
    if (kind === "app" && /^https?:/.test(url)) void win.loadURL(url);
    else if (kind === "google") startGoogleLogin();
    else if (kind === "external") void shell.openExternal(url);
    return { action: "deny" };
  });
  const guard = (e, url) => {
    if (url.startsWith("file://") && url.includes("offline.html")) return;
    const kind = classifyUrl(url, SITE, EXTRA_HOSTS);
    if (kind === "app") return;
    e.preventDefault();
    if (kind === "google") startGoogleLogin();
    else if (kind === "external") void shell.openExternal(url);
  };
  wc.on("will-navigate", guard);
  wc.on("will-redirect", guard);

  // Internet yo'q / server javob bermadi — «Qayta urinish» ekrani (asosiy hujjat uchungina)
  wc.on("did-fail-load", (_e, code, _desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3 /* ABORTED */ || url.startsWith("file://")) return;
    void win.loadURL(offlinePage(url));
  });

  // O'qilmaganlar: sayt sarlavhasi «(N) …» — nishon + yangi xabar bildirishnomasi
  wc.on("page-title-updated", (_e, title) => {
    const n = unreadFromTitle(title);
    app.setBadgeCount(n);
    if (process.platform === "win32") win.setOverlayIcon(n ? badgeIcon(n) : null, n ? `${n} ta o'qilmagan` : "");
    if (n > lastUnread && !win.isFocused()) {
      if (Notification.isSupported()) {
        const note = new Notification({ title: "Kasb Egalari", body: n === 1 ? "Yangi xabar" : `${n} ta o'qilmagan xabar`, silent: false });
        note.on("click", () => {
          focusWindow();
          void win.loadURL(`${SITE}/kabinet/chat`);
        });
        note.show();
      }
      win.flashFrame(true);
    }
    lastUnread = n;
  });
  win.on("focus", () => win.flashFrame(false));

  void win.loadURL(SITE + "/?source=desktop");
  wc.once("did-finish-load", () => {
    if (pendingDeepLink) handleDeepLink(pendingDeepLink);
  });
}

/** Windows vazifalar paneli uchun qizil nishon (tayyor PNG: assets/badge-1…9, badge-10 = «9+») */
function badgeIcon(n) {
  return nativeImage.createFromPath(path.join(__dirname, "..", "assets", `badge-${Math.min(n, 10)}.png`));
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const go = (p) => () => win && void win.loadURL(SITE + p);
  const template = [
    ...(isMac
      ? [{ label: "Kasb Egalari", submenu: [{ role: "about", label: "Ilova haqida" }, { type: "separator" }, { role: "hide", label: "Yashirish" }, { role: "hideOthers", label: "Boshqalarni yashirish" }, { type: "separator" }, { role: "quit", label: "Chiqish" }] }]
      : []),
    {
      label: "Tahrirlash",
      submenu: [
        { role: "undo", label: "Bekor qilish" },
        { role: "redo", label: "Qaytarish" },
        { type: "separator" },
        { role: "cut", label: "Kesish" },
        { role: "copy", label: "Nusxalash" },
        { role: "paste", label: "Qo'yish" },
        { role: "selectAll", label: "Hammasini tanlash" },
      ],
    },
    {
      label: "Ko'rinish",
      submenu: [
        { label: "Orqaga", accelerator: isMac ? "Cmd+[" : "Alt+Left", click: () => win && win.webContents.navigationHistory.canGoBack() && win.webContents.navigationHistory.goBack() },
        { label: "Oldinga", accelerator: isMac ? "Cmd+]" : "Alt+Right", click: () => win && win.webContents.navigationHistory.canGoForward() && win.webContents.navigationHistory.goForward() },
        { role: "reload", label: "Yangilash" },
        { type: "separator" },
        { role: "zoomIn", label: "Kattalashtirish" },
        { role: "zoomOut", label: "Kichraytirish" },
        { role: "resetZoom", label: "Asl o'lcham" },
        { type: "separator" },
        { role: "togglefullscreen", label: "To'liq ekran" },
      ],
    },
    {
      label: "O'tish",
      submenu: [
        { label: "Asosiy", accelerator: "CmdOrCtrl+1", click: go("/") },
        { label: "Chat", accelerator: "CmdOrCtrl+2", click: go("/kabinet/chat") },
        { label: "Bildirishnomalar", accelerator: "CmdOrCtrl+3", click: go("/kabinet/bildirishnomalar") },
        { label: "Kabinet", accelerator: "CmdOrCtrl+4", click: go("/kabinet") },
      ],
    },
    { role: "windowMenu", label: "Oyna" },
    { label: "Yordam", submenu: [{ label: "Saytni brauzerda ochish", click: () => void shell.openExternal(win ? win.webContents.getURL() : SITE) }, { label: "Fikr bildirish", click: go("/kabinet/menyu") }] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function setupUpdates() {
  if (!app.isPackaged) return;
  try {
    const { autoUpdater } = require("electron-updater");
    autoUpdater.autoDownload = true;
    // publish sozlanmagan yig'mada (app-update.yml yo'q) jim o'tadi
    autoUpdater.checkForUpdatesAndNotify().catch(() => undefined);
  } catch {
    /* yangilanish moduli yo'q */
  }
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  setupUpdates();
  app.on("activate", () => {
    if (!BrowserWindow.getAllWindows().length) createWindow();
    else focusWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// Sayt ichidagi har qanday qo'shimcha webContents (iframe emas — yangi oyna) ham shu qoidaga bo'ysunsin
app.on("web-contents-created", (_e, contents) => {
  contents.on("will-attach-webview", (e) => e.preventDefault());
});
