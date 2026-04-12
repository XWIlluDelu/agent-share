#!/usr/bin/env python3

import argparse
import json
import os
import re
import sys
import time
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple
from urllib import error, parse, request

try:
    import yaml
except ImportError as exc:
    raise SystemExit('PyYAML is required: pip install pyyaml') from exc


API_URL = 'https://api.semanticscholar.org/graph/v1/paper/search'
DEFAULT_FIELDS = (
    'paperId,title,abstract,publicationDate,year,venue,url,authors,'
    'citationCount,influentialCitationCount,externalIds,openAccessPdf,fieldsOfStudy'
)
DEFAULT_HEADERS = {
    'User-Agent': 'semantic-scholar-daily/1.0',
}
COMMON_STOPWORDS = {
    'the', 'and', 'for', 'with', 'from', 'into', 'using', 'toward', 'towards', 'via',
    'neural', 'model', 'models', 'learning', 'paper', 'study', 'based', 'approach'
}
LINK_STOPWORDS = COMMON_STOPWORDS | {
    'that', 'this', 'these', 'those', 'their', 'there', 'here', 'over', 'under',
    'between', 'within', 'across', 'through', 'system', 'methods', 'results',
    'analysis', 'framework', 'networks', 'representation', 'representations'
}
SUMMARY_SENTENCE_LIMIT = 220
DEFAULT_RECENT_DAYS = 45
DEFAULT_RECENT_CUTOFF_DAYS = 30
DEFAULT_HOT_DAYS = 365
DEFAULT_MAX_PER_DOMAIN = 3


def normalize_text(value: str) -> str:
    return re.sub(r'\s+', ' ', value.strip())


def normalize_key(value: str) -> str:
    lowered = normalize_text(value).lower()
    return re.sub(r'[^a-z0-9\u4e00-\u9fff]+', '', lowered)


