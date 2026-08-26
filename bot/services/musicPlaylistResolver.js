const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");

const YTDLP_PATH = path.join("/tmp", "nexus-yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
const COOKIE_PATH = "/tmp/nexus-youtube-cookies.txt";
let downloadPromise = null;
let cookiePathPromise = null;

function downloadFile(url, destination) {
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        response.resume();
        return downloadFile(response.headers.location, destination).then(resolve, reject);
      }
      if (response.statusCode !== 200) {
        response.resume();
        return reject(new Error(`yt-dlp download returned HTTP ${response.statusCode}`));
      }
      const file = fs.createWriteStream(destination);
      response.pipe(file);
      file.on("finish", () => file.close(resolve));
      file.on("error", reject);
    });
    request.on("error", reject);
    request.setTimeout(30000, () => request.destroy(new Error("yt-dlp download timed out")));
  });
}

async function ensureYtdlp() {
  if (process.env.YTDLP_PATH && fs.existsSync(process.env.YTDLP_PATH)) return process.env.YTDLP_PATH;
  if (fs.existsSync(YTDLP_PATH)) return YTDLP_PATH;
  if (!downloadPromise) {
    downloadPromise = (async () => {
      console.log("[PLAYLIST] Downloading current yt-dlp binary...");
      await downloadFile(YTDLP_URL, YTDLP_PATH);
      await fs.promises.chmod(YTDLP_PATH, 0o755);
      console.log("[PLAYLIST] yt-dlp ready");
      return YTDLP_PATH;
    })().catch(error => {
      downloadPromise = null;
      throw error;
    });
  }
  return downloadPromise;
}

async function ensureCookieFile() {
  if (cookiePathPromise) return cookiePathPromise;
  cookiePathPromise = (async () => {
    if (process.env.YTDLP_COOKIES_PATH && fs.existsSync(process.env.YTDLP_COOKIES_PATH)) return process.env.YTDLP_COOKIES_PATH;
    if (process.env.YTDLP_COOKIES_B64) {
      const decoded = Buffer.from(process.env.YTDLP_COOKIES_B64, "base64");
      if (!decoded.length) throw new Error("YTDLP_COOKIES_B64 is empty");
      await fs.promises.writeFile(COOKIE_PATH, decoded, { mode: 0o600 });
      console.log(`[PLAYLIST] YouTube cookies loaded (${decoded.length} bytes)`);
      return COOKIE_PATH;
    }
    return null;
  })().catch(error => {
    cookiePathPromise = null;
    throw error;
  });
  return cookiePathPromise;
}

function execYtdlp(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => { stdout += chunk; });
    child.stderr.on("data", chunk => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", code => {
      if (code === 0) return resolve(stdout.trim());
      reject(new Error((stderr || `yt-dlp exited with code ${code}`).trim()));
    });
  });
}

function normalizeEntry(entry, fallbackTitle) {
  if (!entry?.id && !entry?.url) return null;
  const id = entry.id || null;
  return {
    id,
    title: entry.title || fallbackTitle || "Unknown track",
    url: entry.webpage_url || entry.original_url || (id ? `https://www.youtube.com/watch?v=${id}` : entry.url),
    duration: Number(entry.duration || 0),
  };
}

async function resolvePlaylist(sourceUrl) {
  const binary = await ensureYtdlp();
  const cookiePath = await ensureCookieFile();
  const clients = ["web_safari,tv,android_vr", "tv,android_vr,web_embedded", "web_embedded,android_vr"];
  let lastError = null;

  for (const clientsArg of clients) {
    try {
      const args = [
        "--js-runtimes", "node",
        "--remote-components", "ejs:github",
      ];
      if (cookiePath) args.push("--cookies", cookiePath);
      args.push(
        "--dump-single-json",
        "--flat-playlist",
        "--yes-playlist",
        "--no-warnings",
        "--skip-download",
        "--extractor-args", `youtube:player_client=${clientsArg}`,
        sourceUrl
      );

      const output = await execYtdlp(binary, args);
      const data = JSON.parse(output);
      const entries = Array.isArray(data.entries) ? data.entries : [];
      const tracks = entries.map(entry => normalizeEntry(entry, data.title || "YouTube playlist")).filter(Boolean);
      console.log(`[PLAYLIST] yt-dlp resolved ${tracks.length} track(s) from playlist: ${data.title || "YouTube playlist"}`);
      if (!tracks.length) throw new Error("yt-dlp returned no playlist tracks");
      return { playlistName: data.title || "YouTube playlist", tracks };
    } catch (error) {
      lastError = error;
      console.warn(`[PLAYLIST] yt-dlp resolve client ${clientsArg} failed: ${error.message}`);
    }
  }

  throw new Error(`YouTube playlist extraction failed: ${lastError?.message || "unknown yt-dlp error"}`);
}

module.exports = { resolvePlaylist };
