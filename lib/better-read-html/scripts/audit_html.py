#!/usr/bin/env python3
"""Audit a static readable HTML artifact for links, assets, ids, and optional source parity."""

from __future__ import annotations

import argparse
import html.parser
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import unquote, urlparse

VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP_TAGS = {"script", "style"}
REMOTE_ASSET_SCHEMES = {"http", "https", "ftp", "ftps"}
EXECUTABLE_SCHEMES = {"javascript"}
BENIGN_LINK_SCHEMES = {"mailto", "tel"}
TEMPLATE_REPORT_ID = "attention-is-all-you-need"
TEMPLATE_TITLE = "Attention Is All You Need"
REFERENCE_ATTRS = {"data-target", "data-duplicate-of", "aria-controls", "aria-describedby", "aria-labelledby"}


def is_remote(url: str) -> bool:
    return url.startswith("//") or urlparse(url).scheme.lower() in REMOTE_ASSET_SCHEMES


def srcset_urls(value: str) -> list[str]:
    """Extract common srcset candidates without splitting commas inside data URLs."""
    urls: list[str] = []
    i = 0
    while i < len(value):
        while i < len(value) and (value[i].isspace() or value[i] == ","):
            i += 1
        if i >= len(value):
            break
        start = i
        if value[i:].lower().startswith("data:"):
            while i < len(value) and not value[i].isspace():
                i += 1
        else:
            while i < len(value) and not value[i].isspace() and value[i] != ",":
                i += 1
        if i > start:
            urls.append(value[start:i])
        while i < len(value) and value[i] != ",":
            i += 1
    return urls


def local_candidate(html_path: Path, ref: str) -> Path:
    path = unquote(urlparse(ref).path)
    if not path:
        return html_path
    return html_path.parent / path.lstrip("/") if path.startswith("/") else html_path.parent / path


