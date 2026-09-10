// ==UserScript==
// @name         Nexus Universal Capture
// @namespace    utopia-nexus
// @version      8.0.0
// @description  Universal, lossless Utopia page capture. Stores raw DOM, visible text and page metadata without interpreting or filtering the page.
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

  const VERSION = "8.0.0";
  const ENDPOINT = "https://utopia-nexus.onrender.com/intel";
  const KEY = "NikkoAce";
  const PANEL_ID = "nexus-universal-panel";
  const AUTO_DELAY = 2500;
  const MAX_STATUS = 180;

  let lastCapture = null;
  let lastRow = null;
  let autoTimer = null;
  let captureInFlight = false;
  let lastAutoUrl = "";
  let panelMinimized = GM_getValue("nexus_v8_minimized", false);

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  function toast(message, good = true) {
    let old = document.getElementById("nexus-v8-toast");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "nexus-v8-toast";
    el.textContent = message;
    el.style.cssText = [
      "position:fixed", "top:20px", "right:20px", "z-index:2147483647",
      "max-width:360px", "padding:10px 14px", "border-radius:8px",
      "font:600 12px monospace", "color:#fff",
      `background:${good ? "#238636" : "#da3633"}`,
      "box-shadow:0 4px 16px rgba(0,0,0,.35)"
    ].join(";");
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), 2800);
  }

  function setStatus(message, good = true) {
    const el = document.getElementById("nexus-v8-status");
    if (!el) return;
    el.textContent = message.length > MAX_STATUS ? message.slice(0, MAX_STATUS) + "…" : message;
    el.style.color = good ? "#7ee787" : "#ff7b72";
  }

  function uuid() {
    if (crypto && typeof crypto.randomUUID === "function") return crypto.randomUUID();
    return "nx-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
  }

  function normalizeText(text) {
    return String(text || "").replace(/\u00a0/g, " ").replace(/\r\n?/g, "\n").trim();
  }

  function sourceIdentity() {
    const body = document.body?.innerText || "";
    const candidates = [];
    const account = body.match(/(?:^|\n)([A-Za-z][A-Za-z0-9 _.'-]{1,40})(?:\n|$)/);
    if (account) candidates.push(account[1].trim());
    const title = document.title.trim();
    if (title) candidates.push(title);
    return {
      hostname: location.hostname,
      origin: location.origin,
      account_hint: candidates[0] || null,
      game_host: /utopia-game\.com$/.test(location.hostname) ? "utopia-game" : "intel-site"
    };
  }

  function subjectHints(text) {
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

  function buildCapture() {
    const rawHtml = document.documentElement ? document.documentElement.outerHTML : "";
    const visibleText = normalizeText(document.body ? document.body.innerText : "");
    const now = new Date().toISOString();
    const hints = subjectHints(visibleText);
    return {
      capture_id: uuid(),
      captured_at: now,
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
      source_identity: sourceIdentity(),
      subject_identity: hints,
      raw_html: rawHtml,
      visible_text: visibleText
    };
  }

  function encodeForm(data) {
    const form = new URLSearchParams();
    form.set("key", KEY);
    form.set("source", "universal-capture");
    form.set("tab", "universal");
    form.set("prov", data.subject_identity.province || "");
    form.set("kd", data.subject_identity.kd || "");
    form.set("url", data.page.url);
    form.set("capture_id", data.capture_id);
    form.set("captured_at", data.captured_at);
    form.set("data_simple", JSON.stringify({
      capture_id: data.capture_id,
      captured_at: data.captured_at,
      scraper_version: data.scraper_version,
      page: data.page,
      source_identity: data.source_identity,
      subject_identity: data.subject_identity,
      visible_text: data.visible_text,
      raw_html: data.raw_html
    }));
    return form.toString();
  }

  function post(data) {
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: "POST",
        url: ENDPOINT,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: encodeForm(data),
        timeout: 30000,
        onload: response => resolve({ ok: response.status >= 200 && response.status < 300, status: response.status, body: response.responseText || "" }),
        onerror: error => resolve({ ok: false, status: 0, error }),
        ontimeout: () => resolve({ ok: false, status: 0, timeout: true })
      });
    });
  }

  async function capture(manual = false) {
    if (captureInFlight) return;
    captureInFlight = true;
    try {
      setStatus("Capturing complete DOM…");
      await sleep(50);
      const data = buildCapture();
      lastCapture = data;
      updatePanel(data, "Sending…");
      const result = await post(data);
      if (result.ok) {
        lastAutoUrl = location.href;
        updatePanel(data, "Saved ✓");
        if (manual) toast(`Nexus captured ${formatBytes(data.raw_html.length)} of DOM`, true);
      } else {
        updatePanel(data, `HTTP ${result.status || "connection error"}`);
        toast("Nexus capture could not be saved", false);
      }
    } finally {
      captureInFlight = false;
    }
  }

  function formatBytes(chars) {
    const bytes = new Blob(["".padEnd(Math.min(chars, 100000), "x")]).size * (chars / Math.max(1, Math.min(chars, 100000)));
    if (bytes < 1024) return `${Math.round(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function copy(text, message) {
    GM_setClipboard(text, "text");
    toast(message, true);
  }

  function copyDom() {
    const html = document.documentElement?.outerHTML || "";
    if (!html) return toast("No DOM available", false);
    copy(html, `Copied complete DOM (${formatBytes(html.length)})`);
  }

  function copyRow() {
    const row = lastRow || document.querySelector("tr");
    if (!row) return toast("No table row found on this page", false);
    copy(row.outerHTML, "Copied table row");
  }

  function clearHistory() {
    lastCapture = null;
    lastAutoUrl = "";
    updatePanel(null, "Ready");
    toast("Nexus local capture state cleared", true);
  }

  function makeButton(id, label, action, secondary = false) {
    const b = document.createElement("button");
    b.id = id;
    b.textContent = label;
    b.type = "button";
    b.style.cssText = [
      "flex:1", "padding:8px 6px", "border:0", "border-radius:6px",
      `background:${secondary ? "#30363d" : "#238636"}`, "color:#fff",
      "font:bold 11px monospace", "cursor:pointer"
    ].join(";");
    b.addEventListener("click", action);
    return b;
  }

  function updatePanel(data = lastCapture, statusText = "Ready") {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.innerHTML = "";
    if (panelMinimized) {
      const mini = document.createElement("div");
      mini.style.cssText = "display:flex;align-items:center;gap:8px;font:bold 12px monospace;color:#7ee787";
      mini.textContent = "⚡ Nexus v8";
      const expand = makeButton("nexus-v8-expand", "▲", () => {
        panelMinimized = false;
        GM_setValue("nexus_v8_minimized", false);
        updatePanel(data, statusText);
      }, true);
      expand.style.flex = "0 0 auto";
      mini.appendChild(expand);
      panel.appendChild(mini);
      return;
    }

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:8px";
    const title = document.createElement("div");
    title.textContent = "⚡ Nexus Universal Capture";
    title.style.cssText = "font:bold 13px monospace;color:#7ee787";
    const min = makeButton("nexus-v8-min", "—", () => {
      panelMinimized = true;
      GM_setValue("nexus_v8_minimized", true);
      updatePanel(data, statusText);
    }, true);
    min.style.flex = "0 0 auto";
    header.append(title, min);
    panel.appendChild(header);

    const desc = document.createElement("div");
    desc.textContent = "Raw DOM + visible text + metadata. No page filtering.";
    desc.style.cssText = "font:10px monospace;color:#8b949e;margin-bottom:8px;line-height:1.35";
    panel.appendChild(desc);

    const status = document.createElement("div");
    status.id = "nexus-v8-status";
    status.textContent = statusText;
    status.style.cssText = "font:10px monospace;color:#7ee787;margin-bottom:8px;word-break:break-word";
    panel.appendChild(status);

    const buttons1 = document.createElement("div");
    buttons1.style.cssText = "display:flex;gap:6px;margin-bottom:6px";
    buttons1.append(
      makeButton("nexus-v8-capture", "Capture", () => capture(true)),
      makeButton("nexus-v8-dom", "Copy DOM", copyDom, true)
    );
    panel.appendChild(buttons1);

    const buttons2 = document.createElement("div");
    buttons2.style.cssText = "display:flex;gap:6px";
    buttons2.append(
      makeButton("nexus-v8-row", "Copy Row", copyRow, true),
      makeButton("nexus-v8-clear", "Clear", clearHistory, true)
    );
    panel.appendChild(buttons2);

    if (data) {
      const meta = document.createElement("div");
      meta.style.cssText = "margin-top:8px;padding-top:7px;border-top:1px solid #30363d;font:9px monospace;color:#8b949e;line-height:1.45";
      meta.textContent = `${data.page.pathname} · ${formatBytes(data.raw_html.length)} DOM · ${data.visible_text.length.toLocaleString()} text chars`;
      panel.appendChild(meta);
    }
  }

  function installPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = [
      "position:fixed", "right:14px", "bottom:14px", "width:250px",
      "padding:11px", "z-index:2147483646", "background:#0d1117",
      "border:1px solid #30363d", "border-radius:9px",
      "box-shadow:0 8px 28px rgba(0,0,0,.45)"
    ].join(";");
    document.documentElement.appendChild(panel);
    updatePanel(null, "Ready");

    document.addEventListener("click", event => {
      const row = event.target.closest?.("tr");
      if (row && !event.target.closest("button,input,select,textarea,a")) lastRow = row;
    }, true);
  }

  function scheduleAutoCapture() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      if (lastAutoUrl === location.href) return;
      capture(false);
    }, AUTO_DELAY);
  }

  function watchNavigation() {
    const wrap = method => {
      const original = history[method];
      if (typeof original !== "function") return;
      history[method] = function () {
        const result = original.apply(this, arguments);
        setTimeout(() => {
          installPanel();
          scheduleAutoCapture();
        }, 100);
        return result;
      };
    };
    wrap("pushState");
    wrap("replaceState");
    addEventListener("popstate", () => setTimeout(scheduleAutoCapture, 100));
  }

  function boot() {
    installPanel();
    watchNavigation();
    scheduleAutoCapture();
  }

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
