// TabVault for Chrome / Microsoft Edge (Windows, also macOS/Linux).
// Saves tabs to Downloads\TabVault as PDF + HTML, keeps a CSV log and a timeline page, then closes the tabs.
// Safety: the session is stored before anything else; tabs close only after the PDF and HTML
// downloads have completed and exist on disk. Session files are never overwritten (uniquify).
importScripts("core.js"); // makeSession, buildPdf, buildHtml, buildLog, buildIndex, sessionsFromFiles, logStats

const DEFAULTS = { scope: "all", keepPinned: true, closeTabs: true, quietDownloads: true, badgeAt: 30, dailyOn: false, dailyTime: "23:30" };
const DIR = "TabVault";
const MAX_HISTORY = 500;

const getSettings = async () => ({ ...DEFAULTS, ...((await chrome.storage.local.get("settings")).settings || {}) });
const getState = async () => (await chrome.storage.local.get("state")).state || {};
const setState = async patch => chrome.storage.local.set({ state: { ...(await getState()), ...patch } });

function b64(str, utf8) {
  if (!utf8) return btoa(str); // PDF: every char is <= 0xFF
  const bytes = new TextEncoder().encode(str);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function waitForDownload(id) {
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (fn, v) => { if (finished) return; finished = true; chrome.downloads.onChanged.removeListener(onChange); clearTimeout(timer); fn(v); };
    const check = item => {
      if (!item) return;
      if (item.state === "complete") finish(resolve, item);
      else if (item.state === "interrupted") finish(reject, new Error("Download interrupted: " + (item.error || "unknown")));
    };
    const onChange = d => { if (d.id === id && d.state) chrome.downloads.search({ id }).then(r => check(r[0])); };
    const timer = setTimeout(() => finish(reject, new Error("Saving timed out")), 30000);
    chrome.downloads.onChanged.addListener(onChange);
    chrome.downloads.search({ id }).then(r => check(r[0]));
  });
}

async function saveFile(name, mime, text, conflictAction) {
  const id = await chrome.downloads.download({
    url: `data:${mime};base64,${b64(text, mime !== "application/pdf")}`,
    filename: `${DIR}/${name}`, conflictAction, saveAs: false
  });
  const item = await waitForDownload(id);
  if (item.exists === false) throw new Error(`${name} was not found after saving`);
  return { id, path: item.filename, name: item.filename.split(/[\\/]/).pop() };
}

async function eraseEntry(id) { if (id != null) { try { await chrome.downloads.erase({ id }); } catch (e) {} } }

// Rebuilds TabVault Log.csv and All sessions.html from the stored history.
async function writeLogAndTimeline(history) {
  const st = await getState();
  const ordered = history.slice().reverse(); // oldest first
  const csv = "﻿Date,Time,Session,Window,#,Title,URL\n" + ordered.map(s => buildLog(s)).join("");
  // First log ever: never clobber an existing file; afterwards keep rewriting our own log.
  const log = await saveFile(st.logName || "TabVault Log.csv", "text/csv;charset=utf-8", csv, st.logName ? "overwrite" : "uniquify");
  const names = [];
  history.forEach(s => { if (s.files) { if (s.files.pdf) names.push(s.files.pdf.name); if (s.files.html) names.push(s.files.html.name); } });
  let page = buildIndex(sessionsFromFiles(names), logStats(csv));
  if (log.name !== "TabVault Log.csv") page = page.replace("TabVault%20Log.csv", encodeURIComponent(log.name));
  const index = await saveFile("All sessions.html", "text/html;charset=utf-8", page, "overwrite");
  // Keep Chrome's download list tidy: only the newest log/timeline entries are kept (files are untouched).
  if (st.logId !== log.id) await eraseEntry(st.logId);
  if (st.indexId !== index.id) await eraseEntry(st.indexId);
  await setState({ logName: log.name, logId: log.id, indexId: index.id });
  return index;
}

async function setDownloadUi(enabled) { try { await chrome.downloads.setUiOptions({ enabled }); } catch (e) {} }

