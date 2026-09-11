// ==UserScript==
// @name         Utopia Nexus Universal Capture + Kingdom Cycler
// @namespace    utopia-nexus-universal
// @version      9.1.0
// @description  Capture every Utopia page as raw DOM for Nexus and automatically cycle Kingdom Details pages.
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

  const VERSION = "9.1.0";
  const SOURCE = "universal-capture";
  const TAB = "universal";
  const ENDPOINT = "https://utopia-nexus.onrender.com/intel";
  const KEY = "NikkoAce";
  const PANEL_ID = "nexus-universal-capture-panel";
  const AUTO_DELAY_MS = 2500;

  const KINGDOM_CYCLER_KEY = "nexus_universal_kingdom_cycler";
  const KINGDOM_PATH_RE = /\/wol\/game\/kingdom_details\/(\d+)\/(\d+)/i;

  let autoTimer = null;
  let captureBusy = false;
  let lastCapturedUrl = "";
  let lastCapture = null;
  let selectedRow = null;
  let minimized = GM_getValue("nexus_universal_minimized", false);
  let kingdomAdvanceScheduled = false;

  function showToast(message, success = true) {
    document.getElementById("nexus-universal-toast")?.remove();
    const toast = document.createElement("div");
    toast.id = "nexus-universal-toast";
    toast.textContent = message;
    toast.style.cssText = [
      "position:fixed",
      "top:18px",
      "right:18px",
      "z-index:2147483647",
      "max-width:420px",
      "padding:10px 14px",
      "border-radius:8px",
      "font:600 12px monospace",
      "color:#fff",
      `background:${success ? "#238636" : "#da3633"}`,
      "box-shadow:0 4px 18px rgba(0,0,0,.4)",
      "white-space:pre-wrap"
    ].join(";");
    document.documentElement.appendChild(toast);
    setTimeout(() => toast.remove(), 3500);
  }

  function formatBytes(value) {
    const size = new Blob([String(value || "")]).size;
    if (size < 1024) return `${size} B`;
    if (size < 1048576) return `${(size / 1024).toFixed(1)} KB`;
    return `${(size / 1048576).toFixed(2)} MB`;
  }

  function makeCaptureId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return `nx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function findIdentityHints(text) {
    const identity = {};
    const sourceText = String(text || "");

    const provinceMatch = sourceText.match(
      /(?:Province:\s*|The Province of\s+)([^\n(]{2,80})\s*\(?([0-9]+:[0-9]+)?/i
    );

    if (provinceMatch) {
      identity.province = provinceMatch[1].trim();
      if (provinceMatch[2]) identity.kd_code = provinceMatch[2];
    }

    if (!identity.kd_code) {
      const kdMatch = sourceText.match(/\b(\d+):(\d+)\b/);
      if (kdMatch) identity.kd_code = `${kdMatch[1]}:${kdMatch[2]}`;
    }

    return identity;
  }

  function buildCapture() {
    const raw = document.documentElement?.outerHTML || "";
    const visibleText = String(document.body?.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .trim();
    const capturedAt = new Date().toISOString();
    const subjectIdentity = findIdentityHints(visibleText);

    return {
      capture_id: makeCaptureId(),
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
        origin: location.origin
      },
      subject_identity: subjectIdentity,
      visible_text: visibleText,
      raw
    };
  }

  function encodeCapture(record) {
    const data = {
      category: SOURCE,
      rows: [],
      capture_id: record.capture_id,
      captured_at: record.captured_at,
      scraper_version: record.scraper_version,
      page: record.page,
      source_identity: record.source_identity,
      subject_identity: record.subject_identity,
      visible_text: record.visible_text,
      raw: record.raw
    };

    const form = new URLSearchParams();
    form.set("key", KEY);
    form.set("source", SOURCE);
    form.set("tab", TAB);
    form.set("prov", record.subject_identity.province || "");
    form.set("kd", record.subject_identity.kd_code || "");
    form.set("url", record.page.url);
    form.set("capture_id", record.capture_id);
    form.set("captured_at", record.captured_at);
    form.set("data_simple", JSON.stringify(data));
    return form.toString();
  }

  function sendCapture(record) {
    return new Promise(resolve => {
      GM_xmlhttpRequest({
        method: "POST",
        url: ENDPOINT,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: encodeCapture(record),
        timeout: 30000,
        onload: response => resolve({
          ok: response.status >= 200 && response.status < 300,
          status: response.status
        }),
        onerror: () => resolve({ ok: false, status: 0 }),
        ontimeout: () => resolve({ ok: false, status: 0 })
      });
    });
  }

  function getKingdomFromUrl(url = location.href) {
    const match = String(url).match(KINGDOM_PATH_RE);
    if (!match) return null;
    return {
      world: Number(match[1]),
      kingdom: Number(match[2]),
      code: `${match[1]}:${match[2]}`
    };
  }

  function getKingdomCyclerState() {
    return GM_getValue(KINGDOM_CYCLER_KEY, { active: false });
  }

  function setKingdomCyclerActive(active) {
    GM_setValue(KINGDOM_CYCLER_KEY, { active: !!active });
  }

  function isKingdomDetailsPage() {
    return !!getKingdomFromUrl();
  }

  function getNavigationLabel(element) {
    return String(
      element?.innerText ||
      element?.textContent ||
      element?.getAttribute?.("aria-label") ||
      element?.getAttribute?.("title") ||
      ""
    ).replace(/\s+/g, " ").trim();
  }

  function findNextKingdomElement() {
    if (!isKingdomDetailsPage()) return null;

    const candidates = Array.from(document.querySelectorAll(
      "a,button,input[type='button'],input[type='submit']"
    ));

    for (const element of candidates) {
      const label = getNavigationLabel(element);
      if (/^next$/i.test(label) || /^next\s+kingdom$/i.test(label)) {
        return element;
      }
    }

    for (const element of candidates) {
      const label = getNavigationLabel(element);
      if (/\bnext\b/i.test(label) && !/previous/i.test(label)) {
        return element;
      }
    }

    return null;
  }

  function getNextKingdomTarget() {
    const element = findNextKingdomElement();
    if (!element) return null;

    const href = element.getAttribute?.("href");
    if (href && href !== "#" && !/^javascript:/i.test(href)) {
      try {
        const url = new URL(href, location.href);
        const kingdom = getKingdomFromUrl(url.href);
        if (kingdom) {
          return { type: "url", element, url: url.href, kingdom };
        }
      } catch (_) {}
    }

    const dataHref = element.getAttribute?.("data-href");
    if (dataHref) {
      try {
        const url = new URL(dataHref, location.href);
        const kingdom = getKingdomFromUrl(url.href);
        if (kingdom) {
          return { type: "url", element, url: url.href, kingdom };
        }
      } catch (_) {}
    }

    return { type: "click", element, kingdom: null };
  }

  function maybeStartKingdomCycler() {
    const kingdom = getKingdomFromUrl();
    if (!kingdom) return;

    const state = getKingdomCyclerState();

    if (kingdom.world === 1 && kingdom.kingdom === 1 && !state.active) {
      setKingdomCyclerActive(true);
      showToast("Kingdom Cycler ✓ started at 1:1", true);
      console.log("[Nexus Universal] Kingdom Cycler started at", kingdom.code);
    }
  }

  function advanceKingdomAfterSave() {
    if (kingdomAdvanceScheduled) return;

    const current = getKingdomFromUrl();
    if (!current) return;

    const state = getKingdomCyclerState();
    if (!state.active) return;

    const target = getNextKingdomTarget();

    if (!target) {
      setKingdomCyclerActive(false);
      showToast(`Kingdom Cycler ✓ finished at ${current.code}`, true, 8000);
      console.log("[Nexus Universal] Kingdom Cycler finished", current.code);
      return;
    }

    kingdomAdvanceScheduled = true;

    if (target.type === "url") {
      showToast(
        `Kingdom ${current.code} ✓ saved\nNext → ${target.kingdom.code}`,
        true,
        3500
      );
      console.log("[Nexus Universal] Kingdom Cycler advancing", {
        current: current.code,
        next: target.kingdom.code,
        url: target.url
      });

      setTimeout(() => {
        window.location.href = target.url;
      }, 2200);
      return;
    }

    showToast(
      `Kingdom ${current.code} ✓ saved\nNext → following Utopia Next navigation`,
      true,
      3500
    );
    console.log("[Nexus Universal] Kingdom Cycler clicking Utopia Next", current.code);

    setTimeout(() => {
      target.element.click();
    }, 2200);
  }

  async function capture(manual = false) {
    if (captureBusy) return;
    captureBusy = true;

    try {
      const record = buildCapture();
      lastCapture = record;
      renderPanel(record, "Sending…", true);

      const result = await sendCapture(record);

      if (result.ok) {
        lastCapturedUrl = location.href;
        renderPanel(record, "Saved ✓", true);
        if (manual) showToast(`Captured ${formatBytes(record.raw)} DOM`, true);
        advanceKingdomAfterSave();
      } else {
        renderPanel(record, `HTTP ${result.status || "connection error"}`, false);
        showToast("Nexus capture failed to save", false);
      }
    } finally {
      captureBusy = false;
    }
  }

  function copyText(text, message) {
    GM_setClipboard(String(text || ""), "text");
    showToast(message, true);
  }

  function copyDom() {
    const html = document.documentElement?.outerHTML || "";
    if (!html) {
      showToast("No DOM available", false);
      return;
    }
    copyText(html, `Copied complete DOM (${formatBytes(html)})`);
  }

  function copySelectedRow() {
    const row = selectedRow || document.querySelector("tr");
    if (!row) {
      showToast("No table row found", false);
      return;
    }
    copyText(row.outerHTML, "Copied row HTML");
  }

  function makeButton(label, handler, secondary = false) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.style.cssText = [
      "flex:1",
      "padding:8px 6px",
      "border:0",
      "border-radius:6px",
      `background:${secondary ? "#30363d" : "#238636"}`,
      "color:#fff",
      "font:bold 11px monospace",
      "cursor:pointer"
    ].join(";");
    button.addEventListener("click", handler);
    return button;
  }

  function renderPanel(record = lastCapture, state = "Ready", success = true) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    panel.replaceChildren();

    if (minimized) {
      const compact = document.createElement("div");
      compact.style.cssText = "display:flex;align-items:center;gap:8px;color:#7ee787;font:bold 12px monospace";
      compact.append("⚡ Nexus Universal");
      const expand = makeButton("▲", () => {
        minimized = false;
        GM_setValue("nexus_universal_minimized", false);
        renderPanel(record, state, success);
      }, true);
      expand.style.flex = "0 0 auto";
      compact.appendChild(expand);
      panel.appendChild(compact);
      return;
    }

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:7px";

    const title = document.createElement("div");
    title.textContent = `⚡ Nexus Universal Capture v${VERSION}`;
    title.style.cssText = "color:#7ee787;font:bold 13px monospace";

    const minimize = makeButton("—", () => {
      minimized = true;
      GM_setValue("nexus_universal_minimized", true);
      renderPanel(record, state, success);
    }, true);
    minimize.style.flex = "0 0 auto";

    header.append(title, minimize);
    panel.appendChild(header);

    const note = document.createElement("div");
    note.textContent = "Complete DOM + visible text + metadata · no AI · no filtering · kingdom cycler automatic";
    note.style.cssText = "color:#8b949e;font:9px monospace;line-height:1.35;margin-bottom:7px";
    panel.appendChild(note);

    const status = document.createElement("div");
    status.textContent = state;
    status.style.cssText = `color:${success ? "#7ee787" : "#ff7b72"};font:10px monospace;word-break:break-word;margin-bottom:7px`;
    panel.appendChild(status);

    const firstRow = document.createElement("div");
    firstRow.style.cssText = "display:flex;gap:6px;margin-bottom:6px";
    firstRow.append(
      makeButton("Capture", () => capture(true)),
      makeButton("Copy DOM", copyDom, true)
    );
    panel.appendChild(firstRow);

    const secondRow = document.createElement("div");
    secondRow.style.cssText = "display:flex;gap:6px";
    secondRow.append(
      makeButton("Copy Row", copySelectedRow, true),
      makeButton("Refresh", () => location.reload(), true)
    );
    panel.appendChild(secondRow);

    if (record) {
      const metadata = document.createElement("div");
      metadata.style.cssText = "margin-top:7px;padding-top:6px;border-top:1px solid #30363d;color:#8b949e;font:9px monospace;line-height:1.4;word-break:break-word";
      metadata.textContent = `${record.page.pathname} · ${formatBytes(record.raw)} DOM · ${record.visible_text.length.toLocaleString()} text chars`;
      panel.appendChild(metadata);
    }
  }

  function installPanel() {
    if (document.getElementById(PANEL_ID)) return;

    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = "position:fixed;right:14px;bottom:14px;width:280px;padding:11px;z-index:2147483646;background:#0d1117;border:1px solid #30363d;border-radius:9px;box-shadow:0 8px 28px rgba(0,0,0,.45)";
    document.documentElement.appendChild(panel);
    renderPanel(null, "Ready", true);

    document.addEventListener("click", event => {
      const row = event.target?.closest?.("tr");
      if (row && !event.target.closest("button,input,select,textarea,a")) {
        selectedRow = row;
      }
    }, true);
  }

  function scheduleAutoCapture() {
    clearTimeout(autoTimer);
    autoTimer = setTimeout(() => {
      if (document.visibilityState === "hidden") return;
      if (lastCapturedUrl === location.href) return;
      capture(false);
    }, AUTO_DELAY_MS);
  }

  function watchNavigation() {
    for (const method of ["pushState", "replaceState"]) {
      const original = history[method];
      if (typeof original !== "function") continue;

      history[method] = function () {
        const result = original.apply(this, arguments);
        setTimeout(scheduleAutoCapture, 100);
        return result;
      };
    }

    addEventListener("popstate", () => setTimeout(scheduleAutoCapture, 100));
  }

  function boot() {
    installPanel();
    watchNavigation();
    maybeStartKingdomCycler();
    scheduleAutoCapture();
  }

  if (document.readyState === "loading") {
    addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();
