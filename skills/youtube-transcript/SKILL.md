---
name: youtube-transcript
description: Download YouTube video transcripts when user provides a YouTube URL or asks to download/get/fetch a transcript from YouTube. Also use when user wants to transcribe or get captions/subtitles from a YouTube video.
allowed-tools: Bash,Read,Write
---

# YouTube Transcript Downloader

Download transcripts (subtitles/captions) from YouTube videos using yt-dlp.

## When to Use

Activate when the user provides a YouTube URL and wants transcript text, or asks for captions/subtitles/transcription from a YouTube video.

## How It Works — Priority Order

Always follow this order:
1. **Check yt-dlp is installed** — install if needed
2. **List available subtitles** with `--list-subs` — see what's actually available first
3. **Try manual subtitles** (`--write-sub`) — highest quality, human-created
4. **Fall back to auto-generated** (`--write-auto-sub`) — usually available
5. **Last resort: Whisper transcription** — only if no subtitles exist; **always ask user confirmation first** (show file size and duration)
6. **Convert VTT to plain text** with deduplication — YouTube VTT files contain duplicate lines

For detailed commands at each step, see [references/commands.md](references/commands.md).
For a complete end-to-end bash script, see [references/complete_workflow.md](references/complete_workflow.md).
For error handling and troubleshooting, see [references/error_handling.md](references/error_handling.md).

## Quick Commands

**Check what's available:**
```bash
yt-dlp --list-subs "YOUTUBE_URL"
```

**Download manual subtitles (preferred):**
```bash
yt-dlp --write-sub --skip-download --output "OUTPUT_NAME" "YOUTUBE_URL"
```

**Download auto-generated subtitles (fallback):**
```bash
yt-dlp --write-auto-sub --skip-download --output "OUTPUT_NAME" "YOUTUBE_URL"
```

**Convert VTT to plain text (always deduplicate):**
```python
python3 -c "
import sys, re
seen = set()
with open('transcript.en.vtt', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('WEBVTT') and not line.startswith('Kind:') \
           and not line.startswith('Language:') and '-->' not in line:
            clean = re.sub('<[^>]*>', '', line)
            clean = clean.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<')
            if clean and clean not in seen:
                print(clean)
                seen.add(clean)
" > transcript.txt
```

## Key Rules

- **Always list subtitles first** — don't download blindly
- **Always ask user confirmation before Whisper** — show file size + duration estimate
- **Always deduplicate when converting VTT** — YouTube auto-subtitles have overlapping lines
- **Always clean up VTT files** after converting to plain text
- **Use video title as filename**: `yt-dlp --print "%(title)s" "URL"`
