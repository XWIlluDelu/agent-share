#!/usr/bin/env python3
"""Audit a static readable HTML artifact for links, assets, ids, and optional source parity."""

from __future__ import annotations

import argparse
import html.parser
import json
import re
import unicodedata
from pathlib import Path
from urllib.parse import urlparse

VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}
SKIP_TAGS = {"script", "style"}
REMOTE_DEPENDENCY_TAGS = {"script", "link", "source", "audio", "video", "iframe", "embed", "object"}
REMOTE_ASSET_SCHEMES = {"http", "https"}
EXECUTABLE_SCHEMES = {"javascript"}
BENIGN_LINK_SCHEMES = {"mailto", "tel"}
REFERENCE_ATTRS = {"data-target", "data-duplicate-of", "aria-controls", "aria-describedby", "aria-labelledby"}


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
        self.inline_data_assets: list[str] = []
        self.executable_links: list[str] = []
        self.benign_external_links: list[str] = []
        self.image_alts: list[tuple[str, str, bool]] = []
        self.html_validity_errors: list[str] = []
        self.title_seen = False
        self.html_lang = ""
        self.figures: list[dict[str, str]] = []
        self.rails: list[dict[str, str]] = []
        self.math_elements: list[dict[str, str]] = []
        self.canonical_text_stack: list[str | None] = []

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
        if "brh-rail" in class_tokens:
            self.rails.append(attrs_d)
        if any(token.startswith("brh-math") or token == "brh-equation" for token in class_tokens):
            self.math_elements.append(attrs_d)

        href = attrs_d.get("href")
        if href and not href.startswith("#"):
            parsed = urlparse(href)
            if parsed.scheme in EXECUTABLE_SCHEMES:
                self.executable_links.append(href)
            elif parsed.scheme in BENIGN_LINK_SCHEMES:
                self.benign_external_links.append(href)
            elif tag == "a" and (parsed.scheme in REMOTE_ASSET_SCHEMES or href.startswith("//")):
                self.external_links.append(href)
            elif tag in {"link", "script"}:
                if parsed.scheme in REMOTE_ASSET_SCHEMES or href.startswith("//"):
                    self.remote_dependencies.append(href)
                else:
                    self.assets.append(href)

        src = attrs_d.get("src")
        if src and not src.startswith("#"):
            parsed = urlparse(src)
            if parsed.scheme in EXECUTABLE_SCHEMES:
                self.executable_links.append(src)
            elif src.startswith("data:image/"):
                self.inline_data_assets.append(src[:48] + "...")
            elif parsed.scheme == "data":
                self.remote_dependencies.append(src[:48] + "...")
            elif parsed.scheme in REMOTE_ASSET_SCHEMES or src.startswith("//"):
                self.remote_dependencies.append(src)
            else:
                self.assets.append(src)
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
        if not self.in_main:
            return
        captured = self.capture_stack.pop() if self.capture_stack else True
        canonical_text_attr = self.canonical_text_stack.pop() if self.canonical_text_stack else None
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


