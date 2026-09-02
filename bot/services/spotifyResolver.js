/**
 * spotifyResolver.js
 * Resolves Spotify track/playlist/album URLs to YouTube search queries
 * Uses Spotify Client Credentials flow (no user login needed)
 */

const https = require("https");

const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID || "";
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET || "";

let accessToken = null;
let tokenExpiry = 0;

function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, { headers }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("Spotify request timed out")));
    req.end();
  });
}

function httpsPost(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = typeof body === "string" ? body : new URLSearchParams(body).toString();
    const urlObj = new URL(url);
    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "Content-Length": Buffer.byteLength(postData),
        ...headers
      }
    }, res => {
      let data = "";
      res.on("data", chunk => (data += chunk));
      res.on("end", () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on("error", reject);
    req.setTimeout(10000, () => req.destroy(new Error("Spotify token request timed out")));
    req.write(postData);
    req.end();
  });
}

async function getAccessToken() {
  if (accessToken && Date.now() < tokenExpiry) return accessToken;
  const credentials = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await httpsPost(
    "https://accounts.spotify.com/api/token",
    { grant_type: "client_credentials" },
    { Authorization: `Basic ${credentials}` }
  );
  if (res.status !== 200 || !res.body.access_token) {
    throw new Error(`Spotify auth failed: ${JSON.stringify(res.body)}`);
  }
  accessToken = res.body.access_token;
  tokenExpiry = Date.now() + (res.body.expires_in - 60) * 1000;
  return accessToken;
}

async function spotifyGet(endpoint) {
  const token = await getAccessToken();
  const res = await httpsGet(`https://api.spotify.com/v1${endpoint}`, {
    Authorization: `Bearer ${token}`
  });
  if (res.status !== 200) throw new Error(`Spotify API error ${res.status}: ${JSON.stringify(res.body)}`);
  return res.body;
}

function trackToSearchQuery(track) {
  const artists = (track.artists || []).map(a => a.name).join(", ");
  return `${artists} - ${track.name || ""}`;
}

function trackToMeta(track) {
  return {
    title: track.name,
    artist: (track.artists || []).map(a => a.name).join(", "),
    album: track.album?.name || null,
    duration: track.duration_ms ? Math.floor(track.duration_ms / 1000) : null,
    thumbnail: track.album?.images?.[0]?.url || null,
    searchQuery: trackToSearchQuery(track)
  };
}

function parseSpotifyUrl(url) {
  const match = url.match(/spotify\.com\/(track|playlist|album)\/([A-Za-z0-9]+)/);
  if (!match) return null;
  return { type: match[1], id: match[2] };
}

function isSpotifyUrl(query) {
  return /spotify\.com\/(track|playlist|album)\//.test(query);
}

async function resolveSpotify(url) {
  const parsed = parseSpotifyUrl(url);
  if (!parsed) throw new Error("Invalid Spotify URL");

  if (parsed.type === "track") {
    const track = await spotifyGet(`/tracks/${parsed.id}`);
    return {
      playlistName: `${track.name} — ${(track.artists || []).map(a => a.name).join(", ")}`,
      tracks: [trackToMeta(track)]
    };
  }

  if (parsed.type === "playlist") {
    const playlist = await spotifyGet(`/playlists/${parsed.id}?fields=name,tracks.items(track(name,artists,album,duration_ms)),tracks.next,tracks.total`);
    let items = (playlist.tracks?.items || []).map(i => i.track).filter(Boolean);
    let next = playlist.tracks?.next;
    while (next && items.length < 500) {
      const path = next.replace("https://api.spotify.com/v1", "");
      const page = await spotifyGet(path);
      items = items.concat((page.items || []).map(i => i.track).filter(Boolean));
      next = page.next;
    }
    return {
      playlistName: playlist.name,
      tracks: items.slice(0, 500).map(trackToMeta)
    };
  }

  if (parsed.type === "album") {
    const album = await spotifyGet(`/albums/${parsed.id}`);
    const tracks = (album.tracks?.items || []).map(t => ({
      ...t,
      album: { name: album.name, images: album.images }
    }));
    return {
      playlistName: `${album.name} — ${(album.artists || []).map(a => a.name).join(", ")}`,
      tracks: tracks.map(trackToMeta)
    };
  }

  throw new Error(`Unsupported Spotify type: ${parsed.type}`);
}

module.exports = { isSpotifyUrl, resolveSpotify };
