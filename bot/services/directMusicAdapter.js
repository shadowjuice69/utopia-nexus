const fs = require("fs");
const path = require("path");
const https = require("https");
const { spawn } = require("child_process");
const {
  joinVoiceChannel,
  entersState,
  VoiceConnectionStatus,
  createAudioPlayer,
  AudioPlayerStatus,
  createAudioResource,
  StreamType,
} = require("@discordjs/voice");

const YTDLP_PATH = path.join("/tmp", "nexus-yt-dlp");
const YTDLP_URL = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp";
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const COOKIE_PATH = "/tmp/nexus-youtube-cookies.txt";

const players = new Map();
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
      console.log("[MUSIC] Downloading current yt-dlp binary...");
      await downloadFile(YTDLP_URL, YTDLP_PATH);
      await fs.promises.chmod(YTDLP_PATH, 0o755);
      console.log("[MUSIC] yt-dlp ready");
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
      console.log(`[MUSIC] YouTube cookies loaded (${decoded.length} bytes)`);
      return COOKIE_PATH;
    }
    console.warn("[MUSIC] No YouTube cookies configured; extraction may fail on YouTube");
    return null;
  })().catch(error => {
    cookiePathPromise = null;
    throw error;
  });
  return cookiePathPromise;
}

function commonYtdlpArgs(cookiePath) {
  const args = ["--js-runtimes", "node", "--remote-components", "ejs:github"];
  if (cookiePath) args.push("--cookies", cookiePath);
  return args;
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

function normalizeEntry(entry, fallbackTitle = "Unknown track") {
  if (!entry?.id && !entry?.url) return null;
  const id = entry.id || null;
  const url = entry.webpage_url || entry.original_url || (id ? `https://www.youtube.com/watch?v=${id}` : entry.url);
  return {
    id,
    title: entry.title || fallbackTitle,
    url,
    duration: Number(entry.duration || 0),
    thumbnail: entry.thumbnail || null,
    source: entry.extractor_key || entry.extractor || "youtube",
  };
}

function parsePlaylistJson(output) {
  const data = JSON.parse(output);
  const isPlaylist = Array.isArray(data.entries);
  const entries = isPlaylist ? data.entries : [data];
  const tracks = entries.map(entry => normalizeEntry(entry, data.title || "YouTube playlist")).filter(Boolean);
  return { tracks, playlistName: isPlaylist ? (data.title || "YouTube playlist") : null };
}

async function resolveQuery(query) {
  const binary = await ensureYtdlp();
  const cookiePath = await ensureCookieFile();
  const target = /^https?:\/\//i.test(query) ? query : `ytsearch1:${query}`;
  const looksLikePlaylist = /[?&]list=/i.test(query);
  const clients = ["web_safari,tv,android_vr", "tv,android_vr,web_embedded", "web_embedded,android_vr"];
  let lastError = null;

  for (const clientsArg of clients) {
    try {
      const args = [
        ...commonYtdlpArgs(cookiePath),
        "--dump-single-json",
        "--flat-playlist",
        "--no-warnings",
        "--skip-download",
        "--extractor-args", `youtube:player_client=${clientsArg}`,
      ];
      if (looksLikePlaylist) args.push("--yes-playlist");
      args.push(target);

      const output = await execYtdlp(binary, args);
      const result = parsePlaylistJson(output);
      console.log(`[MUSIC] yt-dlp resolved ${result.tracks.length} track(s)${result.playlistName ? ` from playlist: ${result.playlistName}` : ""}`);
      if (!result.tracks.length) throw new Error("yt-dlp returned no playable tracks");
      return result;
    } catch (error) {
      lastError = error;
      console.warn(`[MUSIC] yt-dlp resolve client ${clientsArg} failed: ${error.message}`);
    }
  }
  throw new Error(`YouTube extraction failed: ${lastError?.message || "unknown yt-dlp error"}`);
}

async function spawnAudioStream(track) {
  const binary = await ensureYtdlp();
  const cookiePath = await ensureCookieFile();
  const clients = "web_safari,tv,android_vr";
  const args = [
    ...commonYtdlpArgs(cookiePath), "--no-warnings", "--no-playlist", "--quiet",
    "-f", "bestaudio/best", "--extractor-args", `youtube:player_client=${clients}`, "-o", "-", track.url,
  ];
  const ytdlp = spawn(binary, args, { stdio: ["ignore", "pipe", "pipe"] });
  const ffmpeg = spawn(FFMPEG, ["-hide_banner", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ar", "48000", "-ac", "2", "pipe:1"], { stdio: ["pipe", "pipe", "pipe"] });
  ytdlp.stdout.pipe(ffmpeg.stdin);
  ytdlp.stderr.setEncoding("utf8");
  ffmpeg.stderr.setEncoding("utf8");
  ytdlp.stderr.on("data", data => console.warn(`[MUSIC] yt-dlp: ${data.trim()}`));
  ffmpeg.stderr.on("data", data => console.warn(`[MUSIC] ffmpeg: ${data.trim()}`));
  const cleanup = () => { try { ytdlp.kill("SIGKILL"); } catch {} try { ffmpeg.kill("SIGKILL"); } catch {} };
  ffmpeg.on("close", () => { try { ytdlp.kill("SIGKILL"); } catch {} });
  ytdlp.on("close", code => { if (code !== 0) console.warn(`[MUSIC] yt-dlp playback exited with code ${code}`); });
  return { stream: ffmpeg.stdout, cleanup };
}

function makePlayerState(guildId, voiceChannelId, textChannelId, connection) {
  const audioPlayer = createAudioPlayer();
  connection.subscribe(audioPlayer);
  const state = { guildId, voiceChannelId, textChannelId, connection, audioPlayer, queue: [], current: null, currentResource: null, currentCleanup: null, volume: 1, loop: false, destroyed: false };
  audioPlayer.on("error", error => { console.error(`[MUSIC] Direct audio player error guild=${guildId}: ${error.message}`); if (!state.destroyed) playNext(state).catch(err => console.error(`[MUSIC] Playback recovery failed: ${err.message}`)); });
  audioPlayer.on(AudioPlayerStatus.Idle, () => { if (!state.destroyed) playNext(state).catch(err => console.error(`[MUSIC] Next track failed: ${err.message}`)); });
  return state;
}

async function playTrack(state, track) {
  state.current = track;
  const audio = await spawnAudioStream(track);
  state.currentCleanup = audio.cleanup;
  const resource = createAudioResource(audio.stream, { inputType: StreamType.Raw, inlineVolume: true, metadata: track });
  resource.volume.setVolume(state.volume);
  state.currentResource = resource;
  state.audioPlayer.play(resource);
  console.log(`[MUSIC] ▶ Direct playback: ${track.title}`);
}

async function playNext(state) {
  if (state.destroyed) return;
  if (state.currentCleanup) { try { state.currentCleanup(); } catch {} state.currentCleanup = null; }
  if (state.loop && state.current) return playTrack(state, state.current);
  const next = state.queue.shift();
  if (!next) { state.current = null; state.currentResource = null; return; }
  return playTrack(state, next);
}

async function createPlayer({ guildId, voiceChannelId, textChannelId }) {
  const existing = players.get(guildId);
  if (existing && existing.connection.state.status !== VoiceConnectionStatus.Destroyed) return wrap(existing);
  const client = global.__NEXUS_DISCORD_CLIENT;
  const guild = client?.guilds?.cache?.get(guildId);
  if (!guild) throw new Error("Guild is not available to the bot.");
  const connection = joinVoiceChannel({ channelId: voiceChannelId, guildId, adapterCreator: guild.voiceAdapterCreator, selfDeaf: true, selfMute: false });
  await entersState(connection, VoiceConnectionStatus.Ready, 20000);
  const state = makePlayerState(guildId, voiceChannelId, textChannelId, connection);
  players.set(guildId, state);
  console.log(`[MUSIC] Direct Discord voice connection ready for guild ${guildId}`);
  return wrap(state);
}

function wrap(state) {
  return {
    raw: state,
    get connected() { return state.connection.state.status === VoiceConnectionStatus.Ready; },
    get playing() { return state.audioPlayer.state.status === AudioPlayerStatus.Playing; },
    get paused() { return state.audioPlayer.state.status === AudioPlayerStatus.Paused; },
    get currentTrack() { return state.current; },
    get queueSize() { return state.queue.length; },
    get queue() { return state.queue.slice(); },
    async addQuery(query, requester) {
      const result = await resolveQuery(query);
      for (const track of result.tracks) track.requester = requester;
      state.queue.push(...result.tracks);
      console.log(`[MUSIC] Queued ${result.tracks.length} track(s). Queue now: ${state.queue.length}`);
      if (state.audioPlayer.state.status === AudioPlayerStatus.Idle && !state.current) await playNext(state);
      return { loadType: result.playlistName ? "playlist" : "track", tracks: result.tracks, playlistName: result.playlistName };
    },
    async pause() { state.audioPlayer.pause(true); },
    async resume() { state.audioPlayer.unpause(); },
    async skip() { state.audioPlayer.stop(true); },
    async stop() { await destroyPlayer(state.guildId); },
    async setVolume(value) { state.volume = Math.max(0, Math.min(1, Number(value) / 100)); if (state.currentResource?.volume) state.currentResource.volume.setVolume(state.volume); },
    async seek() { throw new Error("Seek is not available in direct yt-dlp mode yet."); },
    async setLoop(enabled) { state.loop = Boolean(enabled); },
    shuffle() { for (let i = state.queue.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [state.queue[i], state.queue[j]] = [state.queue[j], state.queue[i]]; } },
    clearQueue() { state.queue.length = 0; },
    async destroy() { await destroyPlayer(state.guildId); },
  };
}

async function destroyPlayer(guildId) {
  const state = players.get(guildId);
  if (!state) return;
  state.destroyed = true;
  players.delete(guildId);
  try { state.currentCleanup?.(); } catch {}
  try { state.audioPlayer.stop(true); } catch {}
  try { state.connection.destroy(); } catch {}
}

function initialize(client) { global.__NEXUS_DISCORD_CLIENT = client; console.log("[MUSIC] Direct yt-dlp/FFmpeg music backend initialized"); }
function initClient() {}
function forwardVoiceState() {}
function destroy() { for (const guildId of players.keys()) destroyPlayer(guildId); }
module.exports = { initialize, initClient, forwardVoiceState, createPlayer, destroy };