def css_remote_dependencies(html_text: str) -> list[str]:
    css_parts = re.findall(r"<style\b[^>]*>(.*?)</style>", html_text, re.I | re.S)
    css_parts.extend(match.group(2) for match in re.finditer(r'''\bstyle\s*=\s*(["'])(.*?)\1''', html_text, re.I | re.S))
    remote: list[str] = []
    for css in css_parts:
        css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
        for match in re.finditer(r'''@import\s+(?:url\(\s*)?(["']?)([^"')\s;]+)\1''', css, re.I):
            url = match.group(2).strip()
            parsed = urlparse(url)
            if parsed.scheme in REMOTE_ASSET_SCHEMES or url.startswith("//"):
                remote.append(url)
            elif parsed.scheme == "data":
                remote.append(url[:48] + "...")
        for match in re.finditer(r'''url\(\s*(["']?)(.*?)\1\s*\)''', css, re.I | re.S):
            url = match.group(2).strip()
            parsed = urlparse(url)
            if parsed.scheme in REMOTE_ASSET_SCHEMES or url.startswith("//"):
                remote.append(url)
            elif parsed.scheme == "data":
                remote.append(url[:48] + "...")
    return remote


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("html", type=Path, help="HTML file to audit")
    ap.add_argument("--assets-dir", type=Path, help="Directory containing local assets. Defaults to HTML sibling assets/ if present.")
    ap.add_argument("--source-text", type=Path, help="Optional canonical source text to compare against canonical HTML text")
    ap.add_argument("--strict", action="store_true", help="Exit nonzero for duplicate ids, broken links, unresolved refs, missing assets, missing main, remote dependencies, executable links, or source mismatch")
    ap.add_argument("--allow-remote", action="store_true", help="Do not fail strict mode for remote http(s)/data dependencies")
    ap.add_argument("--allow-no-main", action="store_true", help="Do not fail strict mode when no <main> element is present")
    ap.add_argument("--allow-empty-canonical", action="store_true", help="Do not fail strict mode when canonical text is empty")
    ap.add_argument("--require-source-text", action="store_true", help="Fail strict mode unless --source-text is supplied")
    ap.add_argument("--profile", choices=["generic", "preserve", "scholarly"], default="generic", help="Enable lightweight profile-specific contract checks")
    args = ap.parse_args()

    html_path = args.html
    html_text = html_path.read_text(encoding="utf-8")
    parser = AuditParser(source_order=True)
    parser.feed(html_text)
    parser.remote_dependencies.extend(css_remote_dependencies(html_text))

    ids = set(parser.ids)
    broken_internal_links = sorted({href for href in parser.hrefs if href not in ids})
    unresolved_attribute_refs = sorted({ref for ref in parser.attribute_refs if ref not in ids})
    dups = duplicate_ids(parser.ids)
    assets_dir = args.assets_dir or (html_path.parent / "assets")
    missing_assets: list[str] = []
    asset_refs = sorted(set(parser.assets))
    for ref in asset_refs:
        if ref.startswith("/"):
            candidate = html_path.parent / ref.lstrip("/")
        else:
            candidate = html_path.parent / ref
            if not candidate.exists() and assets_dir.exists():
                candidate = assets_dir / Path(ref).name
        if not candidate.exists():
            missing_assets.append(ref)

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
    if parser.hrefs and ":focus-visible" not in html_text:
        readability_warnings.append("navigation present but no visible :focus-visible style found")
    if parser.hrefs and ":target" not in html_text:
        readability_warnings.append("internal links present but no :target style found")
    if "<table" in html_text.lower() and not re.search(r"overflow-x\s*:\s*auto", html_text, re.I):
        readability_warnings.append("tables present but no horizontal overflow handling found")
    if "@media print" not in html_text:
        readability_warnings.append("missing print stylesheet")

    main_open = re.search(r"<main\b[^>]*>(?P<body>.*?)</main>", html_without_css, re.I | re.S)
    if main_open:
        main_inner = main_open.group("body")
        lead = re.search(r"\S", main_inner)
        if lead:
            lead_fragment = main_inner[lead.start(): lead.start() + 1200]
            if re.match(r"<header\b[^>]*data-canonical=[\"']false[\"']", lead_fragment, re.I | re.S):
                rest = re.sub(r"^<header\b[^>]*>.*?</header>", "", lead_fragment, flags=re.I | re.S)
                title_in_header = re.search(r"<h1\b[^>]*>(.*?)</h1>", lead_fragment, re.I | re.S)
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

    has_generated = (
        'data-generated="true"' in html_without_css
        or "data-generated='true'" in html_without_css
        or re.search(r'''class=["'][^"']*\bbrh-generated\b''', html_without_css, re.I)
    )
    generated_tag_pattern = r'''<[^>]+(?:data-generated=["']true["']|class=["'][^"']*\bbrh-generated\b)[^>]*>'''
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

    scholarly_warnings: list[str] = []
    if args.profile == "scholarly":
        if "<figure" in html_text.lower() and "data-caption-status" not in html_text:
            scholarly_warnings.append("figures present without data-caption-status")
        # Math gate: require an actual math container, not a substring of "mathematics".
        has_math = re.search(r"<math\b|class=\"[^\"]*brh-equation|class=\"[^\"]*brh-math", html_text, re.I)
        if has_math and "data-math-renderer" not in html_text:
            scholarly_warnings.append("math/equation content present without data-math-renderer")
        if has_math and not re.search(r"data-canonical-text|data-math-source|data-equation-status|data-source-index", html_text, re.I):
            scholarly_warnings.append("math/equation content present without source math/provenance marker")
        citation_container = re.search(
            r"<(?:cite|bibliography|references)\b|class=[\"'][^\"']*\b(?:brh-reference|brh-citation|bibliography|references)\b",
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

    if "{{" in html_without_css or "}}" in html_without_css:
        design_warnings.append("unsubstituted template placeholder remains in rendered HTML")

    relaid_figures = [figure for figure in parser.figures if figure.get("data-relayout")]
    for figure in relaid_figures:
        if not figure.get("data-source-index") or not figure.get("data-caption-source-index"):
            design_warnings.append("relaid figure missing source-index/caption-source-index provenance")
            break
    if relaid_figures and not re.search(r"data-relayout\s*=\s*[\"']first-mention[\"']", html_without_css, re.I):
        design_warnings.append("figure relayout present without first-mention policy marker")

    if re.search(r'class=["\'][^"\']*\bbrh-shell--dual-rail\b', html_without_css):
        if len(parser.rails) > 1 and any(not rail.get("data-rail-priority") for rail in parser.rails):
            design_warnings.append("multiple rails present without data-rail-priority ordering")

    for math_attrs in parser.math_elements:
        math_class = math_attrs.get("class", "")
        if (
            ("brh-math" in math_class or "brh-equation" in math_class or "data-copy-latex" in math_attrs or "data-math-source" in math_attrs)
            and not (math_attrs.get("data-canonical-text") or math_attrs.get("data-math-source") or math_attrs.get("data-equation-status") or math_attrs.get("data-source-index"))
        ):
            scholarly_warnings.append("math element missing source/provenance marker")
            break

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

    # A-M1: subtype-gated CSS without renderer-side emission.
    # If the inline stylesheet references `[data-mode-subtype="…"]` but no element
    # in the document carries the attribute, the gated rules are dead code.
    if re.search(r'\[data-mode-subtype=', html_text):
        if not re.search(r'<[^>]+\sdata-mode-subtype=', html_text):
            design_warnings.append("CSS references [data-mode-subtype=…] but no element carries the attribute (subtype-gated rules will never fire)")

    # A-M2: drop-cap misapplication. Only fires when the artifact's mode_subtype
    # is one of the close-read / synthesis-report subtypes that activate the drop
    # cap rule; under preserve/conversion-preserve the rule is dormant by design.
    if re.search(r'<[^>]+\sdata-mode-subtype=["\'](?:close-read|synthesis-report)["\']', html_text):
        if re.search(r'#summary\s*\+\s*\.body-text\s*::?first-letter', html_text):
            if not re.search(r'<[^>]+\sid=["\']summary["\']', html_text):
                design_warnings.append("close-read/synthesis-report subtype + drop-cap CSS but no #summary element (rule will not fire)")

    # A-M3: empty rail-track on dual-rail shell.
    # If the shell is marked --dual-rail, both left and right rails should
    # contain at least one non-whitespace child; otherwise the middle-tier
    # grid leaves a ghost column.
    if re.search(r'class=["\'][^"\']*\bbrh-shell--dual-rail\b', html_text):
        rails = re.findall(r'<aside\b[^>]*\bclass=["\'][^"\']*\bbrh-rail\b[^"\']*["\'][^>]*>(.*?)</aside>',
                           html_text, re.I | re.S)
        for body in rails:
            stripped = re.sub(r'<[^>]+>|\s+', '', body)
            if not stripped:
                design_warnings.append("brh-shell--dual-rail has an empty .brh-rail (ghost column risk on mid-tier)")
                break

    report = {
        "html_file": str(html_path),
        "main_seen": parser.main_seen,
        "canonical_text_chars": len(html_canonical_text),
        "id_count": len(parser.ids),
        "duplicate_ids": dups,
        "relaid_figure_count": len(relaid_figures),
        "rail_count": len(parser.rails),
        "math_element_count": len(parser.math_elements),
        "internal_link_count": len(parser.hrefs),
        "broken_internal_links": broken_internal_links,
        "attribute_reference_count": len(parser.attribute_refs),
        "unresolved_attribute_refs": unresolved_attribute_refs,
        "asset_references": asset_refs,
        "missing_referenced_assets": sorted(set(missing_assets)),
        "remote_dependencies": sorted(set(parser.remote_dependencies)),
        "external_links": sorted(set(parser.external_links)),
        "inline_data_assets": sorted(set(parser.inline_data_assets)),
        "executable_links": sorted(set(parser.executable_links)),
        "benign_external_links": sorted(set(parser.benign_external_links)),
        "html_validity_errors": parser.html_validity_errors,
        "accessibility_warnings": accessibility_warnings,
        "readability_warnings": readability_warnings,
        "design_warnings": design_warnings,
        "converter_residue_warnings": converter_residue_warnings,
        "source_boundary_errors": source_boundary_errors,
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
        or parser.html_validity_errors
        or source_boundary_errors
        or parser.executable_links
        or (parser.remote_dependencies and not args.allow_remote)
        or (not parser.main_seen and not args.allow_no_main)
        or (not html_canonical_text and not args.allow_empty_canonical)
        or ((args.require_source_text or args.profile == "preserve") and not args.source_text)
        or source_match is False
    )
    return 1 if args.strict and failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
