# MarkItDown Usage Examples

## 1. Convert Scientific Papers to Markdown

```python
from markitdown import MarkItDown

md = MarkItDown()

# Convert a single PDF
result = md.convert("research_paper.pdf")
with open("paper.md", "w") as f:
    f.write(result.text_content)
```

## 2. Extract Data from Excel for Analysis

```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("data.xlsx")
# Result is in Markdown table format — ready for LLM processing
print(result.text_content)
```

## 3. Process Multiple Documents (Batch)

```python
from markitdown import MarkItDown
from pathlib import Path

md = MarkItDown()

pdf_dir = Path("papers/")
output_dir = Path("markdown_output/")
output_dir.mkdir(exist_ok=True)

for pdf_file in pdf_dir.glob("*.pdf"):
    result = md.convert(str(pdf_file))
    output_file = output_dir / f"{pdf_file.stem}.md"
    output_file.write_text(result.text_content)
    print(f"Converted: {pdf_file.name}")
```

## 4. Convert PowerPoint with AI-Enhanced Slide Descriptions

```python
from markitdown import MarkItDown
from openai import OpenAI

# Use OpenRouter for access to multiple AI models
client = OpenAI(
    api_key="your-openrouter-api-key",
    base_url="https://openrouter.ai/api/v1"
)

md = MarkItDown(
    llm_client=client,
    llm_model="anthropic/claude-opus-4.5",
    llm_prompt="Describe this slide image in detail, focusing on key visual elements and data"
)

result = md.convert("presentation.pptx")
with open("presentation.md", "w") as f:
    f.write(result.text_content)
```

## 5. Batch Convert Mixed Formats

```python
from markitdown import MarkItDown
from pathlib import Path

md = MarkItDown()

files = [
    "document.pdf",
    "spreadsheet.xlsx",
    "presentation.pptx",
    "notes.docx"
]

for file in files:
    try:
        result = md.convert(file)
        output = Path(file).stem + ".md"
        with open(output, "w") as f:
            f.write(result.text_content)
        print(f"✓ Converted {file}")
    except Exception as e:
        print(f"✗ Error converting {file}: {e}")
```

## 6. Extract YouTube Video Transcription

```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("https://www.youtube.com/watch?v=VIDEO_ID")
print(result.text_content)
```

## 7. Integration with Scientific Workflows

### Convert Literature for Review

```python
from markitdown import MarkItDown
from pathlib import Path

md = MarkItDown()

papers_dir = Path("literature/pdfs")
output_dir = Path("literature/markdown")
output_dir.mkdir(exist_ok=True)

for paper in papers_dir.glob("*.pdf"):
    result = md.convert(str(paper))
    output_file = output_dir / f"{paper.stem}.md"
    # Add metadata header
    content = f"# {paper.stem}\n\n**Source**: {paper.name}\n\n---\n\n"
    content += result.text_content
    output_file.write_text(content)

# AI-enhanced version with OpenRouter
from openai import OpenAI
client = OpenAI(api_key="your-openrouter-api-key", base_url="https://openrouter.ai/api/v1")
md_ai = MarkItDown(
    llm_client=client,
    llm_model="anthropic/claude-opus-4.5",
    llm_prompt="Describe scientific figures with technical precision"
)
```

### Extract Tables for Analysis

```python
from markitdown import MarkItDown

md = MarkItDown()
result = md.convert("data_tables.xlsx")
# Markdown tables can be directly used or parsed further
print(result.text_content)
```

## 8. Process Large Files Efficiently

```python
from markitdown import MarkItDown

md = MarkItDown()

# Use streaming for large files to avoid loading entire file into memory
with open("large_file.pdf", "rb") as f:
    result = md.convert_stream(f, file_extension=".pdf")
    with open("output.md", "w") as out:
        out.write(result.text_content)
```

## 9. Clean Up Extra Whitespace

```python
from markitdown import MarkItDown
import re

md = MarkItDown()
result = md.convert("document.pdf")

# Remove excessive blank lines
clean_text = re.sub(r'\n{3,}', '\n\n', result.text_content)
clean_text = clean_text.strip()
print(clean_text)
```
