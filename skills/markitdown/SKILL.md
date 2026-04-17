---
name: markitdown
description: Convert files and office documents to Markdown. Supports PDF, DOCX, PPTX, XLSX, images (with OCR), audio (with transcription), HTML, CSV, JSON, XML, ZIP, YouTube URLs, EPubs and more.
allowed-tools: Read Write Edit Bash
license: MIT license
metadata:
    skill-author: K-Dense Inc.
---

# MarkItDown — File to Markdown Conversion

## Overview

MarkItDown is a Python tool by Microsoft for converting various file formats to Markdown — useful for creating LLM-friendly text from documents. Markdown is token-efficient and well-understood by language models.

**Key capabilities**: 15+ file formats, optional AI-enhanced image descriptions (via LLM), OCR for scanned documents, audio transcription.

## Supported Formats

| Format | Description | Notes |
|--------|-------------|-------|
| **PDF** | Portable Document Format | Full text extraction |
| **DOCX** | Microsoft Word | Tables, formatting preserved |
| **PPTX** | PowerPoint | Slides with notes |
| **XLSX** | Excel spreadsheets | Tables and data |
| **Images** | JPEG, PNG, GIF, WebP | EXIF metadata + OCR |
| **Audio** | WAV, MP3 | Metadata + transcription |
| **HTML** | Web pages | Clean conversion |
| **CSV/JSON/XML** | Structured data | Table/structured format |
| **ZIP** | Archives | Iterates contents |
| **EPUB** | E-books | Full text extraction |
| **YouTube** | Video URLs | Fetch transcriptions |

## Quick Start

### Installation

```bash
pip install 'markitdown[all]'
```

### Command-Line Usage

```bash
markitdown document.pdf > output.md
markitdown document.pdf -o output.md
cat document.pdf | markitdown > output.md
markitdown --use-plugins document.pdf -o output.md
```

### Python API

```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("document.pdf")
print(result.text_content)

# Convert from stream
with open("document.pdf", "rb") as f:
    result = md.convert_stream(f, file_extension=".pdf")
    print(result.text_content)
```

## Advanced Features

### AI-Enhanced Image Descriptions

For PPTX and image files, use LLMs via OpenRouter:

```python
from markitdown import MarkItDown
from openai import OpenAI

client = OpenAI(api_key="your-openrouter-api-key", base_url="https://openrouter.ai/api/v1")
md = MarkItDown(
    llm_client=client,
    llm_model="anthropic/claude-opus-4.5",
    llm_prompt="Describe this image in detail for scientific documentation"
)
result = md.convert("presentation.pptx")
```

### Azure Document Intelligence

For enhanced PDF conversion with complex layouts:

```bash
markitdown document.pdf -o output.md -d -e "<document_intelligence_endpoint>"
```

```python
md = MarkItDown(docintel_endpoint="<document_intelligence_endpoint>")
```

### Plugin System

```bash
markitdown --list-plugins
markitdown --use-plugins file.pdf -o output.md
```

## Optional Dependencies

```bash
pip install 'markitdown[pdf,docx,pptx]'   # Specific formats
pip install 'markitdown[all]'               # All optional dependencies
# [xlsx] [xls] [outlook] [az-doc-intel] [audio-transcription] [youtube-transcription]
```

## Best Practices

1. **Choose method by content type**: simple docs → basic `MarkItDown()`; complex PDFs → Azure Document Intelligence; visual PPTX → AI image descriptions; scanned docs → install tesseract for OCR
2. **Binary mode for streams**: always `open("file.pdf", "rb")` when using `convert_stream()`
3. **Token efficiency**: output is already Markdown; clean extra whitespace with `re.sub(r'\n{3,}', '\n\n', result.text_content)`

For complete code examples (batch processing, scientific literature workflows, AI-enhanced PPTX, data extraction), see [references/usage_examples.md](references/usage_examples.md).

## Docker Usage

```bash
docker build -t markitdown:latest .
docker run --rm -i markitdown:latest < ~/document.pdf > output.md
```

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Missing dependencies | `pip install 'markitdown[pdf]'` for specific format support |
| Binary file errors | Open in binary mode: `open("file.pdf", "rb")` |
| OCR not working | `sudo apt-get install tesseract-ocr` |

## Performance Considerations

- Large PDFs may be slow; AI image descriptions require API calls (cost applies)
- Audio transcription and image OCR are CPU-intensive

## Resources

- **MarkItDown GitHub**: https://github.com/microsoft/markitdown
- **PyPI**: https://pypi.org/project/markitdown/
- **OpenRouter**: https://openrouter.ai (for AI-enhanced conversions)
- **Complete API docs**: [references/api_reference.md](references/api_reference.md)
- **Format-specific details**: [references/file_formats.md](references/file_formats.md)
- **Usage examples**: [references/usage_examples.md](references/usage_examples.md)
