const DEFAULTS = { scope: "all", keepPinned: true, closeTabs: true, quietDownloads: true, badgeAt: 30, dailyOn: false, dailyTime: "23:30" };
const $ = id => document.getElementById(id);
const web = t => /^(https?|file|ftp):/i.test(t.url || t.pendingUrl || "");
let S;

async function save() { await chrome.storage.local.set({ settings: S }); chrome.runtime.sendMessage({ type: "settingsChanged" }); }
async function counts() {
  const all = await chrome.tabs.query({ windowType: "normal" }), win = await chrome.tabs.query({ currentWindow: true });
  const n = l => l.filter(t => web(t) && !(S.keepPinned && t.pinned)).length;
  const w = new Set(all.map(t => t.windowId)).size;
  $("counts").textContent = `${n(all)} tabs in ${w} window${w === 1 ? "" : "s"} · ${n(win)} in this window`;
}
function paintScope() { document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.scope === S.scope)); }
function status(html, cls) { $("status").innerHTML = `<span class="${cls || ""}">${html}</span>`; }

(async () => {
  S = { ...DEFAULTS, ...((await chrome.storage.local.get("settings")).settings || {}) };
  for (const k of ["keepPinned", "closeTabs", "quietDownloads", "dailyOn"]) {
    $(k).checked = S[k]; $(k).onchange = () => { S[k] = $(k).checked; save(); counts(); };
  }
  $("badgeAt").value = S.badgeAt; $("badgeAt").onchange = () => { S.badgeAt = +$("badgeAt").value || 0; save(); };
  $("dailyTime").value = S.dailyTime; $("dailyTime").onchange = () => { S.dailyTime = $("dailyTime").value || "23:30"; save(); };
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { S.scope = b.dataset.scope; paintScope(); save(); });
  paintScope(); counts();

  $("go").onclick = async () => {
    $("go").disabled = true; status("Saving…");
    const r = await chrome.runtime.sendMessage({ type: "archive", opts: { scope: S.scope } });
    if (!r || !r.ok) { status((r && r.error) || "Something went wrong.", "err"); $("go").disabled = false; return; }
    status(`Saved ${r.count} tabs to Downloads\\TabVault.`, "ok");
  };
  $("history").onclick = () => { chrome.tabs.create({ url: chrome.runtime.getURL("viewer.html") }); window.close(); };
  $("folder").onclick = () => chrome.runtime.sendMessage({ type: "reveal" });
  $("timeline").onclick = async () => {
    const r = await chrome.runtime.sendMessage({ type: "timeline" });
    if (r && r.ok) { try { await chrome.downloads.open(r.indexId); window.close(); } catch (e) { chrome.downloads.show(r.indexId); } }
    else status((r && r.error) || "No sessions yet.", "err");
  };
})();