let running = false;
async function archive(override = {}) {
  if (running) return { ok: false, error: "TabVault is already saving." };
  running = true;
  const opts = { ...(await getSettings()), ...override };
  try {
    let tabs = await chrome.tabs.query(opts.scope === "window" ? { lastFocusedWindow: true, windowType: "normal" } : { windowType: "normal" });
    tabs = tabs.filter(t => !(opts.keepPinned && t.pinned));
    const byWin = new Map();
    tabs.sort((a, b) => a.windowId - b.windowId || a.index - b.index).forEach(t => {
      if (!byWin.has(t.windowId)) byWin.set(t.windowId, { urls: [], names: [] });
      const w = byWin.get(t.windowId); w.urls.push(t.url || t.pendingUrl || ""); w.names.push(t.title || "");
    });
    const s = makeSession([...byWin.values()]);
    if (!s.count) return { ok: false, error: "No web pages are open to save." };

    // 1) Store the session first, so it can always be reopened from History.
    const session = { id: Date.now(), stamp: s.stamp, localDate: s.localDate, localTime: s.localTime, count: s.count, windows: s.windows, files: null };
    const { history = [] } = await chrome.storage.local.get("history");
    history.unshift(session);
    history.length = Math.min(history.length, MAX_HISTORY);
    await chrome.storage.local.set({ history });

    // 2) Write the files.
    if (opts.quietDownloads) await setDownloadUi(false);
    try {
      const pdf = await saveFile(`Tabs ${s.stamp}.pdf`, "application/pdf", buildPdf(s), "uniquify");
      const html = await saveFile(`Tabs ${s.stamp}.html`, "text/html;charset=utf-8", buildHtml(s), "uniquify");
      session.files = { pdf, html };
      await chrome.storage.local.set({ history });
      await writeLogAndTimeline(history);
    } catch (e) {
      session.fileError = String(e && e.message || e);
      await chrome.storage.local.set({ history });
      return { ok: false, error: "Nothing was closed. " + session.fileError, id: session.id };
    } finally {
      if (opts.quietDownloads) await setDownloadUi(true);
    }

    // 3) Close the saved tabs (only after both files exist) and show the session.
    let closed = 0;
    if (opts.closeTabs) {
      const viewer = await chrome.tabs.create({ url: chrome.runtime.getURL(`viewer.html?id=${session.id}`), active: true });
      const ids = tabs.filter(t => s.saved[t.url || t.pendingUrl] && t.id !== viewer.id).map(t => t.id);
      try { await chrome.tabs.remove(ids); closed = ids.length; }
      catch (e) { for (const id of ids) { try { await chrome.tabs.remove(id); closed++; } catch (_) {} } }
    }
    updateBadge();
    return { ok: true, count: s.count, closed, files: session.files, id: session.id };
  } finally {
    running = false;
  }
}

// Event-driven badge: shows the tab count only once it passes your limit. No polling.
let badgeTimer;
function updateBadge() {
  clearTimeout(badgeTimer);
  badgeTimer = setTimeout(async () => {
    try {
      const { badgeAt } = await getSettings();
      const n = (await chrome.tabs.query({})).length;
      await chrome.action.setBadgeBackgroundColor({ color: "#d9482b" });
      await chrome.action.setBadgeText({ text: badgeAt > 0 && n >= badgeAt ? String(n) : "" });
    } catch (e) {}
  }, 1000);
}

async function scheduleDaily() {
  const s = await getSettings();
  await chrome.alarms.clear("daily");
  if (!s.dailyOn) return;
  const [hh, mm] = s.dailyTime.split(":").map(Number);
  const next = new Date(); next.setHours(hh, mm, 0, 0);
  if (next <= new Date()) next.setDate(next.getDate() + 1);
  chrome.alarms.create("daily", { when: next.getTime(), periodInMinutes: 1440 });
}

async function reveal() {
  const { indexId } = await getState();
  if (indexId != null) { try { chrome.downloads.show(indexId); return { ok: true }; } catch (e) {} }
  chrome.downloads.showDefaultFolder();
  return { ok: true };
}

chrome.alarms.onAlarm.addListener(a => { if (a.name === "daily") archive({ scope: "all" }); });
chrome.commands.onCommand.addListener(c => {
  if (c === "archive-all") archive({ scope: "all" });
  if (c === "archive-window") archive({ scope: "window" });
});
chrome.tabs.onCreated.addListener(updateBadge);
chrome.tabs.onRemoved.addListener(updateBadge);
chrome.runtime.onInstalled.addListener(() => { updateBadge(); scheduleDaily(); });
chrome.runtime.onStartup.addListener(() => { updateBadge(); scheduleDaily(); });

chrome.runtime.onMessage.addListener((m, _sender, reply) => {
  (async () => {
    if (m.type === "archive") return archive(m.opts || {});
    if (m.type === "settingsChanged") { await scheduleDaily(); updateBadge(); return { ok: true }; }
    if (m.type === "reveal") return reveal();
    if (m.type === "rewrite") { // re-save PDF/HTML for a session whose files are missing
      const { history = [] } = await chrome.storage.local.get("history");
      const s = history.find(x => x.id === m.id);
      if (!s) return { ok: false, error: "Session not found" };
      const pdf = await saveFile(`Tabs ${s.stamp}.pdf`, "application/pdf", buildPdf(s), "uniquify");
      const html = await saveFile(`Tabs ${s.stamp}.html`, "text/html;charset=utf-8", buildHtml(s), "uniquify");
      s.files = { pdf, html }; delete s.fileError;
      await chrome.storage.local.set({ history });
      await writeLogAndTimeline(history);
      return { ok: true, files: s.files };
    }
    if (m.type === "timeline") {
      const { history = [] } = await chrome.storage.local.get("history");
      return { ok: true, indexId: (await writeLogAndTimeline(history)).id };
    }
  })().then(reply, e => reply({ ok: false, error: String(e && e.message || e) }));
  return true;
});
