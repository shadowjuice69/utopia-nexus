// ==UserScript==
// @name         Utopia Nexus Universal Capture
// @namespace    utopia-nexus
// @version      8.0.2
// @description  Universal Utopia page capture. Raw DOM is the source of truth; no page-type filtering or AI.
// @match        https://www.utopia-game.com/*
// @match        https://utopia-game.com/*
// @match        https://intel.utopia-game.com/*
// @match        https://intel.utopia.site/*
// @grant        GM_xmlhttpRequest
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_setClipboard
// @connect      utopia-nexus.onrender.com
// @run-at       document-end
// @all-frames   false
// ==/UserScript==

(function () {
  "use strict";
  const VERSION = "8.0.2";
  const ENDPOINT = "https://utopia-nexus.onrender.com/intel";
  const KEY = "NikkoAce";
  const PANEL_ID = "nexus-universal-panel";
  const AUTO_DELAY = 2500;
  let autoTimer = null;
  let captureBusy = false;
  let lastAutoUrl = "";
  let lastCapture = null;
  let selectedRow = null;
  let minimized = GM_getValue("nexus_v8_minimized", false);

  function toast(message, good = true) {
    document.getElementById("nexus-v8-toast")?.remove();
    const el = document.createElement("div");
    el.id = "nexus-v8-toast";
    el.textContent = message;
    el.style.cssText = `position:fixed;top:18px;right:18px;z-index:2147483647;max-width:360px;padding:10px 14px;border-radius:8px;font:600 12px monospace;color:#fff;background:${good ? "#238636" : "#da3633"};box-shadow:0 4px 18px rgba(0,0,0,.4)`;
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 3000);
  }

  function bytes(text) {
    const n = new Blob([String(text || "")]).size;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
  }

  function identityHints(text) {
    const out = {};
    const province = text.match(/(?:Province:\s*|The Province of\s+)([^\n(]{2,60})\s*\(?([0-9]+:[0-9]+)?/i);
    if (province) {
      out.province = province[1].trim();
      if (province[2]) out.kd = province[2];
    }
    const kd = text.match(/\b(\d+):(\d+)\b/);
    if (!out.kd && kd) out.kd = `${kd[1]}:${kd[2]}`;
    return out;
  }

  function captureRecord() {
    const raw = document.documentElement?.outerHTML || "";
    const visibleText = String(document.body?.innerText || "").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").trim();
    const capturedAt = new Date().toISOString();
    const subject = identityHints(visibleText);
    return {
      capture_id: crypto?.randomUUID ? crypto.randomUUID() : `nx-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      captured_at: capturedAt,
      scraper_version: VERSION,
      page: {
        url: location.href,
        origin: location.origin,
        hostname: location.hostname,
        pathname: location.pathname,
        search: location.search,
        hash: location.hash,
        title: document.title || "",
        ready_state: document.readyState,
        language: document.documentElement?.lang || null
      },
      source_identity: {
        hostname: location.hostname,
        origin: location.origin,
        game_host: /(^|\.)utopia-game\.com$/.test(location.hostname) ? "utopia-game" : "intel-site"
      },
      subject_identity: subject,
      visible_text: visibleText,
      raw
    };
  }

  function encode(record) {
    const form = new URLSearchParams();
    form.set("key", KEY);
    form.set("source", "kd-stats-generic");
    form.set("tab", "universal");
    form.set("prov", record.subject_identity.province || "");
    form.set("kd", record.subject_identity.kd || "");
    form.set("url", record.page.url);
    form.set("capture_id", record.capture_id);
    form.set("captured_at", record.captured_at);
    form.set("data_simple", JSON.stringify({
      category: "universal-capture",
      rows: [],
      capture_id: record.capture_id,
      captured_at: record.captured_at,
      scraper_version: record.scraper_version,
      page: record.page,
      source_identity: record.source_identity,
      subject_identity: record.subject_identity,
      visible_text: record.visible_text,
      raw: record.raw
    }));
    return form.toString();
  }

  function send(record) {
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: "POST",
        url: ENDPOINT,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: encode(record),
        timeout: 30000,
        onload: r => resolve({ ok: r.status >= 200 && r.status < 300, status: r.status }),
        onerror: () => resolve({ ok: false, status: 0 }),
        ontimeout: () => resolve({ ok: false, status: 0 })
      });
    });
  }

  async function capture(manual = false) {
    if (captureBusy) return;
    captureBusy = true;
    try {
      const record = captureRecord();
      lastCapture = record;
      render(record, "Sending…", true);
      const result = await send(record);
      if (result.ok) {
        lastAutoUrl = location.href;
        render(record, "Saved ✓", true);
        if (manual) toast(`Captured ${bytes(record.raw)} DOM`, true);
      } else {
        render(record, `HTTP ${result.status || "connection error"}`, false);
        toast("Nexus capture failed to save", false);
      }
    } finally {
      captureBusy = false;
    }
  }

  function copy(text, message) {
    GM_setClipboard(text, "text");
    toast(message, true);
  }

  function copyDom() {
    const html = document.documentElement?.outerHTML || "";
    if (!html) return toast("No DOM available", false);
    copy(html, `Copied complete DOM (${bytes(html)})`);
  }

  function copyRow() {
    const row = selectedRow || document.querySelector("tr");
    if (!row) return toast("No table row found", false);
    copy(row.outerHTML, "Copied row HTML");
  }

  function button(label, action, secondary = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = `flex:1;padding:8px 6px;border:0;border-radius:6px;background:${secondary ? "#30363d" : "#238636"};color:#fff;font:bold 11px monospace;cursor:pointer`;
    b.onclick = action;
    return b;
  }

  function render(record = lastCapture, state = "Ready", good = true) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.innerHTML = "";
    if (minimized) {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;align-items:center;gap:8px;color:#7ee787;font:bold 12px monospace";
      row.append("⚡ Nexus v8");
      const b = button("▲", () => { minimized = false; GM_setValue("nexus_v8_minimized", false); render(record, state, good); }, true);
      b.style.flex = "0 0 auto";
      row.appendChild(b);
      panel.appendChild(row);
      return;
    }
    const head = document.createElement("div");
    head.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:7px";
    const title = document.createElement("div");
    title.textContent = "⚡ Nexus Universal Capture";
    title.style.cssText = "color:#7ee787;font:bold 13px monospace";
    const min = button("—", () => { minimized = true; GM_setValue("nexus_v8_minimized", true); render(record, state, good); }, true);
    min.style.flex = "0 0 auto";
    head.append(title, min);
    panel.appendChild(head);

    const note = document.createElement("div");
    note.textContent = "Complete DOM + visible text + metadata · no AI · no filtering";
    note.style.cssText = "color:#8b949e;font:9px monospace;line-height:1.35;margin-bottom:7px";
    panel.appendChild(note);

    const st = document.createElement("div");
    st.id = "nexus-v8-status";
    st.textContent = state;
    st.style.cssText = `color:${good ? "#7ee787" : "#ff7b72"};font:10px monospace;word-break:break-word;margin-bottom:7px`;
    panel.appendChild(st);

    const a = document.createElement("div");
    a.style.cssText = "display:flex;gap:6px;margin-bottom:6px";
    a.append(button("Capture", () => capture(true)), button("Copy DOM", copyDom, true));
    panel.appendChild(a);

    const c = document.createElement("div");
    c.style.cssText = "display:flex;gap:6px";
    c.append(button("Copy Row", copyRow, true), button("Refresh", () => location.reload(), true));
    panel.appendChild(c);

    if (record) {
      const meta = document.createElement("div");
      meta.style.cssText = "margin-top:7px;padding-top:6px;border-top:1px solid #30363d;color:#8b949e;font:9px monospace;line-height:1.4;word-break:break-word";
      meta.textContent = `${record.page.pathname} · ${bytes(record.raw)} DOM · ${record.visible_text.length.toLocaleString()} text chars`;
      panel.appendChild(meta);
    }
  }

  function installPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = "position:fixed;right:14px;bottom:14px;width:260px;padding:11px;z-index:2147483646;background:#0d1117;border:1px solid #30363d;border-radius:9px;box-shadow:0 8px 28px rgba(0,0,0,.45)";
    document.documentElement.appendChild(panel);
    render(null, "Ready");
    document.addEventListener("click", e => {
      const row = e.target.closest?.("tr");
      if (row && !e.target.closest("button,input,select,textarea,a")) selectedRow = row;
    }, true);
  }

  function scheduleAuto() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      if (lastAutoUrl === location.href) return;
      capture(false);
    }, AUTO_DELAY);
  }

  function watchNavigation() {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      if (!original) continue;
      history[method] = function () {
        const result = original.apply(this, arguments);
        setTimeout(scheduleAuto, 100);
        return result;
      };
    }
    addEventListener("popstate", () => setTimeout(scheduleAuto, 100));
  }

  function boot() {
    installPanel();
    watchNavigation();
    scheduleAuto();
  }

  if (document.readyState === "loading") addEventListener("DOMContentLoaded", boot, { once: true });
  else boot();
})();