def norm_compare(text: str, *, compatibility: bool = False) -> str:
    text = unicodedata.normalize("NFKC" if compatibility else "NFC", text)
    text = text.replace("\u200b", "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


class AuditParser(html.parser.HTMLParser):
    def __init__(self, source_order: bool = True) -> None:
        super().__init__(convert_charrefs=True)
        self.source_order = source_order
        self.in_main = False
        self.main_seen = False
        self.depth = 0
        self.skip = 0
        self.capture_stack: list[bool] = []
        self.parts: list[str] = []
        self.ids: list[str] = []
        self.hrefs: list[str] = []
        self.attribute_refs: list[str] = []
        self.assets: list[str] = []
        self.remote_dependencies: list[str] = []
        self.external_links: list[str] = []
        self.local_links: list[str] = []
        self.inline_data_assets: list[str] = []
        self.executable_links: list[str] = []
        self.benign_external_links: list[str] = []
        self.navigation_hazards: list[str] = []
        self.base_hrefs: list[str] = []
        self.image_alts: list[tuple[str, str, bool]] = []
        self.html_validity_errors: list[str] = []
        self.title_seen = False
        self.html_lang = ""
        self.figures: list[dict[str, str]] = []
        self.math_elements: list[dict[str, str]] = []
        self.stylesheets: list[str] = []
        self.evidence_notes: list[dict[str, str]] = []
        self.evidence_refs: list[str] = []
        self.annotation_report: str | None = None
        self.canonical_text_stack: list[str | None] = []
        self.wrap_stack: list[bool] = []
        self.table_wrap_depth = 0
        self.tables_outside_wrap = 0

    def record_asset(self, url: str) -> None:
        if not url or url.startswith("#"):
            return
        scheme = urlparse(url).scheme.lower()
        if scheme in EXECUTABLE_SCHEMES:
            self.executable_links.append(url)
        elif is_remote(url):
            self.remote_dependencies.append(url)
        elif scheme == "data":
            if url.lower().startswith("data:image/"):
                self.inline_data_assets.append(url[:48] + "...")
            else:
                self.remote_dependencies.append(url[:48] + "...")
        else:
            self.assets.append(url)

    def record_link(self, url: str) -> None:
        if not url:
            return
        scheme = urlparse(url).scheme.lower()
        if scheme in EXECUTABLE_SCHEMES or scheme == "data":
            self.executable_links.append(url)
        elif scheme in BENIGN_LINK_SCHEMES:
            self.benign_external_links.append(url)
        elif is_remote(url):
            self.external_links.append(url)
        else:
            self.local_links.append(url)

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr_names: set[str] = set()
        duplicate_attr_names: set[str] = set()
        for k, _v in attrs:
            kl = k.lower()
            if kl in attr_names:
                duplicate_attr_names.add(kl)
            attr_names.add(kl)
        if duplicate_attr_names:
            self.html_validity_errors.append(f"<{tag}> duplicate attributes: {', '.join(sorted(duplicate_attr_names))}")
        attrs_d = {k: v or "" for k, v in attrs}
        canonical_text_attr = attrs_d.get("data-canonical-text")
        if tag == "html":
            self.html_lang = attrs_d.get("lang", "")
        if tag == "title":
            self.title_seen = True
        if "id" in attrs_d:
            self.ids.append(attrs_d["id"])
        href = attrs_d.get("href")
        if href and href.startswith("#"):
            self.hrefs.append(href[1:])
        for attr in REFERENCE_ATTRS:
            for ref in attrs_d.get(attr, "").split():
                if ref:
                    self.attribute_refs.append(ref.lstrip("#"))
        for attr in ("data-evidence",):
            for ref in re.split(r"[\s,]+", attrs_d.get(attr, "")):
                if ref:
                    self.attribute_refs.append(ref.lstrip("#"))
        if tag == "img":
            has_alt = any(k == "alt" for k, _ in attrs)
            self.image_alts.append((attrs_d.get("src", ""), attrs_d.get("alt", ""), has_alt))
        class_tokens = attrs_d.get("class", "").split()
        if tag == "figure":
            self.figures.append(attrs_d)
        if "math-display" in class_tokens:
            self.math_elements.append(attrs_d)
        if tag == "aside" and "ev-note" in class_tokens:
            self.evidence_notes.append(attrs_d)
        if tag == "a" and "ev-ref" in class_tokens:
            self.evidence_refs.append(attrs_d.get("href", ""))
        if tag == "meta" and attrs_d.get("name") == "annotation-report":
            self.annotation_report = attrs_d.get("content", "")
        if tag == "link" and "stylesheet" in attrs_d.get("rel", "").lower().split() and href and not is_remote(href):
            self.stylesheets.append(href)

        if href and not href.startswith("#"):
            if tag == "base":
                self.base_hrefs.append(href)
                self.navigation_hazards.append(f"base href changes URL resolution: {href}")
                if is_remote(href):
                    self.remote_dependencies.append(href)
            elif tag in {"a", "area"}:
                self.record_link(href)
            elif tag in {"link", "script", "image"}:
                self.record_asset(href)

        self.record_asset(attrs_d.get("src", ""))
        self.record_asset(attrs_d.get("poster", ""))
        if tag == "object":
            self.record_asset(attrs_d.get("data", ""))
        for candidate in srcset_urls(attrs_d.get("srcset", "")):
            self.record_asset(candidate)

        if tag == "meta" and attrs_d.get("http-equiv", "").lower() == "refresh":
            content = attrs_d.get("content", "")
            match = re.search(r"(?:^|;)\s*url\s*=\s*['\"]?([^'\";]+)", content, re.I)
            target = match.group(1).strip() if match else content.strip()
            self.navigation_hazards.append(f"meta refresh: {target or 'unspecified target'}")
            if target:
                self.record_link(target)
        if tag == "main":
            self.in_main = True
            self.main_seen = True
            self.depth = 1
            return
        if self.main_seen and not self.in_main:
            return
        if tag in VOID_TAGS:
            if self.in_main and not self.skip and tag == "br":
                self.parts.append("\n")
            return
        if not self.in_main:
            return
        self.depth += 1
        canonical = attrs_d.get("data-canonical")
        duplicate = attrs_d.get("data-layout-duplicate") == "true"
        skipped_here = False
        if tag in SKIP_TAGS or (self.source_order and duplicate) or (self.source_order and canonical == "false"):
            self.skip += 1
            skipped_here = True
        self.capture_stack.append(not skipped_here)
        self.canonical_text_stack.append(canonical_text_attr if not skipped_here and not self.skip and canonical_text_attr else None)
        wraps_table = "table-responsive" in class_tokens
        if wraps_table:
            self.table_wrap_depth += 1
        self.wrap_stack.append(wraps_table)
        if tag == "table" and not self.table_wrap_depth:
            self.tables_outside_wrap += 1
        if canonical_text_attr and not skipped_here and not self.skip:
            self.parts.append(canonical_text_attr)
            self.skip += 1
            return
        if skipped_here or self.skip:
            return
        if tag in {"p", "h1", "h2", "h3", "h4", "figcaption", "tr", "li", "div", "section", "figure", "header", "article"}:
            self.parts.append("\n")
        elif tag in {"td", "th"}:
            self.parts.append("\t")

    def handle_endtag(self, tag: str) -> None:
        # Void tags never push onto the stacks in handle_starttag, but a
        # self-closed form (<br/>) still reaches here via handle_startendtag;
        # popping would desynchronize skip accounting.
        if tag in VOID_TAGS:
            return
        if not self.in_main:
            return
        captured = self.capture_stack.pop() if self.capture_stack else True
        canonical_text_attr = self.canonical_text_stack.pop() if self.canonical_text_stack else None
        if self.wrap_stack and self.wrap_stack.pop():
            self.table_wrap_depth -= 1
        if self.skip and canonical_text_attr is not None:
            self.skip -= 1
            captured = False
        elif self.skip and not captured:
            self.skip -= 1
        elif not self.skip and tag in {"p", "h1", "h2", "h3", "h4", "figcaption", "tr", "li", "div", "section", "figure", "header", "article"}:
            self.parts.append("\n")
        self.depth -= 1
        if tag == "main" and self.depth <= 0:
            self.in_main = False

    def handle_data(self, data: str) -> None:
        if self.in_main and not self.skip:
            self.parts.append(data)


def duplicate_ids(ids: list[str]) -> list[str]:
    seen: set[str] = set()
    dup: set[str] = set()
    for value in ids:
        if value in seen:
            dup.add(value)
        seen.add(value)
    return sorted(dup)


def first_mismatch(a: str, b: str) -> dict[str, object]:
    limit = min(len(a), len(b))
    idx = next((i for i in range(limit) if a[i] != b[i]), limit)
    return {
        "index": idx,
        "source_context": a[max(0, idx - 120): idx + 120],
        "html_context": b[max(0, idx - 120): idx + 120],
    }


def reference_tokens(tag_text: str) -> list[str]:
    tokens: list[str] = []
    for attr in ("data-target", "data-evidence"):
        for match in re.finditer(rf'''\b{attr}\s*=\s*(["'])(.*?)\1''', tag_text, re.I | re.S):
            tokens.extend(ref.lstrip("#") for ref in re.split(r"[\s,]+", match.group(2).strip()) if ref)
    return tokens


def has_reference_attr(tag_text: str) -> bool:
    return bool(re.search(r'''\b(?:data-target|data-evidence)\s*=''', tag_text, re.I))


def inline_css(html_text: str) -> list[str]:
    css_parts = re.findall(r"<style\b[^>]*>(.*?)</style>", html_text, re.I | re.S)
    css_parts.extend(match.group(2) for match in re.finditer(r'''\bstyle\s*=\s*(["'])(.*?)\1''', html_text, re.I | re.S))
    return css_parts


def css_dependencies(css_parts: list[str]) -> tuple[list[str], list[str], list[str]]:
    remote: list[str] = []
    local: list[str] = []
    inline: list[str] = []

    def classify(url: str, *, allow_inline_image: bool = False) -> None:
        url = url.strip()
        if not url or url.startswith("#"):
            return
        scheme = urlparse(url).scheme.lower()
        if is_remote(url):
            remote.append(url)
        elif scheme == "data" and allow_inline_image and url.lower().startswith("data:image/"):
            inline.append(url[:48] + "...")
        elif scheme == "data":
            remote.append(url[:48] + "...")
        else:
            local.append(url)

    for css in css_parts:
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        for match in re.finditer(r'''@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1''', css, re.I):
            classify(match.group(2))
        for match in re.finditer(r'''url\(\s*(["']?)(.*?)\1\s*\)''', css, re.I | re.S):
            classify(match.group(2), allow_inline_image=True)
    return remote, local, inline


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("html", type=Path, help="HTML file to audit")
    ap.add_argument("--assets-dir", type=Path, help="Directory containing local assets. Defaults to HTML sibling assets/ if present.")
    ap.add_argument("--source-text", type=Path, help="Optional canonical source text to compare against canonical HTML text")
    ap.add_argument("--strict", action="store_true", help="Exit nonzero for duplicate ids, broken links, unresolved refs, missing assets, missing main, remote dependencies, executable links, or source mismatch")
    ap.add_argument("--allow-remote", action="store_true", help="Do not fail strict mode for remote network/data dependencies")
    ap.add_argument("--allow-no-main", action="store_true", help="Do not fail strict mode when no <main> element is present")
    ap.add_argument("--allow-empty-canonical", action="store_true", help="Do not fail strict mode when canonical text is empty")
    ap.add_argument("--require-source-text", action="store_true", help="Fail strict mode unless --source-text is supplied")
    ap.add_argument("--profile", choices=["generic", "preserve", "scholarly"], default="generic", help="Enable lightweight profile-specific contract checks")
    args = ap.parse_args()

    html_path = args.html
    html_text = html_path.read_text(encoding="utf-8")
    parser = AuditParser(source_order=True)
    parser.feed(html_text)
    css_remote, css_local, css_inline = css_dependencies(inline_css(html_text))
    parser.remote_dependencies.extend(css_remote)
    parser.assets.extend(css_local)
    parser.inline_data_assets.extend(css_inline)
    # Linked local stylesheets count as page CSS; their url() references resolve against the stylesheet.
    linked_css: list[str] = []
    missing_css_assets: list[str] = []
    for href in sorted(set(parser.stylesheets)):
        css_path = local_candidate(html_path, href)
        if not css_path.is_file():
            continue
        css_text = css_path.read_text(encoding="utf-8", errors="replace")
        linked_css.append(css_text)
        remote, local, inline = css_dependencies([css_text])
        parser.remote_dependencies.extend(remote)
        parser.inline_data_assets.extend(inline)
        for ref in local:
            if not local_candidate(css_path, ref).exists():
                missing_css_assets.append(f"{href}: {ref}")
    style_text = html_text + "\n".join(linked_css)

    ids = set(parser.ids)
    broken_internal_links = sorted({href for href in parser.hrefs if href not in ids})
    unresolved_attribute_refs = sorted({ref for ref in parser.attribute_refs if ref not in ids})
    dups = duplicate_ids(parser.ids)
    assets_dir = args.assets_dir or (html_path.parent / "assets")
    missing_assets: list[str] = []
    asset_refs = sorted(set(parser.assets))
    missing_assets.extend(missing_css_assets)
    for ref in asset_refs:
        candidate = local_candidate(html_path, ref)
        if not candidate.exists() and assets_dir.exists():
            candidate = assets_dir / Path(unquote(urlparse(ref).path)).name
        if not candidate.exists():
            missing_assets.append(ref)

    local_links = sorted(set(parser.local_links))
    missing_local_links = [ref for ref in local_links if not local_candidate(html_path, ref).exists()]

    html_canonical_text = norm_compare("".join(parser.parts))
    html_canonical_text_nfkc = norm_compare("".join(parser.parts), compatibility=True)
    source_match = None
    compatibility_source_match = None
    mismatch = None
    if args.source_text:
        source_raw = args.source_text.read_text(encoding="utf-8")
        source_norm = norm_compare(source_raw)
        source_norm_nfkc = norm_compare(source_raw, compatibility=True)
        source_match = source_norm == html_canonical_text
        compatibility_source_match = source_norm_nfkc == html_canonical_text_nfkc
        if not source_match:
            mismatch = first_mismatch(source_norm, html_canonical_text)

    accessibility_warnings: list[str] = []
    if not parser.html_lang:
        accessibility_warnings.append("missing html lang")
    if not parser.title_seen:
        accessibility_warnings.append("missing title")
    missing_alt = [src for src, _alt, has_alt in parser.image_alts if not has_alt]
    if missing_alt:
        accessibility_warnings.append(f"images missing alt attribute: {len(missing_alt)}")

    readability_warnings: list[str] = []
    design_warnings: list[str] = []
    converter_residue_warnings: list[str] = []
    source_boundary_errors: list[str] = []
    html_without_css = re.sub(r"<style\b[^>]*>.*?</style>", "", html_text, flags=re.I | re.S)
    html_without_css = re.sub(r"<script\b[^>]*>.*?</script>", "", html_without_css, flags=re.I | re.S)

    if '<meta name="viewport"' not in html_text.lower():
        readability_warnings.append("missing viewport meta")
    if parser.hrefs and ":focus-visible" not in style_text:
        readability_warnings.append("navigation present but no visible :focus-visible style found")
    if parser.hrefs and ":target" not in style_text:
        readability_warnings.append("internal links present but no :target style found")
    if "<table" in html_text.lower() and not re.search(r"overflow-x\s*:\s*auto", style_text, re.I):
        readability_warnings.append("tables present but no horizontal overflow handling found")
    elif parser.tables_outside_wrap and "table-responsive" in style_text:
        readability_warnings.append(f"tables not inside a .table-responsive overflow wrapper: {parser.tables_outside_wrap}")
    if "@media print" not in style_text:
        readability_warnings.append("missing print stylesheet")

    main_open = re.search(r"<main\b[^>]*>(?P<body>.*?)</main>", html_without_css, re.I | re.S)
    if main_open:
        main_inner = main_open.group("body")
        lead = re.search(r"\S", main_inner)
        if lead:
            lead_fragment = main_inner[lead.start(): lead.start() + 1200]
            header_match = re.match(
                r"<header\b[^>]*data-canonical=[\"']false[\"'][^>]*>(?P<hbody>.*?)</header>",
                lead_fragment, re.I | re.S,
            )
            if header_match:
                rest = lead_fragment[header_match.end():]
                title_in_header = re.search(r"<h1\b[^>]*>(.*?)</h1>", header_match.group("hbody"), re.I | re.S)
                title_after_header = re.search(r"<h1\b[^>]*>(.*?)</h1>", rest, re.I | re.S)
                if title_in_header and title_after_header:
                    a = norm_compare(re.sub(r"<[^>]+>", "", title_in_header.group(1)))
                    b = norm_compare(re.sub(r"<[^>]+>", "", title_after_header.group(1)))
                    if a and a == b:
                        design_warnings.append("noncanonical hero duplicates canonical source title at document opening")

    font_tag_count = len(re.findall(r"<font\b", html_text, re.I))
    style_attr_count = len(re.findall(r"\sstyle\s*=", html_text, re.I))
    if font_tag_count:
        converter_residue_warnings.append(f"legacy <font> tags: {font_tag_count}")
    if style_attr_count > 50:
        converter_residue_warnings.append(f"high inline style attribute count: {style_attr_count}")
    if re.search(r"<(center|o:p|sdfield)\b", html_text, re.I):
        converter_residue_warnings.append("legacy converter/page-field tags present")

    has_generated = 'data-generated="true"' in html_without_css or "data-generated='true'" in html_without_css
    generated_tag_pattern = r'''<[^>]+data-generated=["']true["'][^>]*>'''
    generated_tags = list(re.finditer(generated_tag_pattern, html_without_css, re.I))
    if has_generated and not generated_tags:
        source_boundary_errors.append("generated block present but no generated tag could be parsed")
    for match in generated_tags:
        tag_text = match.group(0)
        if not has_reference_attr(tag_text):
            source_boundary_errors.append("generated block missing data-target/data-evidence")
            break
        if not reference_tokens(tag_text):
            source_boundary_errors.append("generated block has empty data-target/data-evidence")
            break

    # Evidence notes: each marker resolves to a note, each note is referenced, noncanonical,
    # tied to a source (in-page data-target or external data-locator), and named by content, not position.
    template_errors: list[str] = []
    note_ids = {note.get("id", "") for note in parser.evidence_notes}
    referenced = {href[1:] for href in parser.evidence_refs if href.startswith("#")}
    for href in sorted(set(parser.evidence_refs)):
        if not href.startswith("#") or href[1:] not in note_ids:
            source_boundary_errors.append(f"evidence marker does not point to an evidence note: {href or '(no href)'}")
    for note in parser.evidence_notes:
        note_id = note.get("id", "")
        if not note_id:
            source_boundary_errors.append("evidence note without id")
            continue
        if note_id not in referenced:
            source_boundary_errors.append(f"evidence note never referenced: {note_id}")
        if not (note.get("data-target", "").strip() or note.get("data-locator", "").strip()):
            source_boundary_errors.append(f"evidence note needs data-target or data-locator: {note_id}")
        if note.get("data-canonical") != "false":
            source_boundary_errors.append(f'evidence note must carry data-canonical="false": {note_id}')
        if re.fullmatch(r"(?:ev[-_]?)?\d+", note_id, re.I):
            source_boundary_errors.append(f"evidence note id is positional; derive it from the source or claim: {note_id}")
    # Ink files are keyed by the report id: it must be valid and not the template example's.
    uses_ink = bool(re.search(r"<script\b[^>]*\bsrc=[\"'][^\"']*annotations\.js", html_text, re.I))
    if uses_ink and parser.annotation_report is None:
        template_errors.append("annotations.js loaded without <meta name=\"annotation-report\">")
    elif parser.annotation_report is not None and not re.fullmatch(r"[A-Za-z0-9_-]+", parser.annotation_report):
        template_errors.append(f"invalid annotation-report id: {parser.annotation_report!r}")
    h1 = re.search(r"<h1\b[^>]*>(.*?)</h1>", html_without_css, re.I | re.S)
    if parser.annotation_report == TEMPLATE_REPORT_ID and not (h1 and norm_compare(re.sub(r"<[^>]+>", "", h1.group(1))) == TEMPLATE_TITLE):
        template_errors.append("annotation-report id is still the template example's; give this report its own stable id")

    scholarly_warnings: list[str] = []
    if args.profile == "scholarly":
        if "<figure" in html_text.lower() and "data-caption-status" not in html_text:
            scholarly_warnings.append("figures present without data-caption-status")
        # Math gate: require an actual math container, not a substring of "mathematics".
        # Bundled KaTeX renders TeX kept in the HTML, so the source math stays inspectable.
        has_math = re.search(r"<math\b|class=\"[^\"]*\bmath-display\b", html_text, re.I)
        katex = re.search(r"<script\b[^>]*\bsrc=[\"'][^\"']*katex", html_text, re.I)
        if has_math and not katex and "data-math-renderer" not in html_text:
            scholarly_warnings.append("math/equation content present without data-math-renderer")
        if has_math and not katex and not re.search(r"data-canonical-text|data-math-source|data-equation-status|data-source-index", html_text, re.I):
            scholarly_warnings.append("math/equation content present without source math/provenance marker")
        citation_container = re.search(
            r"<(?:cite|bibliography|references)\b|class=[\"'][^\"']*\b(?:bibliography|references)\b",
            html_without_css,
            re.I,
        )
        citation_heading = re.search(r">\s*(?:references|bibliography)\s*<", html_without_css, re.I)
        if (citation_container or citation_heading) and "citation_status" not in html_without_css and "data-citation-status" not in html_without_css:
            scholarly_warnings.append("citation/reference structure present without citation_status/data-citation-status")

    # N7: detect double-rendered figures.
    # A `data-layout-duplicate="true"` element with <img src=...> pointing at a
    # canonical element (data-duplicate-of=ID) that ALSO contains an <img> with
    # the same src means the asset is rendered twice.
    duplicate_aside_re = re.compile(
        r'<[^>]+\bdata-layout-duplicate=["\']true["\'][^>]*\bdata-duplicate-of=["\']([^"\']+)["\'][^>]*>(.*?)</[^>]+>',
        re.I | re.S,
    )
    img_src_re = re.compile(r"<img\b[^>]*\bsrc=[\"']([^\"']+)[\"']", re.I)
    double_rendered: list[str] = []
    for dup_match in duplicate_aside_re.finditer(html_text):
        canonical_id = dup_match.group(1)
        dup_body = dup_match.group(2)
        dup_srcs = {m.group(1) for m in img_src_re.finditer(dup_body)}
        if not dup_srcs:
            continue
        # Locate the canonical element by id.
        canon_re = re.compile(
            rf'<[^>]+\bid=["\']{re.escape(canonical_id)}["\'][^>]*>(.*?)</(figure|section|aside|div|main)>',
            re.I | re.S,
        )
        canon_match = canon_re.search(html_text)
        if not canon_match:
            continue
        canon_srcs = {m.group(1) for m in img_src_re.finditer(canon_match.group(1))}
        for src in dup_srcs & canon_srcs:
            double_rendered.append(f"figure rendered twice (peek + canonical) for asset {src}")
    if double_rendered:
        design_warnings.extend(sorted(set(double_rendered)))

    # N8: caption-quality warnings.
    # Always: figcaption ends with U+2026 or "...".
    # Always: figcaption begins with a paren-prefixed editorial label.
    caption_re = re.compile(r"<figcaption\b[^>]*>(.*?)</figcaption>", re.I | re.S)
    truncation_tail_re = re.compile(r"(?:…|\.\.\.)\s*$")
    editorial_prefix_re = re.compile(r"^\s*\(\s*(?:Short form|Brief|TL;DR|Summary)\s*\)", re.I)
    caption_warnings: list[str] = []
    for cap_match in caption_re.finditer(html_text):
        text = re.sub(r"<[^>]+>", "", cap_match.group(1)).strip()
        if not text:
            continue
        if truncation_tail_re.search(text):
            caption_warnings.append(f"figcaption ends with ellipsis: {text[:60]}…")
        if editorial_prefix_re.search(text):
            caption_warnings.append(f"figcaption uses editorial-label prefix: {text[:60]}…")
    if caption_warnings:
        design_warnings.extend(sorted(set(caption_warnings)))

    relaid_figures = [figure for figure in parser.figures if figure.get("data-relayout")]
    for figure in relaid_figures:
        if not figure.get("data-source-index") or not figure.get("data-caption-source-index"):
            design_warnings.append("relaid figure missing source-index/caption-source-index provenance")
            break
    if relaid_figures and not re.search(r"data-relayout\s*=\s*[\"']first-mention[\"']", html_without_css, re.I):
        design_warnings.append("figure relayout present without first-mention policy marker")

    visible_text = norm_compare(re.sub(r"<[^>]+>", " ", html_without_css))
    process_note_patterns = [
        r"generated by better-read-html",
        r"generated by (?:an )?(?:ai|assistant|llm)",
        r"click to copy",
        r"copy latex source",
        r"main figures were moved",
    ]
    for pattern in process_note_patterns:
        if re.search(pattern, visible_text, re.I):
            design_warnings.append(f"visible process/helper note present: {pattern}")
            break

    report = {
        "html_file": str(html_path),
        "main_seen": parser.main_seen,
        "canonical_text_chars": len(html_canonical_text),
        "id_count": len(parser.ids),
        "duplicate_ids": dups,
        "relaid_figure_count": len(relaid_figures),
        "evidence_note_count": len(parser.evidence_notes),
        "math_element_count": len(parser.math_elements),
        "internal_link_count": len(parser.hrefs),
        "broken_internal_links": broken_internal_links,
        "attribute_reference_count": len(parser.attribute_refs),
        "unresolved_attribute_refs": unresolved_attribute_refs,
        "asset_references": asset_refs,
        "missing_referenced_assets": sorted(set(missing_assets)),
        "local_links": local_links,
        "missing_local_links": sorted(set(missing_local_links)),
        "remote_dependencies": sorted(set(parser.remote_dependencies)),
        "external_links": sorted(set(parser.external_links)),
        "inline_data_assets": sorted(set(parser.inline_data_assets)),
        "executable_links": sorted(set(parser.executable_links)),
        "base_hrefs": sorted(set(parser.base_hrefs)),
        "navigation_hazards": sorted(set(parser.navigation_hazards)),
        "benign_external_links": sorted(set(parser.benign_external_links)),
        "html_validity_errors": parser.html_validity_errors,
        "accessibility_warnings": accessibility_warnings,
        "readability_warnings": readability_warnings,
        "design_warnings": design_warnings,
        "converter_residue_warnings": converter_residue_warnings,
        "source_boundary_errors": source_boundary_errors,
        "template_errors": template_errors,
        "scholarly_warnings": scholarly_warnings,
        "source_order_normalized_text_exact_match": source_match,
        "source_order_compatibility_text_match": compatibility_source_match,
        "first_text_mismatch": mismatch,
    }
    print(json.dumps(report, indent=2, ensure_ascii=False))

    failed = bool(
        dups
        or broken_internal_links
        or unresolved_attribute_refs
        or missing_assets
        or missing_local_links
        or parser.html_validity_errors
        or source_boundary_errors
        or template_errors
        or parser.executable_links
        or parser.navigation_hazards
        or (parser.remote_dependencies and not args.allow_remote)
        or (not parser.main_seen and not args.allow_no_main)
        or (not html_canonical_text and not args.allow_empty_canonical)
        or ((args.require_source_text or args.profile == "preserve") and not args.source_text)
        or source_match is False
    )
    return 1 if args.strict and failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