def slugify(value: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', normalize_text(value).lower()).strip('-')


def contains_phrase(text: str, phrase: str) -> bool:
    pattern = r'(?<![a-z0-9])' + re.escape(phrase.lower()) + r'(?![a-z0-9])'
    return re.search(pattern, text) is not None


def parse_date(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    for fmt in ('%Y-%m-%d', '%Y-%m', '%Y'):
        try:
            return datetime.strptime(value, fmt).replace(tzinfo=timezone.utc)
        except ValueError:
            continue
    return None


def iso_date(value: Optional[datetime]) -> str:
    return value.strftime('%Y-%m-%d') if value else 'unknown'


def ensure_parent(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)


def split_sentences(text: str) -> List[str]:
    cleaned = normalize_text(text)
    if not cleaned:
        return []
    parts = re.split(r'(?<=[.!?。！？])\s+', cleaned)
    return [part.strip() for part in parts if part.strip()]


def title_keywords(title: str, limit: int = 6) -> List[str]:
    words = re.findall(r'[A-Za-z][A-Za-z0-9\-]{2,}|[\u4e00-\u9fff]{2,}', title)
    result: List[str] = []
    for word in words:
        lowered = word.lower()
        if lowered in COMMON_STOPWORDS:
            continue
        if lowered not in result:
            result.append(lowered)
        if len(result) >= limit:
            break
    return result


def extract_daily_keywords(papers: Sequence[Dict[str, Any]], limit: int = 12) -> List[str]:
    counts: Dict[str, int] = {}
    for paper in papers:
        for keyword in paper.get('matchedKeywords') or []:
            normalized = keyword.strip()
            lowered = normalized.lower()
            if not normalized or lowered in COMMON_STOPWORDS or len(lowered) < 3:
                continue
            counts[normalized] = counts.get(normalized, 0) + 2
        for keyword in title_keywords(paper.get('title') or '', limit=6):
            if keyword in COMMON_STOPWORDS:
                continue
            counts[keyword] = counts.get(keyword, 0) + 1
    ordered = sorted(counts.items(), key=lambda item: (-item[1], item[0]))
    return [name for name, _ in ordered[:limit]]


def clamp_score(value: float, lower: float = 0.0, upper: float = 10.0) -> float:
    return max(lower, min(value, upper))


def format_score(value: float) -> str:
    return f'{value:.2f}'.rstrip('0').rstrip('.')


@dataclass
class DomainQuery:
    domain: str
    priority: int
    keywords: List[str]
    query: str


@dataclass
class ExistingNoteIndex:
    by_id: Dict[str, str]
    by_title: Dict[str, str]
    keyword_entries: List[Tuple[set[str], str]]


@dataclass
class NoteKeywordIndex:
    keyword_to_paths: Dict[str, List[str]]


class SemanticScholarClient:
    def __init__(self, api_key: str, min_interval: float = 2.0, max_retries: int = 4) -> None:
        self.api_key = api_key
        self.min_interval = min_interval
        self.max_retries = max_retries
        self._last_request_at = 0.0

    def search(
        self,
        query: str,
        limit: int,
        date_from: Optional[str] = None,
        date_to: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        params = {
            'query': query,
            'limit': str(limit),
            'fields': DEFAULT_FIELDS,
        }
        if date_from and date_to:
            params['publicationDateOrYear'] = f'{date_from}:{date_to}'

        url = f"{API_URL}?{parse.urlencode(params)}"
        headers = dict(DEFAULT_HEADERS)
        headers['x-api-key'] = self.api_key

        elapsed = time.time() - self._last_request_at
        if elapsed < self.min_interval:
            time.sleep(self.min_interval - elapsed)

        req = request.Request(url, headers=headers)
        for attempt in range(self.max_retries):
            try:
                with request.urlopen(req, timeout=30) as resp:
                    payload = json.loads(resp.read().decode('utf-8'))
                self._last_request_at = time.time()
                return payload.get('data') or []
            except error.HTTPError as exc:
                body = exc.read().decode('utf-8', errors='replace')
                self._last_request_at = time.time()
                if exc.code == 429 and attempt < self.max_retries - 1:
                    retry_after = exc.headers.get('Retry-After') if exc.headers else None
                    wait_seconds = float(retry_after) if retry_after else max(self.min_interval * (attempt + 2), 5.0)
                    time.sleep(wait_seconds)
                    continue
                raise RuntimeError(f'Semantic Scholar HTTP {exc.code}: {body}') from exc
            except error.URLError as exc:
                self._last_request_at = time.time()
                if attempt < self.max_retries - 1:
                    time.sleep(max(self.min_interval * (attempt + 1), 2.0))
                    continue
                raise RuntimeError(f'Unable to reach Semantic Scholar: {exc}') from exc

        return []


def load_yaml(path: Path) -> Dict[str, Any]:
    if not path.exists():
        raise FileNotFoundError(f'Config file not found: {path}')
    with path.open('r', encoding='utf-8') as handle:
        data = yaml.safe_load(handle) or {}
    if not isinstance(data, dict):
        raise ValueError(f'Config file must contain a mapping: {path}')
    return data


def build_domain_queries(config: Dict[str, Any]) -> List[DomainQuery]:
    domains = config.get('research_domains') or {}
    results: List[DomainQuery] = []
    for domain, meta in domains.items():
        if not isinstance(meta, dict):
            continue
        keywords = [normalize_text(str(item)) for item in (meta.get('keywords') or []) if str(item).strip()]
        if not keywords:
            continue
        query_terms = [f'"{kw}"' for kw in keywords[:4]]
        results.append(
            DomainQuery(
                domain=domain,
                priority=int(meta.get('priority') or 1),
                keywords=keywords,
                query=' OR '.join(query_terms),
            )
        )
    results.sort(key=lambda item: item.priority, reverse=True)
    return results


def extract_frontmatter(content: str) -> Dict[str, Any]:
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n', content, re.DOTALL)
    if not match:
        return {}
    try:
        data = yaml.safe_load(match.group(1)) or {}
    except Exception:
        return {}
    return data if isinstance(data, dict) else {}


def extract_note_title(path: Path) -> Optional[str]:
    try:
        content = path.read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None

    frontmatter = extract_frontmatter(content)
    title = frontmatter.get('title')
    if isinstance(title, str) and title.strip():
        return normalize_text(title)
    return normalize_text(path.stem)


def extract_ids_from_frontmatter(frontmatter: Dict[str, Any]) -> List[str]:
    candidates: List[str] = []
    for key in ('paperId', 'paper_id', 'semanticScholarId', 'semantic_scholar_id', 'arxiv', 'arxiv_id'):
        value = frontmatter.get(key)
        if isinstance(value, str) and value.strip():
            candidates.append(value.strip())
    external_ids = frontmatter.get('externalIds')
    if isinstance(external_ids, dict):
        for value in external_ids.values():
            if isinstance(value, str) and value.strip():
                candidates.append(value.strip())
    return candidates


def load_existing_notes(vault_path: Optional[Path]) -> ExistingNoteIndex:
    if not vault_path:
        return ExistingNoteIndex(by_id={}, by_title={}, keyword_entries=[])
    papers_dir = vault_path / '20_Research' / 'Papers'
    if not papers_dir.exists():
        return ExistingNoteIndex(by_id={}, by_title={}, keyword_entries=[])

    by_id: Dict[str, str] = {}
    by_title: Dict[str, str] = {}
    keyword_entries: List[Tuple[set[str], str]] = []
    for note in papers_dir.rglob('*.md'):
        try:
            content = note.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        frontmatter = extract_frontmatter(content)
        title_value = frontmatter.get('title') if isinstance(frontmatter.get('title'), str) else note.stem
        title = normalize_text(str(title_value))
        if not title:
            continue
        rel = note.relative_to(vault_path).as_posix()
        key = normalize_key(title)
        if key:
            by_title.setdefault(key, rel)
        keywords = set(title_keywords(title, limit=8))
        if keywords:
            keyword_entries.append((keywords, rel))
        for note_id in extract_ids_from_frontmatter(frontmatter):
            by_id.setdefault(normalize_key(note_id), rel)
    return ExistingNoteIndex(by_id=by_id, by_title=by_title, keyword_entries=keyword_entries)


def extract_note_keywords(title: str, tags: Sequence[Any]) -> List[str]:
    keywords: List[str] = []

    acronym = re.match(r'^([A-Z]{2,})(?:\s*:|\s+)', title)
    if acronym:
        lowered = acronym.group(1).lower()
        if lowered not in keywords:
            keywords.append(lowered)

    before_colon = title.split(':', 1)[0].strip()
    if 3 <= len(before_colon) <= 40 and ('-' in before_colon or ' ' in before_colon):
        normalized = normalize_text(before_colon).lower()
        if normalized not in LINK_STOPWORDS and normalized not in keywords:
            keywords.append(normalized)

    for term in re.findall(r'\b[A-Z][A-Za-z0-9]+(?:-[A-Z][A-Za-z0-9]+)+\b', title):
        normalized = term.lower()
        if normalized not in keywords:
            keywords.append(normalized)

    for tag in tags:
        if isinstance(tag, str):
            candidates = [tag]
        elif isinstance(tag, list):
            candidates = [item for item in tag if isinstance(item, str)]
        else:
            candidates = []
        for candidate in candidates:
            normalized = normalize_text(candidate).lower()
            if (
                3 <= len(normalized) <= 40
                and normalized not in LINK_STOPWORDS
                and ('-' in normalized or ' ' in normalized or candidate.isupper())
                and normalized not in keywords
            ):
                keywords.append(normalized)
    return keywords


def build_note_keyword_index(vault_path: Optional[Path]) -> NoteKeywordIndex:
    if not vault_path:
        return NoteKeywordIndex(keyword_to_paths={})
    papers_dir = vault_path / '20_Research' / 'Papers'
    if not papers_dir.exists():
        return NoteKeywordIndex(keyword_to_paths={})

    keyword_to_paths: Dict[str, List[str]] = {}
    for note in papers_dir.rglob('*.md'):
        try:
            content = note.read_text(encoding='utf-8', errors='replace')
        except OSError:
            continue
        frontmatter = extract_frontmatter(content)
        title_value = frontmatter.get('title') if isinstance(frontmatter.get('title'), str) else note.stem
        title = normalize_text(str(title_value))
        rel = note.relative_to(vault_path).as_posix()
        raw_tags = frontmatter.get('tags')
        tags: Sequence[Any] = raw_tags if isinstance(raw_tags, list) else []
        for keyword in extract_note_keywords(title, tags):
            if keyword not in keyword_to_paths:
                keyword_to_paths[keyword] = []
            if rel not in keyword_to_paths[keyword]:
                keyword_to_paths[keyword].append(rel)

    return NoteKeywordIndex(keyword_to_paths=keyword_to_paths)


def find_existing_note(
    paper: Dict[str, Any],
    title: str,
    note_index: ExistingNoteIndex,
) -> Optional[str]:
    paper_id = paper.get('paperId')
    if isinstance(paper_id, str) and paper_id.strip():
        match = note_index.by_id.get(normalize_key(paper_id))
        if match:
            return match

    external_ids = paper.get('externalIds') or {}
    if isinstance(external_ids, dict):
        for value in external_ids.values():
            if isinstance(value, str) and value.strip():
                match = note_index.by_id.get(normalize_key(value))
                if match:
                    return match

    title_key = normalize_key(title)
    exact = note_index.by_title.get(title_key)
    if exact:
        return exact

    keywords = set(title_keywords(title, limit=8))
    if len(keywords) < 2:
        return None
    best_match = None
    best_overlap = 0
    for note_keywords, note_path in note_index.keyword_entries:
        overlap = len(keywords & note_keywords)
        if overlap > best_overlap:
            best_overlap = overlap
            best_match = note_path
    return best_match if best_overlap >= 2 else None


def domain_match_score(text: str, keywords: Sequence[str]) -> Tuple[float, List[str]]:
    score = 0.0
    matched: List[str] = []
    title, _, abstract = text.partition('\n')
    for keyword in keywords:
        keyword_lower = keyword.lower()
        if contains_phrase(title, keyword_lower):
            score += 2.5
            matched.append(keyword)
        elif contains_phrase(abstract, keyword_lower):
            score += 1.1
            matched.append(keyword)
    return score, matched


def compute_weighted_relevance_score(title: str, abstract: str, keywords: Sequence[str]) -> Tuple[float, List[str]]:
    title_lower = title.lower()
    abstract_lower = abstract.lower()
    score = 0.0
    matched: List[str] = []
    for keyword in keywords:
        keyword_lower = keyword.lower()
        title_hit = contains_phrase(title_lower, keyword_lower)
        abstract_hit = contains_phrase(abstract_lower, keyword_lower)
        if title_hit:
            score += 0.5
        if abstract_hit:
            score += 0.3
        if title_hit or abstract_hit:
            matched.append(keyword)
    return min(score, 3.0), matched


def compute_recency_score(published_at: Optional[datetime], target_date: datetime) -> float:
    if not published_at:
        return 0.0
    days_old = max((target_date - published_at).days, 0)
    if days_old <= 30:
        return 3.0
    if days_old <= 90:
        return 2.0
    if days_old <= 180:
        return 1.0
    return 0.0


def compute_popularity_score(citation_count: int, influential_count: int, days_old: Optional[int]) -> float:
    if citation_count > 100:
        return 3.0
    if citation_count >= 50:
        return 2.0
    if citation_count > 0:
        return 1.0
    if days_old is not None and days_old <= 7 and influential_count > 0:
        return 2.0
    return 0.0


def compute_quality_score(abstract: str) -> Tuple[float, List[str]]:
    lowered = abstract.lower()
    strong_signals = ('state-of-the-art', 'significant improvement', 'substantial improvement', 'first', 'novel paradigm')
    method_signals = ('we propose', 'we present', 'framework', 'method', 'approach', 'benchmark', 'systematically')
    hits: List[str] = []
    if any(signal in lowered for signal in strong_signals):
        hits.append('significant innovation')
        return 3.0, hits
    if any(signal in lowered for signal in method_signals):
        hits.append('clear method contribution')
        return 2.0, hits
    if lowered:
        hits.append('general contribution')
        return 1.0, hits
    return 0.0, hits


def compute_venue_score(venue_text: str, preferred_signals: Sequence[str]) -> Tuple[float, List[str]]:
    score = 0.0
    matches: List[str] = []
    lowered = venue_text.lower()
    for signal in preferred_signals:
        if signal.lower() in lowered:
            score += 0.7
            matches.append(signal)
    return min(score, 3.0), matches


def extract_primary_url(paper: Dict[str, Any]) -> str:
    return paper.get('url') or (paper.get('openAccessPdf') or {}).get('url') or ''


def extract_pdf_url(paper: Dict[str, Any]) -> str:
    return (paper.get('openAccessPdf') or {}).get('url') or ''


def extract_arxiv_url(paper: Dict[str, Any]) -> str:
    external_ids = paper.get('externalIds') or {}
    if isinstance(external_ids, dict):
        arxiv_id = external_ids.get('ArXiv') or external_ids.get('arXiv')
        if isinstance(arxiv_id, str) and arxiv_id.strip():
            return f'https://arxiv.org/abs/{arxiv_id.strip()}'
    url = paper.get('url') or ''
    if 'arxiv.org/' in url:
        return url
    return ''


def infer_source_label(paper: Dict[str, Any]) -> str:
    if extract_arxiv_url(paper):
        return 'arXiv'
    venue = normalize_text(paper.get('venue') or '')
    return venue or 'Semantic Scholar'


def extract_institutions(paper: Dict[str, Any]) -> List[str]:
    institutions: List[str] = []
    for author in paper.get('authors') or []:
        for key in ('affiliations', 'institution', 'institutions'):
            value = author.get(key)
            if isinstance(value, list):
                for item in value:
                    if isinstance(item, str) and item.strip() and item.strip() not in institutions:
                        institutions.append(item.strip())
            elif isinstance(value, str) and value.strip() and value.strip() not in institutions:
                institutions.append(value.strip())
    return institutions[:4]


def summarize_paper(paper: Dict[str, Any]) -> Dict[str, Any]:
    abstract = normalize_text(paper.get('abstract') or '')
    sentences = split_sentences(abstract)
    one_liner = sentences[0] if sentences else 'See abstract for the main contribution.'
    if len(one_liner) > SUMMARY_SENTENCE_LIMIT:
        one_liner = one_liner[: SUMMARY_SENTENCE_LIMIT - 3].rstrip() + '...'

    contributions = sentences[:3] if sentences else ['Abstract unavailable.']
    result_sentence = ''
    result_keywords = ('result', 'improve', 'outperform', 'gain', 'better', 'achieve', 'show', 'demonstrate')
    for sentence in sentences:
        lowered = sentence.lower()
        if any(keyword in lowered for keyword in result_keywords):
            result_sentence = sentence
            break
    if not result_sentence:
        result_sentence = sentences[1] if len(sentences) > 1 else one_liner

    return {
        'one_line_summary': one_liner,
        'core_contributions': contributions,
        'key_result': result_sentence,
    }


def build_reading_priority(score: float) -> str:
    return 'high' if score >= 7.5 else 'standard'


def build_hotspots(papers: Sequence[Dict[str, Any]]) -> List[Dict[str, str]]:
    hotspot_counts: Dict[str, int] = {}
    for paper in papers:
        for keyword in paper.get('matchedKeywords') or []:
            normalized = keyword.strip()
            lowered = normalized.lower()
            if not normalized or lowered in COMMON_STOPWORDS or len(lowered) < 4:
                continue
            hotspot_counts[normalized] = hotspot_counts.get(normalized, 0) + 1
    hotspots: List[Dict[str, str]] = []
    for keyword, count in sorted(hotspot_counts.items(), key=lambda item: (-item[1], item[0]))[:3]:
        hotspots.append({'topic': keyword, 'description': f'Appears in {count} recommended papers and reflects an active theme today.'})
    return hotspots


def build_overview(papers: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    scores = [paper['scores']['recommendation'] for paper in papers]
    domains = [str(paper['matchedDomain']) for paper in papers if paper.get('matchedDomain')]
    ordered_domains = [name for name, _ in sorted({domain: domains.count(domain) for domain in set(domains)}.items(), key=lambda item: item[1], reverse=True)]
    main_directions = ordered_domains[:3]
    hotspots = build_hotspots(papers)
    trend_text = '、'.join(main_directions) if main_directions else '跨领域方向'
    reading_titles = [paper['title'] for paper in papers[:3]]
    return {
        'paper_count': len(papers),
        'main_directions': main_directions,
        'trend_summary': f'今日论文集中在{trend_text}，整体偏向近期方法推进与应用扩展。',
        'score_range': {
            'min': round(min(scores), 2) if scores else 0.0,
            'max': round(max(scores), 2) if scores else 0.0,
        },
        'quality_summary': '整体质量较高，前排论文同时兼顾相关性与新近性。' if scores and max(scores) >= 7.5 else '整体质量中等偏上，适合按兴趣筛选精读。',
        'hotspots': hotspots,
        'reading_advice': '建议优先阅读：' + ' -> '.join(reading_titles) if reading_titles else '建议先从评分最高的论文开始阅读。',
    }


def author_matches(authors: Sequence[str], author_filter: Optional[str]) -> bool:
    if not author_filter:
        return True
    needle = author_filter.lower().strip()
    return any(needle in author.lower() for author in authors)


def venue_matches(venue: str, venue_filter: Optional[str]) -> bool:
    if not venue_filter:
        return True
    return venue_filter.lower().strip() in venue.lower()


def get_domain_query(domain_queries: Sequence[DomainQuery], domain_name: Optional[str]) -> Optional[DomainQuery]:
    if not domain_name:
        return None
    normalized = domain_name.strip().lower()
    for domain in domain_queries:
        if domain.domain.lower() == normalized:
            return domain
    for domain in domain_queries:
        if normalized in domain.domain.lower():
            return domain
    raise SystemExit(f'Unknown domain: {domain_name}')


def choose_best_domain(
    paper: Dict[str, Any],
    domain_queries: Sequence[DomainQuery],
    preferred_signals: Sequence[str],
    excluded_keywords: Sequence[str],
    note_index: ExistingNoteIndex,
    target_date: datetime,
) -> Optional[Dict[str, Any]]:
    title = normalize_text(paper.get('title') or '')
    abstract = normalize_text(paper.get('abstract') or '')
    if not title:
        return None

    combined = f'{title.lower()}\n{abstract.lower()}'
    for blocked in excluded_keywords:
        if blocked.lower() in combined:
            return None

    best: Optional[Dict[str, Any]] = None
    for domain in domain_queries:
        weighted_relevance, matched_keywords = compute_weighted_relevance_score(title, abstract, domain.keywords)
        if weighted_relevance <= 0:
            continue
        relevance_score = min(weighted_relevance + 1.0, 3.0)

        publication_date = parse_date(paper.get('publicationDate'))
        days_old = (target_date - publication_date).days if publication_date else None
        citation_count = int(paper.get('citationCount') or 0)
        influential_count = int(paper.get('influentialCitationCount') or 0)
        venue = normalize_text(paper.get('venue') or '')
        venue_score, venue_matches = compute_venue_score(venue, preferred_signals)
        recency_score = compute_recency_score(publication_date, target_date)
        popularity_score = compute_popularity_score(citation_count, influential_count, days_old)
        quality_score, quality_signals = compute_quality_score(abstract)
        existing_path = find_existing_note(paper, title, note_index)
        source_window = str(paper.get('_source_window') or 'recent')
        generic_keyword_hits = sum(
            1 for keyword in matched_keywords if normalize_key(keyword) in {'bci', 'eeg', 'fmri', 'ecog'}
        )

        total = (
            (relevance_score / 3.0) * 4.0
            + (recency_score / 3.0) * 2.0
            + (popularity_score / 3.0) * 3.0
            + (quality_score / 3.0) * 1.0
        )
        if source_window == 'hot' and citation_count > 0:
            total += 0.35
        if source_window == 'recent' and recency_score >= 2.0:
            total += 0.15
        if generic_keyword_hits and len(matched_keywords) == generic_keyword_hits:
            total -= min(0.25 * generic_keyword_hits, 0.5)
        total += min(venue_score, 1.0) * 0.15
        if not existing_path:
            total += 0.15

        candidate = {
            'domain': domain.domain,
            'matched_keywords': matched_keywords[:8],
            'relevance_score': round(relevance_score, 2),
            'recency_score': round(recency_score, 2),
            'popularity_score': round(popularity_score, 2),
            'quality_score': round(quality_score, 2),
            'venue_score': round(venue_score, 2),
            'venue_matches': venue_matches[:5],
            'quality_signals': quality_signals,
            'recommendation_score': round(clamp_score(total), 2),
            'existing_note': existing_path,
            'source_window': source_window,
        }

        if best is None or candidate['recommendation_score'] > best['recommendation_score']:
            best = candidate
    return best


def dedupe_papers(papers: Iterable[Dict[str, Any]]) -> List[Dict[str, Any]]:
    deduped: List[Dict[str, Any]] = []
    seen_keys = set()
    for paper in papers:
        paper_id = paper.get('paperId')
        title = normalize_key(paper.get('title') or '')
        key = paper_id or title
        if not key or key in seen_keys:
            continue
        seen_keys.add(key)
        deduped.append(paper)
    return deduped


def select_diverse_top_papers(
    ranked: Sequence[Dict[str, Any]],
    top_n: int,
    max_per_domain: int,
) -> List[Dict[str, Any]]:
    selected: List[Dict[str, Any]] = []
    domain_counts: Dict[str, int] = {}

    for paper in ranked:
        domain = str(paper.get('matchedDomain') or 'unknown')
        if domain_counts.get(domain, 0) >= max_per_domain:
            continue
        selected.append(paper)
        domain_counts[domain] = domain_counts.get(domain, 0) + 1
        if len(selected) >= top_n:
            return selected

    selected_keys = {
        str(paper.get('paperId') or normalize_key(paper.get('title') or '')) for paper in selected
    }
    for paper in ranked:
        key = str(paper.get('paperId') or normalize_key(paper.get('title') or ''))
        if key in selected_keys:
            continue
        selected.append(paper)
        selected_keys.add(key)
        if len(selected) >= top_n:
            break

    return selected


def parse_markdown_for_linking(content: str) -> List[Tuple[str, str]]:
    rows: List[Tuple[str, str]] = []
    in_frontmatter = False
    frontmatter_markers = 0
    in_code_block = False
    for line in content.splitlines():
        stripped = line.strip()
        if stripped == '---' and not in_code_block:
            frontmatter_markers += 1
            if frontmatter_markers == 1:
                in_frontmatter = True
            elif frontmatter_markers == 2:
                in_frontmatter = False
            rows.append(('skip', line))
            continue
        if in_frontmatter:
            rows.append(('skip', line))
            continue
        if stripped.startswith('```'):
            in_code_block = not in_code_block
            rows.append(('skip', line))
            continue
        if in_code_block or stripped.startswith('#') or '![[' in line or '[[' in line or '](' in line:
            rows.append(('skip', line))
            continue
        rows.append(('text', line))
    return rows


def link_keywords_in_line(text: str, keyword_index: NoteKeywordIndex) -> str:
    result = text
    ordered_keywords = sorted(keyword_index.keyword_to_paths.keys(), key=len, reverse=True)
    for keyword in ordered_keywords:
        if keyword in LINK_STOPWORDS or len(keyword) < 3 or len(keyword) > 40:
            continue
        note_paths = keyword_index.keyword_to_paths.get(keyword) or []
        if not note_paths:
            continue
        pattern = r'(?<![A-Za-z0-9_\-])' + re.escape(keyword) + r'(?![A-Za-z0-9_\-])'
        matches = list(re.finditer(pattern, result, re.IGNORECASE))
        for match in reversed(matches):
            start, end = match.span()
            original = match.group(0)
            replacement = f'[[{note_paths[0]}|{original}]]'
            result = result[:start] + replacement + result[end:]
    return result


def apply_keyword_links(content: str, keyword_index: NoteKeywordIndex) -> str:
    if not keyword_index.keyword_to_paths:
        return content
    output_lines: List[str] = []
    for kind, line in parse_markdown_for_linking(content):
        if kind == 'text':
            output_lines.append(link_keywords_in_line(line, keyword_index))
        else:
            output_lines.append(line)
    return '\n'.join(output_lines) + ('\n' if content.endswith('\n') else '')


def load_payload(path: Path) -> Dict[str, Any]:
    with path.open('r', encoding='utf-8') as handle:
        payload = json.load(handle)
    if not isinstance(payload, dict):
        raise ValueError(f'Expected JSON object in {path}')
    return payload


def collect_domain_papers(
    client: SemanticScholarClient,
    domain: DomainQuery,
    per_domain: int,
    date_from: str,
    date_to: str,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
    attempts: List[Dict[str, Any]] = []
    combined: List[Dict[str, Any]] = []

    primary = client.search(query=domain.query, limit=per_domain, date_from=date_from, date_to=date_to)
    attempts.append({'query': domain.query, 'raw_results': len(primary)})
    combined.extend(primary)

    if len(primary) >= 2:
        return dedupe_papers(combined), attempts

    fallback_keywords = []
    for keyword in domain.keywords:
        if keyword not in fallback_keywords:
            fallback_keywords.append(keyword)
        if len(fallback_keywords) >= 2:
            break

    for keyword in fallback_keywords:
        fallback_query = keyword
        fallback = client.search(query=fallback_query, limit=max(3, per_domain // 2), date_from=date_from, date_to=date_to)
        attempts.append({'query': fallback_query, 'raw_results': len(fallback)})
        combined.extend(fallback)
        if len(dedupe_papers(combined)) >= per_domain:
            break

    return dedupe_papers(combined), attempts


def search_mode(
    client: SemanticScholarClient,
    query: str,
    days: int,
    limit: int,
    author_filter: Optional[str] = None,
    venue_filter: Optional[str] = None,
    config_path: Optional[Path] = None,
    domain_name: Optional[str] = None,
) -> Dict[str, Any]:
    target_date = datetime.now(timezone.utc)
    date_from = (target_date - timedelta(days=days)).strftime('%Y-%m-%d')
    date_to = target_date.strftime('%Y-%m-%d')
    domain_query: Optional[DomainQuery] = None
    domain_queries: List[DomainQuery] = []
    if config_path:
        domain_queries = build_domain_queries(load_yaml(config_path))
        domain_query = get_domain_query(domain_queries, domain_name)

    effective_query = query
    if domain_query:
        effective_query = domain_query.query if not query else f'({query}) AND ({domain_query.query})'

    fetch_limit = max(limit * 4, 20) if (author_filter or venue_filter or domain_query) else limit
    papers = client.search(query=effective_query, limit=fetch_limit, date_from=date_from, date_to=date_to)
    results = []
    for paper in papers:
        publication_date = parse_date(paper.get('publicationDate'))
        authors = [author.get('name') for author in (paper.get('authors') or []) if author.get('name')]
        venue = paper.get('venue') or ''
        if not author_matches(authors, author_filter):
            continue
        if not venue_matches(venue, venue_filter):
            continue

        matched_keywords: List[str] = []
        domain_match = None
        if domain_query:
            combined = f"{normalize_text(paper.get('title') or '').lower()}\n{normalize_text(paper.get('abstract') or '').lower()}"
            relevance, matched_keywords = domain_match_score(combined, domain_query.keywords)
            if relevance <= 0:
                continue
            domain_match = domain_query.domain

        results.append(
            {
                'paperId': paper.get('paperId'),
                'title': paper.get('title'),
                'abstract': paper.get('abstract'),
                'publicationDate': iso_date(publication_date),
                'year': paper.get('year'),
                'venue': venue,
                'url': paper.get('url') or (paper.get('openAccessPdf') or {}).get('url'),
                'citationCount': paper.get('citationCount') or 0,
                'influentialCitationCount': paper.get('influentialCitationCount') or 0,
                'authors': authors,
                'fieldsOfStudy': paper.get('fieldsOfStudy') or [],
                'matchedDomain': domain_match,
                'matchedKeywords': matched_keywords,
            }
        )
        if len(results) >= limit:
            break

    return {
        'mode': 'search',
        'query': query,
        'effective_query': effective_query,
        'date_range': {'from': date_from, 'to': date_to},
        'filters': {
            'author': author_filter,
            'venue': venue_filter,
            'domain': domain_query.domain if domain_query else None,
        },
        'result_count': len(results),
        'papers': results,
    }


def recommend_mode(
    client: SemanticScholarClient,
    config_path: Path,
    vault_path: Optional[Path],
    days: int,
    hot_days: int,
    recent_cutoff_days: int,
    per_domain: int,
    top_n: int,
    max_per_domain: int,
    target_date: datetime,
) -> Dict[str, Any]:
    config = load_yaml(config_path)
    if hot_days <= recent_cutoff_days:
        raise SystemExit('--hot-days must be larger than --recent-cutoff-days')
    domain_queries = build_domain_queries(config)
    if not domain_queries:
        raise SystemExit(f'No research domains found in {config_path}')

    preferred_signals = [str(item) for item in (config.get('preferred_venues_or_signals') or []) if str(item).strip()]
    excluded_keywords = [str(item) for item in (config.get('excluded_keywords') or []) if str(item).strip()]
    note_index = load_existing_notes(vault_path)

    recent_from = (target_date - timedelta(days=days)).strftime('%Y-%m-%d')
    recent_to = target_date.strftime('%Y-%m-%d')
    hot_start_dt = target_date - timedelta(days=hot_days)
    hot_end_dt = target_date - timedelta(days=recent_cutoff_days + 1)
    hot_from = hot_start_dt.strftime('%Y-%m-%d')
    hot_to = hot_end_dt.strftime('%Y-%m-%d')

    collected: List[Dict[str, Any]] = []
    query_log: List[Dict[str, Any]] = []
    for domain in domain_queries:
        recent_papers, recent_attempts = collect_domain_papers(
            client=client,
            domain=domain,
            per_domain=per_domain,
            date_from=recent_from,
            date_to=recent_to,
        )
        hot_papers, hot_attempts = collect_domain_papers(
            client=client,
            domain=domain,
            per_domain=max(4, per_domain // 2),
            date_from=hot_from,
            date_to=hot_to,
        )
        query_log.append(
            {
                'domain': domain.domain,
                'recent_window': {
                    'from': recent_from,
                    'to': recent_to,
                    'attempts': recent_attempts,
                    'raw_results': len(recent_papers),
                },
                'hot_window': {
                    'from': hot_from,
                    'to': hot_to,
                    'attempts': hot_attempts,
                    'raw_results': len(hot_papers),
                },
            }
        )
        for paper in recent_papers:
            paper['_source_domain'] = domain.domain
            paper['_source_window'] = 'recent'
            collected.append(paper)
        for paper in hot_papers:
            paper['_source_domain'] = domain.domain
            paper['_source_window'] = 'hot'
            collected.append(paper)

    ranked = []
    for paper in dedupe_papers(collected):
        best = choose_best_domain(
            paper=paper,
            domain_queries=domain_queries,
            preferred_signals=preferred_signals,
            excluded_keywords=excluded_keywords,
            note_index=note_index,
            target_date=target_date,
        )
        if best is None:
            continue
        publication_date = parse_date(paper.get('publicationDate'))
        summary = summarize_paper(paper)
        ranked.append(
            {
                'paperId': paper.get('paperId'),
                'title': normalize_text(paper.get('title') or ''),
                'abstract': normalize_text(paper.get('abstract') or ''),
                'publicationDate': iso_date(publication_date),
                'year': paper.get('year'),
                'venue': normalize_text(paper.get('venue') or ''),
                'url': extract_primary_url(paper),
                'pdfUrl': extract_pdf_url(paper),
                'arxivUrl': extract_arxiv_url(paper),
                'source': infer_source_label(paper),
                'citationCount': int(paper.get('citationCount') or 0),
                'influentialCitationCount': int(paper.get('influentialCitationCount') or 0),
                'authors': [author.get('name') for author in (paper.get('authors') or []) if author.get('name')],
                'institutions': extract_institutions(paper),
                'fieldsOfStudy': paper.get('fieldsOfStudy') or [],
                'externalIds': paper.get('externalIds') or {},
                'matchedDomain': best['domain'],
                'matchedKeywords': best['matched_keywords'],
                'existingNote': best['existing_note'],
                'scores': {
                    'relevance': best['relevance_score'],
                    'recency': best['recency_score'],
                    'popularity': best['popularity_score'],
                    'quality': best['quality_score'],
                    'venue': best['venue_score'],
                    'recommendation': best['recommendation_score'],
                },
                'venueMatches': best['venue_matches'],
                'qualitySignals': best['quality_signals'],
                'oneLineSummary': summary['one_line_summary'],
                'coreContributions': summary['core_contributions'],
                'keyResult': summary['key_result'],
                'readingPriority': build_reading_priority(best['recommendation_score']),
                'isTopPick': best['recommendation_score'] >= 7.5,
                'sourceWindow': best['source_window'],
                'noteLookup': {
                    'paperId': paper.get('paperId'),
                    'titleKey': normalize_key(paper.get('title') or ''),
                    'titleKeywords': title_keywords(paper.get('title') or ''),
                },
            }
        )

    ranked.sort(
        key=lambda item: (
            item['scores']['recommendation'],
            item['scores'].get('popularity', 0.0),
            item['scores'].get('recency', 0.0),
        ),
        reverse=True,
    )
    top_papers = select_diverse_top_papers(ranked, top_n=top_n, max_per_domain=max_per_domain)
    domain_counts: Dict[str, int] = {}
    for paper in top_papers:
        domain_counts[paper['matchedDomain']] = domain_counts.get(paper['matchedDomain'], 0) + 1

    return {
        'mode': 'recommend',
        'target_date': target_date.strftime('%Y-%m-%d'),
        'date_range': {
            'recent': {'from': recent_from, 'to': recent_to},
            'hot': {'from': hot_from, 'to': hot_to},
        },
        'config_path': str(config_path),
        'vault_path': str(vault_path) if vault_path else None,
        'queried_domains': query_log,
        'candidate_count': len(ranked),
        'selection_policy': {
            'top_n': top_n,
            'max_per_domain': max_per_domain,
            'recent_days': days,
            'hot_days': hot_days,
            'recent_cutoff_days': recent_cutoff_days,
        },
        'top_papers': top_papers,
        'domain_distribution': domain_counts,
        'daily_keywords': extract_daily_keywords(top_papers),
        'overview': build_overview(top_papers),
        'top3_followup_candidates': top_papers[:3],
    }


def summarize_trends(papers: Sequence[Dict[str, Any]]) -> List[str]:
    domain_counts: Dict[str, int] = {}
    keyword_counts: Dict[str, int] = {}
    for paper in papers:
        domain = paper.get('matchedDomain')
        if domain:
            domain_counts[domain] = domain_counts.get(domain, 0) + 1
        for keyword in paper.get('matchedKeywords') or []:
            key = keyword.lower()
            if key in COMMON_STOPWORDS or len(key) < 4:
                continue
            keyword_counts[keyword] = keyword_counts.get(keyword, 0) + 1

    trend_lines: List[str] = []
    if domain_counts:
        ordered_domains = sorted(domain_counts.items(), key=lambda item: item[1], reverse=True)
        trend_lines.append('Top domains: ' + ', '.join(f'{name} ({count})' for name, count in ordered_domains[:3]))
    if keyword_counts:
        ordered_keywords = sorted(keyword_counts.items(), key=lambda item: item[1], reverse=True)
        trend_lines.append('Frequent keywords: ' + ', '.join(name for name, _ in ordered_keywords[:6]))
    return trend_lines


def markdown_link(label: str, url: str) -> str:
    return f'[{label}]({url})' if url else label


def format_markdown_report(payload: Dict[str, Any]) -> str:
    target_date = payload['target_date']
    papers = payload['top_papers']
    keywords = payload.get('daily_keywords') or []
    overview = payload.get('overview') or {}
    main_directions = overview.get('main_directions') or []
    direction_text = '、'.join(f'**{item}**' for item in main_directions[:3]) if main_directions else '**跨领域主题**'
    lines = [
        '---',
        f'keywords: [{", ".join(keywords)}]',
        'tags: ["llm-generated", "daily-paper-recommend"]',
        '---',
        '',
        f'# {target_date}论文推荐',
        '',
        '## 今日概览',
        '',
    ]
    lines.append(f'今日推荐的{overview.get("paper_count", len(papers))}篇论文主要聚焦于{direction_text}等前沿方向。')
    lines.append('')
    lines.append(f'- **总体趋势**：{overview.get("trend_summary") or "整体结果较分散，但仍能看到近期重点方向。"}')
    score_range = overview.get('score_range') or {}
    lines.append(
        f'- **质量分布**：今日推荐的论文评分在 {format_score(score_range.get("min", 0.0))}-{format_score(score_range.get("max", 0.0))} 之间，{overview.get("quality_summary") or "整体质量稳定。"}'
    )
    lines.append('- **研究热点**：')
    hotspots = overview.get('hotspots') or []
    if hotspots:
        for item in hotspots:
            lines.append(f'  - **{item["topic"]}**：{item["description"]}')
    else:
        lines.append('  - **跨主题探索**：当前推荐结果没有高度集中的单一热点。')
    lines.append(f'- **阅读建议**：{overview.get("reading_advice") or "建议按评分从高到低阅读。"}')
    lines.append('')
    lines.append('## 推荐列表')
    lines.append('')

    for paper in papers:
        title = paper['title']
        authors = ', '.join(paper['authors'][:6]) if paper['authors'] else 'Unknown authors'
        institutions = ', '.join(paper.get('institutions') or []) or 'Unknown'
        source = paper.get('source') or 'Semantic Scholar'
        arxiv_link = markdown_link('arXiv', paper.get('arxivUrl') or paper.get('url') or '')
        pdf_link = markdown_link('PDF', paper.get('pdfUrl') or paper.get('url') or '')
        lines.extend([
            f'### [[{title}]]',
            f'- **作者**：[{authors}]',
            f'- **机构**：[{institutions}]',
            f'- **链接**：{arxiv_link} | {pdf_link}',
            f'- **来源**：[{source}]',
        ])
        if paper.get('existingNote'):
            lines.append(f'- **笔记**：[[{paper["existingNote"]}]]')
        else:
            lines.append('- **笔记**：<<无>>')
        lines.append('')
        lines.append(f'**一句话总结**：{paper.get("oneLineSummary") or "See abstract."}')
        lines.append('')
        lines.append('**核心贡献/观点**：')
        for contribution in paper.get('coreContributions') or ['Abstract unavailable.']:
            lines.append(f'- {contribution}')
        lines.append('')
        lines.append(f'**关键结果**：{paper.get("keyResult") or paper.get("oneLineSummary") or "N/A"}')
        lines.append('')
        lines.append(
            f'**评分**：推荐分 {format_score(paper["scores"]["recommendation"])} / 10；相关性 {format_score(paper["scores"].get("relevance", 0.0))}，新近性 {format_score(paper["scores"].get("recency", 0.0))}，热门度 {format_score(paper["scores"].get("popularity", 0.0))}，质量 {format_score(paper["scores"].get("quality", 0.0))}'
        )
        if paper.get('matchedDomain'):
            lines.append(f'**匹配方向**：{paper["matchedDomain"]}')
        if paper.get('sourceWindow') == 'hot':
            lines.append('**候选来源**：过去一年高热度补充池')
        elif paper.get('sourceWindow') == 'recent':
            lines.append('**候选来源**：近期新论文池')
        matched_keywords = ', '.join(paper.get('matchedKeywords') or [])
        if matched_keywords:
            lines.append(f'**命中关键词**：{matched_keywords}')
        if paper.get('qualitySignals'):
            lines.append(f'**质量信号**：{", ".join(paper["qualitySignals"])}')
        if paper.get('readingPriority') == 'high' and not paper.get('existingNote'):
            lines.append('**阅读建议**：值得优先精读，并补充详细分析笔记。')
        elif paper.get('existingNote'):
            lines.append('**阅读建议**：已有相关笔记，建议先查看已有整理。')
        lines.append('')
        lines.append('---')
        lines.append('')

    return '\n'.join(lines).rstrip() + '\n'


def write_json(path: Path, payload: Dict[str, Any]) -> None:
    ensure_parent(path)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding='utf-8')


def write_markdown(path: Path, payload: Dict[str, Any]) -> None:
    ensure_parent(path)
    path.write_text(format_markdown_report(payload), encoding='utf-8')


def write_markdown_with_links(path: Path, payload: Dict[str, Any], vault_path: Optional[Path], link_keywords: bool) -> None:
    ensure_parent(path)
    content = format_markdown_report(payload)
    if link_keywords:
        content = apply_keyword_links(content, build_note_keyword_index(vault_path))
    path.write_text(content, encoding='utf-8')


def resolve_vault_path(explicit: Optional[str]) -> Optional[Path]:
    if explicit:
        return Path(explicit).expanduser().resolve()
    env = os.environ.get('OBSIDIAN_VAULT_PATH')
    if env:
        return Path(env).expanduser().resolve()
    return None


def main() -> int:
    parser = argparse.ArgumentParser(description='Semantic Scholar search and daily recommendations')
    subparsers = parser.add_subparsers(dest='command', required=True)

    search_parser = subparsers.add_parser('search', help='Search recent papers for a query')
    search_parser.add_argument('--query', required=True)
    search_parser.add_argument('--days', type=int, default=180)
    search_parser.add_argument('--limit', type=int, default=10)
    search_parser.add_argument('--author')
    search_parser.add_argument('--venue')
    search_parser.add_argument('--config')
    search_parser.add_argument('--domain')
    search_parser.add_argument('--output-json', required=True)

    recommend_parser = subparsers.add_parser('recommend', help='Recommend papers from research interests')
    recommend_parser.add_argument('--config', required=True)
    recommend_parser.add_argument('--vault')
    recommend_parser.add_argument('--days', type=int, default=DEFAULT_RECENT_DAYS)
    recommend_parser.add_argument('--hot-days', type=int, default=DEFAULT_HOT_DAYS)
    recommend_parser.add_argument('--recent-cutoff-days', type=int, default=DEFAULT_RECENT_CUTOFF_DAYS)
    recommend_parser.add_argument('--per-domain', type=int, default=20)
    recommend_parser.add_argument('--top-n', type=int, default=10)
    recommend_parser.add_argument('--max-per-domain', type=int, default=DEFAULT_MAX_PER_DOMAIN)
    recommend_parser.add_argument('--target-date')
    recommend_parser.add_argument('--output-json', required=True)
    recommend_parser.add_argument('--output-md')
    recommend_parser.add_argument('--link-keywords', action='store_true')

    write_note_parser = subparsers.add_parser('write-note', help='Write a daily note from recommendation JSON')
    write_note_parser.add_argument('--input-json', required=True)
    write_note_parser.add_argument('--output-md', required=True)
    write_note_parser.add_argument('--vault')
    write_note_parser.add_argument('--link-keywords', action='store_true')

    args = parser.parse_args()

    if args.command == 'write-note':
        vault_path = resolve_vault_path(args.vault)
        payload = load_payload(Path(args.input_json).expanduser().resolve())
        write_markdown_with_links(
            Path(args.output_md).expanduser().resolve(),
            payload,
            vault_path,
            link_keywords=bool(args.link_keywords),
        )
        print(json.dumps({'output_md': str(Path(args.output_md).expanduser().resolve())}, ensure_ascii=False, indent=2))
        return 0

    api_key = os.environ.get('SEMANTIC_SCHOLAR_API_KEY')
    if not api_key:
        print('SEMANTIC_SCHOLAR_API_KEY is not set.', file=sys.stderr)
        return 1

    client = SemanticScholarClient(api_key=api_key)

    if args.command == 'search':
        payload = search_mode(
            client=client,
            query=args.query,
            days=args.days,
            limit=args.limit,
            author_filter=args.author,
            venue_filter=args.venue,
            config_path=Path(args.config).expanduser().resolve() if args.config else None,
            domain_name=args.domain,
        )
        write_json(Path(args.output_json), payload)
        print(json.dumps(payload, ensure_ascii=False, indent=2))
        return 0

    target_date = datetime.now(timezone.utc)
    if args.target_date:
        try:
            target_date = datetime.strptime(args.target_date, '%Y-%m-%d').replace(tzinfo=timezone.utc)
        except ValueError:
            print(f'Invalid --target-date: {args.target_date}', file=sys.stderr)
            return 1

    vault_path = resolve_vault_path(args.vault)
    payload = recommend_mode(
        client=client,
        config_path=Path(args.config).expanduser().resolve(),
        vault_path=vault_path,
        days=args.days,
        hot_days=args.hot_days,
        recent_cutoff_days=args.recent_cutoff_days,
        per_domain=args.per_domain,
        top_n=args.top_n,
        max_per_domain=args.max_per_domain,
        target_date=target_date,
    )
    write_json(Path(args.output_json), payload)
    if args.output_md:
        write_markdown_with_links(Path(args.output_md), payload, vault_path, link_keywords=bool(args.link_keywords))
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
