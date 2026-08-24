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

## What was fixed

The music system went through multiple connection/no-audio failures. The decisive fix was identifying that YouTube extraction was failing because yt-dlp was not solving the current JavaScript challenges.

Adding Node.js EJS challenge solving and authenticated YouTube cookies produced a successful playable format selection. The same configuration was then deployed to Render.

## Next-chat continuation

Use this checkpoint as the source of truth for Nexus Music. Continue from commit `8525ab5` and preserve the direct yt-dlp + Node EJS + cookies + FFmpeg + Discord Voice architecture.
