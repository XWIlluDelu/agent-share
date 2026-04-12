# YouTube Transcript — Detailed Commands

## Step 1: Installation Check

```bash
which yt-dlp || command -v yt-dlp
```

### If Not Installed

**macOS (Homebrew):**
```bash
brew install yt-dlp
```

**Linux (apt/Debian/Ubuntu):**
```bash
sudo apt update && sudo apt install -y yt-dlp
```

**Universal (pip):**
```bash
pip3 install yt-dlp
# or
python3 -m pip install yt-dlp
```

If installation fails, direct user to: https://github.com/yt-dlp/yt-dlp#installation

## Step 2: Check Available Subtitles

**Always do this first** before attempting any download:

```bash
yt-dlp --list-subs "YOUTUBE_URL"
```

Look for:
- Manual subtitles (better quality, human-created)
- Auto-generated subtitles (usually available for English)
- Available languages

## Step 3: Download Strategy

### Option 1: Manual Subtitles (Preferred)

```bash
yt-dlp --write-sub --skip-download --output "OUTPUT_NAME" "YOUTUBE_URL"
```

### Option 2: Auto-Generated Subtitles (Fallback)

```bash
yt-dlp --write-auto-sub --skip-download --output "OUTPUT_NAME" "YOUTUBE_URL"
```

Both options create a `.vtt` file (WebVTT subtitle format).

### Option 3: Whisper Transcription (Last Resort Only)

**ONLY use if both Option 1 and 2 fail.** Must get user confirmation first.

**Show file info and ask for confirmation:**
```bash
# Get audio size estimate
yt-dlp --print "%(filesize,filesize_approx)s" -f "bestaudio" "YOUTUBE_URL"

# Get duration
yt-dlp --print "%(duration)s %(title)s" "YOUTUBE_URL"
```

Display to user: "No subtitles are available. I can download the audio (approximately X MB, Y minutes) and transcribe it using Whisper. This requires ~1-3GB disk for the model. Would you like to proceed?"

**Check Whisper:**
```bash
command -v whisper
```

**Install if confirmed:**
```bash
pip3 install openai-whisper
```

**Download audio only:**
```bash
yt-dlp -x --audio-format mp3 --output "audio_%(id)s.%(ext)s" "YOUTUBE_URL"
```

**Transcribe:**
```bash
# Auto-detect language (recommended)
whisper audio_VIDEO_ID.mp3 --model base --output_format vtt

# Or specify language
whisper audio_VIDEO_ID.mp3 --model base --language en --output_format vtt
```

**Model options** (use `base` by default):
- `tiny` — fastest, least accurate
- `base` — good balance (~1GB) ← **use this**
- `small` — better accuracy (~2GB)
- `medium` — very good (~5GB)
- `large` — best accuracy (~10GB)

After transcription, ask user: "Delete the audio file to save space?"

## Step 4: Post-Processing — Convert to Plain Text

YouTube's VTT files have **duplicate lines** (captions shown progressively). Always deduplicate:

```bash
python3 -c "
import sys, re
seen = set()
with open('transcript.en.vtt', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('WEBVTT') and not line.startswith('Kind:') and not line.startswith('Language:') and '-->' not in line:
            clean = re.sub('<[^>]*>', '', line)
            clean = clean.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<')
            if clean and clean not in seen:
                print(clean)
                seen.add(clean)
" > transcript.txt
```

### Complete Post-Processing with Video Title

```bash
# Get video title for filename
VIDEO_TITLE=$(yt-dlp --print "%(title)s" "YOUTUBE_URL" | tr '/' '_' | tr ':' '-' | tr '?' '' | tr '"' '')

# Find the VTT file
VTT_FILE=$(ls *.vtt | head -n 1)

# Convert with deduplication
python3 -c "
import sys, re
seen = set()
with open('$VTT_FILE', 'r') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('WEBVTT') and not line.startswith('Kind:') and not line.startswith('Language:') and '-->' not in line:
            clean = re.sub('<[^>]*>', '', line)
            clean = clean.replace('&amp;', '&').replace('&gt;', '>').replace('&lt;', '<')
            if clean and clean not in seen:
                print(clean)
                seen.add(clean)
" > "${VIDEO_TITLE}.txt"

echo "✓ Saved to: ${VIDEO_TITLE}.txt"
rm "$VTT_FILE"
echo "✓ Cleaned up VTT file"
```

## Output Formats

- **VTT** (`.vtt`): Includes timestamps, good for video players
- **Plain text** (`.txt`): Just text content, good for reading or LLM analysis

## Useful Tips

- Filename pattern: `{output_name}.{language_code}.vtt` (e.g., `transcript.en.vtt`)
- Most videos have auto-generated English subtitles
- Specify language with `--sub-langs en` for English only
- If auto-subtitles unavailable, swap to `--write-sub` for manual
