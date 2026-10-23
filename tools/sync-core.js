// Copies the platform-independent part of app/TabVault.js (PDF, HTML, CSV, timeline builders)
// into windows/extension/core.js so the Mac and Windows versions produce identical files.
// Run after changing app/TabVault.js:  node tools/sync-core.js
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(root, "app/TabVault.js"), "utf8");
const cut = src.indexOf("/* ---------------- macOS side (JXA) ---------------- */");
if (cut < 0) throw new Error("macOS marker not found in app/TabVault.js");
const core = "// AUTO-GENERATED from app/TabVault.js by tools/sync-core.js – do not edit here.\n" +
  src.slice(0, cut).replace("Click TabVault in the Dock to save your first one.", "Click the TabVault button in your browser toolbar to save your first one.");
fs.writeFileSync(path.join(root, "windows/extension/core.js"), core);
console.log("windows/extension/core.js updated (" + core.length + " bytes)");
