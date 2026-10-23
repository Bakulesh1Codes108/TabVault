const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { scope: "all", keepPinned: true, savePdf: true, saveHtml: true, closeTabs: true, badgeAt: 30, dailyOn: false, dailyTime: "23:30" };
const MAX_HISTORY = 300;

const pad = n => String(n).padStart(2, "0");
const getSettings = async () => ({ ...DEFAULTS, ...((await ext.storage.local.get("settings")).settings || {}) });
const archivable = t => /^(https?|file|ftp):/i.test(t.url || "");

async function archive(override = {}) {
  const opts = { ...(await getSettings()), ...override };
  const tabs = await ext.tabs.query(opts.scope === "window" ? { currentWindow: true } : {});
  const targets = tabs.filter(t => archivable(t) && !(opts.keepPinned && t.pinned));
  if (!targets.length) return { ok: false, error: "No web tabs to archive." };

  // Group by window, dedupe identical URLs inside the document (all are still closed)
  const seen = new Set(), byWin = new Map();
  for (const t of targets) {
    if (seen.has(t.url)) continue;
    seen.add(t.url);
    if (!byWin.has(t.windowId)) byWin.set(t.windowId, []);
    byWin.get(t.windowId).push({ title: t.title || "", url: t.url });
  }

  const d = new Date();
  const session = {
    id: d.getTime(),
    iso: d.toISOString(),
    stamp: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`,
    localDate: d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" }),
    localTime: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    count: seen.size,
    windows: [...byWin.values()].map(t => ({ tabs: t })),
    files: null
  };

  // 1) Save to history first – the data is safe even if file saving fails.
  const { history = [] } = await ext.storage.local.get("history");
  history.unshift(session);
  await ext.storage.local.set({ history: history.slice(0, MAX_HISTORY) });

  // 2) Write files to ~/Downloads/TabVault through the native app (never deletes/overwrites).
  try {
    const msg = { action: "save", stamp: session.stamp, log: TabVaultReport.buildLog(session) };
    if (opts.savePdf) msg.pdf = TabVaultPDF.toBase64(TabVaultPDF.buildPdf(session));
    if (opts.saveHtml) msg.html = TabVaultReport.buildHtml(session);
    const res = await ext.runtime.sendNativeMessage("com.brane.TabVault", msg);
    if (res && res.ok) session.files = res;
    else session.fileError = (res && res.error) || "Native app did not respond";
  } catch (e) {
    session.fileError = String(e && e.message || e);
  }
  history[0] = session;
  await ext.storage.local.set({ history: history.slice(0, MAX_HISTORY) });

  // 3) Close tabs: open the archive viewer first so the window stays open.
  if (opts.closeTabs) {
    const viewer = await ext.tabs.create({ url: ext.runtime.getURL(`viewer.html?id=${session.id}`), active: true });
    const ids = targets.map(t => t.id).filter(id => id !== viewer.id);
    try { await ext.tabs.remove(ids); } catch (e) { for (const id of ids) { try { await ext.tabs.remove(id); } catch {} } }
  }
  updateBadge();
  return { ok: true, count: session.count, closed: opts.closeTabs ? targets.length : 0, files: session.files, fileError: session.fileError, id: session.id };
}

// Lightweight, event-driven badge: only shows when tab count passes your limit.
let badgeTimer;
function updateBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(async () => {
    try {
      const { badgeAt } = await getSettings();
      const n = (await ext.tabs.query({})).length;
      await ext.action.setBadgeText({ text: badgeAt > 0 && n >= badgeAt ? String(n) : "" });
      if (ext.action.setBadgeBackgroundColor) await ext.action.setBadgeBackgroundColor({ color: "#d9482b" });
    } catch {}
  }, 1500);
}

async function scheduleDaily() {
  const s = await getSettings();
  await ext.alarms.clear("daily");
  if (!s.dailyOn) return;
  const [hh, mm] = s.dailyTime.split(":").map(Number);
  const next = new Date(); next.setHours(hh, mm, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  ext.alarms.create("daily", { when: next.getTime(), periodInMinutes: 1440 });
}

ext.alarms.onAlarm.addListener(a => { if (a.name === "daily") archive({ scope: "all" }); });
ext.commands.onCommand.addListener(c => {
  if (c === "archive-all") archive({ scope: "all" });
  if (c === "archive-window") archive({ scope: "window" });
});
ext.tabs.onCreated.addListener(updateBadge);
ext.tabs.onRemoved.addListener(updateBadge);
ext.runtime.onInstalled.addListener(() => { updateBadge(); scheduleDaily(); });
ext.runtime.onStartup && ext.runtime.onStartup.addListener(() => { updateBadge(); scheduleDaily(); });

ext.runtime.onMessage.addListener((m, _s, reply) => {
  (async () => {
    if (m.type === "archive") return archive(m.opts || {});
    if (m.type === "settingsChanged") { await scheduleDaily(); updateBadge(); return { ok: true }; }
    if (m.type === "reveal") return ext.runtime.sendNativeMessage("com.brane.TabVault", { action: "reveal" }).catch(e => ({ ok: false, error: String(e) }));
  })().then(reply, e => reply({ ok: false, error: String(e) }));
  return true;
});
