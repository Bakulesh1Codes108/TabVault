const ext = globalThis.browser || globalThis.chrome;
const DEFAULTS = { scope: "all", keepPinned: true, savePdf: true, saveHtml: true, closeTabs: true, badgeAt: 30, dailyOn: false, dailyTime: "23:30" };
const $ = id => document.getElementById(id);
let S;

async function save() {
  await ext.storage.local.set({ settings: S });
  ext.runtime.sendMessage({ type: "settingsChanged" });
}
async function counts() {
  const all = await ext.tabs.query({}), win = await ext.tabs.query({ currentWindow: true });
  const web = l => l.filter(t => /^(https?|file|ftp):/i.test(t.url || "") && !(S.keepPinned && t.pinned)).length;
  $("counts").textContent = `${web(all)} tabs in all windows · ${web(win)} in this window`;
}
function paintScope() { document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.scope === S.scope)); }

(async () => {
  S = { ...DEFAULTS, ...((await ext.storage.local.get("settings")).settings || {}) };
  for (const k of ["keepPinned", "savePdf", "saveHtml", "closeTabs", "dailyOn"]) {
    $(k).checked = S[k]; $(k).onchange = () => { S[k] = $(k).checked; save(); counts(); };
  }
  $("badgeAt").value = S.badgeAt; $("badgeAt").onchange = () => { S.badgeAt = +$("badgeAt").value || 0; save(); };
  $("dailyTime").value = S.dailyTime; $("dailyTime").onchange = () => { S.dailyTime = $("dailyTime").value || "23:30"; save(); };
  document.querySelectorAll(".seg button").forEach(b => b.onclick = () => { S.scope = b.dataset.scope; paintScope(); save(); });
  paintScope(); counts();

  $("go").onclick = async () => {
    $("go").disabled = true; $("status").textContent = "Saving…";
    const r = await ext.runtime.sendMessage({ type: "archive", opts: { scope: S.scope } });
    if (!r || !r.ok) { $("status").innerHTML = `<span class="err">${(r && r.error) || "Something went wrong."}</span>`; $("go").disabled = false; return; }
    $("status").innerHTML = r.files
      ? `<span class="ok">Saved ${r.count} tabs to Downloads/TabVault.</span>`
      : `<span class="err">Saved ${r.count} tabs in History (file save failed: ${r.fileError}).</span>`;
  };
  $("history").onclick = () => { ext.tabs.create({ url: ext.runtime.getURL("viewer.html") }); window.close(); };
  $("folder").onclick = async () => {
    const r = await ext.runtime.sendMessage({ type: "reveal" });
    if (!r || !r.ok) $("status").innerHTML = `<span class="err">Open Finder → Downloads → TabVault.</span>`;
  };
})();
