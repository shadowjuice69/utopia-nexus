// ==UserScript==
// @name         Utopia Nexus Universal Capture + Kingdom Cycler
// @namespace    utopia-nexus-universal
// @version      10.0.0
// @description  Lossless Utopia DOM capture with authoritative URL identity and deterministic kingdom cycling.
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

  const VERSION = "10.0.0";
  const SOURCE = "universal-capture";
  const TAB = "universal";
  const ENDPOINT = "https://utopia-nexus.onrender.com/intel";
  const KEY_STORAGE = "nexus_universal_intel_key";
  const PANEL_ID = "nexus-universal-capture-panel";
  const CYCLER_STORAGE = "nexus_universal_kingdom_cycler_v10";
  const AUTO_DELAY_MS = 2500;
  const RETRIES = 3;
  const RETRY_DELAY_MS = 2500;
  const MAX_WORLD = 9;
  const MAX_KINGDOM = 13;
  const KINGDOM_PATH_RE = /\/wol\/game\/kingdom_details\/(\d+)\/(\d+)/i;

  let captureBusy = false;
  let lastCapturedUrl = "";
  let lastCapture = null;
  let minimized = GM_getValue("nexus_universal_minimized", false);
  let advanceScheduled = false;

  function clean(value) {
    return String(value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  }

  function toast(message, success = true, duration = 4500) {
    document.getElementById("nexus-universal-toast")?.remove();
    const el = document.createElement("div");
    el.id = "nexus-universal-toast";
    el.textContent = message;
    el.style.cssText = [
      "position:fixed","top:18px","right:18px","z-index:2147483647",
      "max-width:460px","padding:10px 14px","border-radius:8px",
      "font:600 12px monospace","color:#fff",
      `background:${success ? "#238636" : "#da3633"}`,
      "box-shadow:0 4px 18px rgba(0,0,0,.4)","white-space:pre-wrap"
    ].join(";");
    document.documentElement.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }

  function bytes(value) {
    const n = new Blob([String(value || "")]).size;
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    return `${(n / 1048576).toFixed(2)} MB`;
  }

  function captureId() {
    if (crypto?.randomUUID) return crypto.randomUUID();
    return `nx-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function kingdomFromUrl(url = location.href) {
    const m = String(url).match(KINGDOM_PATH_RE);
    return m ? { world: Number(m[1]), kingdom: Number(m[2]), code: `${m[1]}:${m[2]}` } : null;
  }

  function kingdomCode(world, kingdom) {
    return `${world}:${kingdom}`;
  }

  function nextKingdom(current) {
    if (!current) return null;
    if (current.kingdom < MAX_KINGDOM) {
      return { world: current.world, kingdom: current.kingdom + 1, code: kingdomCode(current.world, current.kingdom + 1) };
    }
    if (current.world < MAX_WORLD) {
      return { world: current.world + 1, kingdom: 1, code: kingdomCode(current.world + 1, 1) };
    }
    return null;
  }

  function kingdomUrl(k) {
    return `${location.origin}/wol/game/kingdom_details/${k.world}/${k.kingdom}`;
  }

  function getCycler() {
    return GM_getValue(CYCLER_STORAGE, { active: false });
  }

  function setCycler(state) {
    GM_setValue(CYCLER_STORAGE, state);
  }

  function startCycler() {
    const current = kingdomFromUrl();
    if (!current) {
      toast("Open a Kingdom Details page first.", false);
      return;
    }
    setCycler({ active: true, started_at: new Date().toISOString(), start: current.code });
    advanceScheduled = false;
    toast(`Kingdom Cycler ✓ active from ${current.code}`);
    renderPanel(lastCapture, "Cycler active", true);
  }

  function stopCycler() {
    setCycler({ active: false });
    advanceScheduled = false;
    toast("Kingdom Cycler stopped.");
    renderPanel(lastCapture, "Cycler stopped", true);
  }

  function resetCycler() {
    setCycler({ active: false });
    advanceScheduled = false;
    GM_setValue("nexus_universal_cycler_last", null);
    toast("Kingdom Cycler reset.");
    renderPanel(lastCapture, "Cycler reset", true);
  }

  function getKey() {
    let key = String(GM_getValue(KEY_STORAGE, "") || "").trim();
    if (key) return key;
    key = String(window.prompt("Nexus Universal Capture\n\nEnter your Nexus Intel key.\n\nLeave blank if the receiver does not require one.") || "").trim();
    if (key) GM_setValue(KEY_STORAGE, key);
    return key;
  }

  function identityHints(visibleText) {
    const identity = {};
    const pageKingdom = kingdomFromUrl();
    if (pageKingdom) identity.kd_code = pageKingdom.code;

    const text = String(visibleText || "");
    const province = text.match(/(?:Province:\s*|The Province of\s+)([^\n(]{2,100})\s*\(?([0-9]+:[0-9]+)?/i);
    if (province) {
      identity.province = clean(province[1]);
      if (!identity.kd_code && province[2]) identity.kd_code = province[2];
    }

    if (!identity.kd_code) {
      const kd = text.match(/\b(\d+):(\d+)\b/);
      if (kd) identity.kd_code = `${kd[1]}:${kd[2]}`;
    }
    return identity;
  }

  function buildCapture() {
    const raw = document.documentElement?.outerHTML || "";
    const visibleText = String(document.body?.innerText || "")
      .replace(/\u00a0/g, " ")
      .replace(/\r\n?/g, "\n")
      .replace(/[ \t]+\n/g, "\n")
      .trim();
    const capturedAt = new Date().toISOString();
    return {
      capture_id: captureId(),
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
      source_identity: { hostname: location.hostname, origin: location.origin },
      subject_identity: identityHints(visibleText),
      visible_text: visibleText,
      raw
    };
  }

  function encode(record, key) {
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
    if (key) form.set("key", key);
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

  function send(record, key) {
    return new Promise(resolve => {
      const body = encode(record, key);
      GM_xmlhttpRequest({
        method: "POST",
        url: ENDPOINT,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        data: body,
        timeout: 30000,
        onload: r => {
          let text = String(r.responseText || "").replace(/\s+/g, " ").trim();
          if (text.length > 400) text = text.slice(0, 400) + "...";
          resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, text, size: new Blob([body]).size });
        },
        onerror: e => resolve({ ok: false, status: 0, text: e?.error || e?.message || "network error" }),
        ontimeout: () => resolve({ ok: false, status: 0, text: "timeout" })
      });
    });
  }

  async function sendWithRetry(record, key) {
    let result = null;
    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      toast(`Nexus capture → sending ${attempt}/${RETRIES}`);
      result = await send(record, key);
      if (result.ok) return result;
      if (attempt < RETRIES) await new Promise(r => setTimeout(r, RETRY_DELAY_MS));
    }
    return result || { ok: false, status: 0, text: "unknown failure" };
  }

  function failure(result) {
    if (!result) return "unknown failure";
    if (result.status === 401) return "401 Unauthorized — key rejected";
    if (result.status === 413) return "413 Payload Too Large";
    if (result.status === 500) return `500 Server Error — ${result.text || "receiver failed"}`;
    if ([502,503,504].includes(result.status)) return `${result.status} — receiver unavailable`;
    if (result.status === 0) return `Network failure — ${result.text || "request failed"}`;
    return `${result.status} ${result.text || "request failed"}`;
  }

  function advanceAfterSave() {
    if (advanceScheduled) return;
    const current = kingdomFromUrl();
    const state = getCycler();
    if (!current || !state.active) return;

    const next = nextKingdom(current);
    GM_setValue("nexus_universal_cycler_last", current.code);
    if (!next) {
      stopCycler();
      toast(`Kingdom Cycler ✓ complete at ${current.code}`, true, 9000);
      return;
    }

    advanceScheduled = true;
    toast(`Saved ${current.code} ✓\nNext → ${next.code}`, true, 3500);
    setTimeout(() => {
      window.location.href = kingdomUrl(next);
    }, 2200);
  }

  async function capture(manual = false) {
    if (captureBusy) return;
    captureBusy = true;
    try {
      const key = getKey();
      const record = buildCapture();
      lastCapture = record;
      renderPanel(record, "Sending…", true);
      if (!record.raw) throw new Error("No DOM available");
      const result = await sendWithRetry(record, key);
      if (!result.ok) {
        renderPanel(record, failure(result), false);
        toast(`Nexus capture ✕ ${failure(result)}`, false, 9000);
        return;
      }
      lastCapturedUrl = location.href;
      GM_setValue("nexus_universal_last_capture", { url: location.href, capture_id: record.capture_id, captured_at: record.captured_at });
      renderPanel(record, `Saved ✓ ${bytes(record.raw)} · KD ${record.subject_identity.kd_code || "unknown"}`, true);
      if (manual) toast(`Captured ${bytes(record.raw)} DOM ✓`, true);
      advanceAfterSave();
    } catch (error) {
      renderPanel(lastCapture, error?.message || "capture failed", false);
      toast(`Nexus capture ✕ ${error?.message || "capture failed"}`, false, 9000);
    } finally {
      captureBusy = false;
    }
  }

  function copyDom() {
    const html = document.documentElement?.outerHTML || "";
    if (!html) return toast("No DOM available", false);
    GM_setClipboard(html, "text");
    toast(`Copied complete DOM (${bytes(html)}) ✓`);
  }

  function button(label, handler, secondary = false) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = label;
    b.style.cssText = ["flex:1","padding:8px 6px","border:0","border-radius:6px",`background:${secondary ? "#30363d" : "#238636"}`,"color:#fff","font:bold 11px monospace","cursor:pointer"].join(";");
    b.onclick = handler;
    return b;
  }

  function renderPanel(record = lastCapture, state = "Ready", success = true) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    panel.replaceChildren();

    const header = document.createElement("div");
    header.style.cssText = "display:flex;align-items:center;justify-content:space-between;margin-bottom:7px";
    const title = document.createElement("div");
    title.textContent = `⚡ Nexus Universal v${VERSION}`;
    title.style.cssText = "color:#7ee787;font:bold 13px monospace";
    const min = button(minimized ? "▲" : "—", () => { minimized = !minimized; GM_setValue("nexus_universal_minimized", minimized); renderPanel(record, state, success); }, true);
    min.style.flex = "0 0 auto";
    header.append(title, min);
    panel.appendChild(header);
    if (minimized) return;

    const note = document.createElement("div");
    note.textContent = "RAW DOM + visible text + metadata · URL-authoritative identity · deterministic 9×13 kingdom cycler";
    note.style.cssText = "color:#8b949e;font:9px monospace;line-height:1.35;margin-bottom:7px";
    panel.appendChild(note);

    const status = document.createElement("div");
    status.textContent = state;
    status.style.cssText = `color:${success ? "#7ee787" : "#ff7b72"};font:10px monospace;word-break:break-word;margin-bottom:7px`;
    panel.appendChild(status);

    const row1 = document.createElement("div");
    row1.style.cssText = "display:flex;gap:6px;margin-bottom:6px";
    row1.append(button("Capture", () => capture(true)), button("Copy DOM", copyDom, true));
    panel.appendChild(row1);

    const row2 = document.createElement("div");
    row2.style.cssText = "display:flex;gap:6px";
    const active = !!getCycler().active;
    row2.append(
      button(active ? "Cycler ON" : "Start Cycler", startCycler),
      button("Stop", stopCycler, true),
      button("Reset", resetCycler, true)
    );
    panel.appendChild(row2);

    const current = kingdomFromUrl();
    if (current) {
      const info = document.createElement("div");
      const next = nextKingdom(current);
      info.textContent = `Current KD: ${current.code}${next ? ` · next: ${next.code}` : " · FINAL"}${getCycler().active ? " · CYCLING" : ""}`;
      info.style.cssText = "color:#c9d1d9;font:9px monospace;margin-top:7px";
      panel.appendChild(info);
    }
  }

  function installPanel() {
    if (document.getElementById(PANEL_ID)) return;
    const panel = document.createElement("div");
    panel.id = PANEL_ID;
    panel.style.cssText = ["position:fixed","right:16px","bottom:16px","z-index:2147483646","width:330px","padding:10px","background:#161b22","border:1px solid #30363d","border-radius:9px","box-shadow:0 8px 30px rgba(0,0,0,.45)","color:#fff"].join(";");
    document.documentElement.appendChild(panel);
    renderPanel();
  }

  function scheduleCapture() {
    setTimeout(() => {
      if (location.href !== lastCapturedUrl) capture(false);
    }, AUTO_DELAY_MS);
  }

  function hookNavigation() {
    const push = history.pushState;
    const replace = history.replaceState;
    history.pushState = function (...args) { const result = push.apply(this, args); setTimeout(scheduleCapture, 700); return result; };
    history.replaceState = function (...args) { const result = replace.apply(this, args); setTimeout(scheduleCapture, 700); return result; };
    addEventListener("popstate", () => setTimeout(scheduleCapture, 700));
    addEventListener("hashchange", () => setTimeout(scheduleCapture, 700));
  }

  function observeDom() {
    let timer = null;
    const observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (!captureBusy && location.href !== lastCapturedUrl) capture(false);
      }, 1400);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function start() {
    installPanel();
    hookNavigation();
    observeDom();
    scheduleCapture();
    console.log("[Nexus Universal] v10 active", { url: location.href, kingdom: kingdomFromUrl()?.code || null });
  }

  start();
})();
