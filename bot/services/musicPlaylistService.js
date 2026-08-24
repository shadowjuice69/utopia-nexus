const supabase = require("./supabase").getClient();
const musicAdapter = require("./directMusicAdapter");

function requireClient() {
  if (!supabase) throw new Error("Supabase is not configured for playlist storage.");
  return supabase;
}

function normalizeName(name) {
  const value = String(name || "").trim();
  if (!value) throw new Error("Playlist name is required.");
  if (value.length > 80) throw new Error("Playlist name must be 80 characters or fewer.");
  return value;
}

function ownerId(user) {
  const id = user?.id;
  if (!id) throw new Error("Unable to identify playlist owner.");
  return id;
}

async function resolveSource(sourceUrl) {
  if (!musicAdapter.resolveQuery) throw new Error("Music resolver is unavailable.");
  const result = await musicAdapter.resolveQuery(sourceUrl);
  if (!result?.tracks?.length) throw new Error("No playable tracks were found in that playlist.");
  return result;
}

async function replaceTracks(client, playlistId, tracks) {
  const rows = tracks.map((track, index) => ({
    playlist_id: playlistId,
    position: index,
    youtube_video_id: track.id || null,
    title: track.title || "Unknown track",
    url: track.url,
    duration_seconds: Number(track.duration || 0) || null,
  }));

  const { error: deleteError } = await client
    .from("music_playlist_tracks")
    .delete()
    .eq("playlist_id", playlistId);
  if (deleteError) throw deleteError;

  for (let offset = 0; offset < rows.length; offset += 500) {
    const batch = rows.slice(offset, offset + 500);
    const { error } = await client.from("music_playlist_tracks").insert(batch);
    if (error) throw error;
  }
}

async function save(user, name, sourceUrl) {
  const client = requireClient();
  const owner = ownerId(user);
  const playlistName = normalizeName(name);
  const url = String(sourceUrl || "").trim();
  if (!url) throw new Error("YouTube playlist URL is required.");

  const result = await resolveSource(url);
  const playlistIdMatch = url.match(/[?&]list=([^&]+)/i);
  const youtubePlaylistId = playlistIdMatch ? playlistIdMatch[1] : null;

  const { data, error } = await client
    .from("music_playlists")
    .upsert({
      owner_id: owner,
      name: playlistName,
      source_url: url,
      youtube_playlist_id: youtubePlaylistId,
      track_count: result.tracks.length,
      updated_at: new Date().toISOString(),
    }, { onConflict: "owner_id,name" })
    .select()
    .single();
  if (error) throw error;

  await replaceTracks(client, data.id, result.tracks);
  return { ...data, track_count: result.tracks.length, playlistName: result.playlistName };
}

async function get(user, name) {
  const client = requireClient();
  const owner = ownerId(user);
  const playlistName = normalizeName(name);
  const { data, error } = await client
    .from("music_playlists")
    .select("*")
    .eq("owner_id", owner)
    .eq("name", playlistName)
    .single();
  if (error) {
    if (error.code === "PGRST116") throw new Error(`Playlist **${playlistName}** was not found.`);
    throw error;
  }
  return data;
}

async function list(user) {
  const client = requireClient();
  const owner = ownerId(user);
  const { data, error } = await client
    .from("music_playlists")
    .select("id,name,source_url,youtube_playlist_id,track_count,created_at,updated_at")
    .eq("owner_id", owner)
    .order("name", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getTracks(user, name) {
  const playlist = await get(user, name);
  const client = requireClient();
  const { data, error } = await client
    .from("music_playlist_tracks")
    .select("position,youtube_video_id,title,url,duration_seconds")
    .eq("playlist_id", playlist.id)
    .order("position", { ascending: true });
  if (error) throw error;
  return { playlist, tracks: data || [] };
}

async function remove(user, name) {
  const client = requireClient();
  const playlist = await get(user, name);
  const { error } = await client.from("music_playlists").delete().eq("id", playlist.id);
  if (error) throw error;
  return playlist;
}

async function refresh(user, name) {
  const playlist = await get(user, name);
  const result = await resolveSource(playlist.source_url);
  const client = requireClient();
  await replaceTracks(client, playlist.id, result.tracks);
  const { data, error } = await client
    .from("music_playlists")
    .update({
      track_count: result.tracks.length,
      updated_at: new Date().toISOString(),
    })
    .eq("id", playlist.id)
    .select()
    .single();
  if (error) throw error;
  return { ...data, playlistName: result.playlistName };
}

module.exports = { save, get, list, getTracks, remove, refresh };
