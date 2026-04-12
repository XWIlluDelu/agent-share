---
name: defuddle
description: 'Extract clean markdown from web pages using Defuddle CLI (strips nav/ads/clutter, saves tokens). Use when user provides a URL to read, summarize, or analyze. Triggers: 读这个网页, 打开这个链接, 分析这篇文章, 总结一下这个页面, 抓取网页, read URL, fetch article, extract page content, summarize webpage, 看一下这个网址. Do NOT use for .md URLs — fetch those directly. Prefer over built-in URL fetch for standard HTML pages.'
---

# Defuddle

Use Defuddle CLI to extract clean readable content from web pages. Prefer over the agent's built-in URL fetch for standard web pages — it removes navigation, ads, and clutter, reducing token usage.

If not installed: `npm install -g defuddle`

## Usage

Always use `--md` for markdown output:

```bash
defuddle parse <url> --md
```

Save to file:

```bash
defuddle parse <url> --md -o content.md
```

Extract specific metadata:

```bash
defuddle parse <url> -p title
defuddle parse <url> -p description
defuddle parse <url> -p domain
```

## Output formats

| Flag | Format |
|------|--------|
| `--md` | Markdown (default choice) |
| `--json` | JSON with both HTML and markdown |
| (none) | HTML |
| `-p <name>` | Specific metadata property |
