# Nexus Music — Working Checkpoint

**Date:** 2026-08-24  
**Status:** ✅ WORKING END-TO-END

## Production status

- Render service: `utopia-nexus`
- Render service status: **LIVE**
- Working commit: `8525ab5a75945fbdc8239be88c14677186c279bf`
- Commit message: `fix: enable yt-dlp EJS and private cookie auth`
- Branch: `main`
- Region: Ohio

## Working music pipeline

```text
YouTube
  ↓
yt-dlp 2026.08.19
  ↓
Node.js EJS challenge solving
  ↓
Private YouTube cookies
  ↓
FFmpeg
  ↓
Discord Voice / Opus
  ↓
🔊 Audio
```

## Critical yt-dlp configuration

The working extraction configuration requires:

- `--js-runtimes node`
- `--remote-components ejs:github`
- `--cookies cookies.txt` (or the equivalent private cookie file)

The local verification succeeded with:

```text
[jsc:node] Solving JS challenges using node
[info] dQw4w9WgXcQ: Downloading 1 format(s): 401+251
```

This proved that the YouTube extraction/challenge-solving problem was resolved.

## How we solved the no-sound problem

The final solution came from troubleshooting the entire playback chain instead of continuing to swap music backends.

### 1. Established that Discord voice was connecting

The bot could connect to the voice channel, but there was no audio. This ruled out a simple Discord connection problem.

### 2. Moved to the direct yt-dlp playback path

Instead of depending on Lavalink for the final playback path, Nexus was configured to use:

```text
yt-dlp → FFmpeg → @discordjs/voice → Discord
```

This gave us direct control over YouTube extraction and Discord audio transport.

### 3. Fixed the Opus dependency

The direct Discord voice implementation initially failed on Render because `@discordjs/voice` could not find an Opus implementation (`@discordjs/opus`, `node-opus`, or `opusscript`). Opus support was added so the direct voice pipeline could actually encode/send Discord audio.

### 4. Tested yt-dlp locally on Android/Termux

We created a private Firefox YouTube cookie export and saved it locally as `cookies.txt`. The file was approximately 17 KB (16,588 bytes) and protected with:

```bash
chmod 600 cookies.txt
```

The first yt-dlp test showed:

```text
Signature solving failed
n challenge solving failed
The page needs to be reloaded.
```

This was the key diagnostic result: **the cookies were not the primary failure; yt-dlp was missing an active JavaScript challenge solver/runtime.**

### 5. Installed Node.js and explicitly enabled it for yt-dlp

Node.js was available in Termux (`v26.4.0`), but yt-dlp was not automatically using it. The decisive test was:

```bash
yt-dlp --js-runtimes node --remote-components ejs:github --cookies cookies.txt --simulate --skip-download "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
```

That changed the result to:

```text
[jsc:node] Solving JS challenges using node
[info] dQw4w9WgXcQ: Downloading 1 format(s): 401+251
```

That proved YouTube extraction was working and playable formats were being resolved.

### 6. Deployed the exact working configuration to Render

Commit `8525ab5` enabled the yt-dlp EJS runtime configuration and private cookie authentication in Nexus.

The YouTube cookies were converted to base64 locally and supplied to Render through the private environment variable:

```text
YTDLP_COOKIES_B64
```

The actual cookie contents were never committed to GitHub.

### 7. Verified the production deployment

Render reported the deployment for commit `8525ab5` as **LIVE**. The user then tested Nexus music in Discord and confirmed:

> "It's working perfectly"

Therefore the final fix was not a Lavalink change. The decisive issue was **YouTube's current JavaScript challenge solving**, combined with the need for an authenticated cookie session, followed by the direct Discord Voice/FFmpeg path.

## Cookie handling

- Firefox was used to export the YouTube cookies.
- Local `cookies.txt` was approximately 17 KB (16,588 bytes).
- The local file was protected with `chmod 600`.
- **Never commit `cookies.txt` to GitHub.**
- The deployment uses the Render environment variable:

```text
YTDLP_COOKIES_B64
```

The cookie value must remain private and must never be pasted into chat, source code, logs, issues, or commits.

## Discord voice

The direct Discord voice implementation is the active playback path.

- Direct yt-dlp → FFmpeg → Discord Voice is working.
- Opus support was added in the deployment before the final working build.
- Lavalink remains deployed on Render but is **not the active playback path** for this working configuration.

## Important baseline rule

**DO NOT replace or redesign the working music backend unless there is a demonstrated failure.**

The current configuration has been tested by the user and confirmed:

> "It's working perfectly"

## Next-chat continuation

Use this checkpoint as the source of truth for Nexus Music. Continue from commit `8525ab5` and preserve the direct yt-dlp + Node EJS + cookies + FFmpeg + Discord Voice architecture.
