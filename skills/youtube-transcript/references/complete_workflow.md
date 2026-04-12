# YouTube Transcript — Complete Workflow Script

A complete bash script that handles all scenarios with proper error checking and user confirmation at decision points.

```bash
VIDEO_URL="https://www.youtube.com/watch?v=VIDEO_ID"

# Get video title for filename
VIDEO_TITLE=$(yt-dlp --print "%(title)s" "$VIDEO_URL" | tr '/' '_' | tr ':' '-' | tr '?' '' | tr '"' '')
OUTPUT_NAME="transcript_temp"

# ============================================
# STEP 1: Check if yt-dlp is installed
# ============================================
if ! command -v yt-dlp &> /dev/null; then
    echo "yt-dlp not found, attempting to install..."
    if command -v brew &> /dev/null; then
        brew install yt-dlp
    elif command -v apt &> /dev/null; then
        sudo apt update && sudo apt install -y yt-dlp
    else
        pip3 install yt-dlp
    fi
fi

# ============================================
# STEP 2: List available subtitles
# ============================================
echo "Checking available subtitles..."
yt-dlp --list-subs "$VIDEO_URL"

# ============================================
# STEP 3: Try manual subtitles first
# ============================================
echo "Attempting to download manual subtitles..."
if yt-dlp --write-sub --skip-download --output "$OUTPUT_NAME" "$VIDEO_URL" 2>/dev/null; then
    echo "✓ Manual subtitles downloaded successfully!"
    ls -lh ${OUTPUT_NAME}.*
else
    # ============================================
    # STEP 4: Fallback to auto-generated
    # ============================================
    echo "Manual subtitles not available. Trying auto-generated..."
    if yt-dlp --write-auto-sub --skip-download --output "$OUTPUT_NAME" "$VIDEO_URL" 2>/dev/null; then
        echo "✓ Auto-generated subtitles downloaded successfully!"
        ls -lh ${OUTPUT_NAME}.*
    else
        # ============================================
        # STEP 5: Last resort - Whisper transcription
        # ============================================
        echo "⚠ No subtitles available for this video."

        # Get file size and duration info
        FILE_SIZE=$(yt-dlp --print "%(filesize_approx)s" -f "bestaudio" "$VIDEO_URL")
        DURATION=$(yt-dlp --print "%(duration)s" "$VIDEO_URL")
        TITLE=$(yt-dlp --print "%(title)s" "$VIDEO_URL")

        echo "Video: $TITLE"
        echo "Duration: $((DURATION / 60)) minutes"
        echo "Audio size: ~$((FILE_SIZE / 1024 / 1024)) MB"
        echo ""
        echo "Would you like to download and transcribe with Whisper? (y/n)"
        read -r RESPONSE

        if [[ "$RESPONSE" =~ ^[Yy]$ ]]; then
            # Check for Whisper
            if ! command -v whisper &> /dev/null; then
                echo "Whisper not installed. Install now? (requires ~1-3GB) (y/n)"
                read -r INSTALL_RESPONSE
                if [[ "$INSTALL_RESPONSE" =~ ^[Yy]$ ]]; then
                    pip3 install openai-whisper
                else
                    echo "Cannot proceed without Whisper. Exiting."
                    exit 1
                fi
            fi

            # Download audio
            echo "Downloading audio..."
            yt-dlp -x --audio-format mp3 --output "audio_%(id)s.%(ext)s" "$VIDEO_URL"

            # Get the actual audio filename
            AUDIO_FILE=$(ls audio_*.mp3 | head -n 1)

            # Transcribe
            echo "Transcribing with Whisper (this may take a few minutes)..."
            whisper "$AUDIO_FILE" --model base --output_format vtt

            # Cleanup
            echo "Transcription complete! Delete audio file? (y/n)"
            read -r CLEANUP_RESPONSE
            if [[ "$CLEANUP_RESPONSE" =~ ^[Yy]$ ]]; then
                rm "$AUDIO_FILE"
                echo "Audio file deleted."
            fi

            ls -lh *.vtt
        else
            echo "Transcription cancelled."
            exit 0
        fi
    fi
fi

# ============================================
# STEP 6: Convert to readable plain text with deduplication
# ============================================
VTT_FILE=$(ls ${OUTPUT_NAME}*.vtt 2>/dev/null || ls *.vtt | head -n 1)
if [ -f "$VTT_FILE" ]; then
    echo "Converting to readable format and removing duplicates..."
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

    # Clean up temporary VTT file
    rm "$VTT_FILE"
    echo "✓ Cleaned up temporary VTT file"
else
    echo "⚠ No VTT file found to convert"
fi

echo "✓ Complete!"
```
