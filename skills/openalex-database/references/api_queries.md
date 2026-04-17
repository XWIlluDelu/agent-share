# OpenAlex API Queries — Complete Code Reference

## Query 1: Works Search (with Filters and Pagination)

```python
import requests, pandas as pd

BASE = "https://api.openalex.org"

def search_works(query, filters=None, per_page=25, mailto="your@email.com"):
    params = {"search": query, "per_page": per_page, "mailto": mailto}
    if filters:
        params["filter"] = ",".join(f"{k}:{v}" for k, v in filters.items())
    r = requests.get(f"{BASE}/works", params=params)
    r.raise_for_status()
    return r.json()

# Search open-access scRNA-seq papers
data = search_works("single-cell RNA sequencing",
                    filters={"publication_year": "2020-2024",
                             "open_access.is_oa": "true"},
                    per_page=10)

print(f"Open-access scRNA-seq papers 2020-2024: {data['meta']['count']}")
rows = []
for w in data["results"]:
    rows.append({
        "title": w["title"],
        "year": w["publication_year"],
        "citations": w["cited_by_count"],
        "doi": w.get("doi"),
        "oa_url": w.get("open_access", {}).get("oa_url"),
    })
df = pd.DataFrame(rows)
print(df[["title", "year", "citations"]].head())
```

```python
def paginate_works(query, filters=None, max_results=200, mailto="your@email.com"):
    """Retrieve up to max_results works using cursor-based pagination."""
    all_results = []
    cursor = "*"
    while len(all_results) < max_results:
        params = {"search": query, "per_page": 200,
                  "cursor": cursor, "mailto": mailto}
        if filters:
            params["filter"] = ",".join(f"{k}:{v}" for k, v in filters.items())
        r = requests.get(f"{BASE}/works", params=params)
        data = r.json()
        all_results.extend(data["results"])
        cursor = data["meta"].get("next_cursor")
        if not cursor:
            break
    return all_results[:max_results]

papers = paginate_works("transformer protein structure", max_results=100)
print(f"Retrieved {len(papers)} papers")
```

## Query 2: Lookup by DOI or OpenAlex ID

```python
import requests

BASE = "https://api.openalex.org"

# By DOI
doi = "10.1038/s41592-019-0458-z"  # Scanpy paper
r = requests.get(f"{BASE}/works/https://doi.org/{doi}",
                 params={"mailto": "your@email.com"})
r.raise_for_status()
work = r.json()

print(f"Title   : {work['title']}")
print(f"Year    : {work['publication_year']}")
print(f"Citations: {work['cited_by_count']}")
print(f"Journal : {work.get('primary_location', {}).get('source', {}).get('display_name')}")

# Reconstruct abstract from inverted index
abstract = work.get("abstract_inverted_index")
if abstract:
    words = {pos: word for word, positions in abstract.items() for pos in positions}
    text = " ".join(words[i] for i in sorted(words))
    print(f"Abstract (first 200): {text[:200]}")
```

## Query 3: Author Search and ORCID Lookup

```python
import requests, pandas as pd

BASE = "https://api.openalex.org"

# Search for an author
r = requests.get(f"{BASE}/authors",
                 params={"search": "Jennifer Doudna",
                         "per_page": 5,
                         "mailto": "your@email.com"})
authors = r.json()["results"]

for a in authors[:3]:
    print(f"Author: {a['display_name']}")
    print(f"  OpenAlex ID : {a['id']}")
    print(f"  ORCID       : {a.get('orcid', 'n/a')}")
    print(f"  Institution : {a.get('last_known_institution', {}).get('display_name', 'n/a')}")
    print(f"  Works count : {a['works_count']}")
    print(f"  h-index     : {a['summary_stats'].get('h_index', 'n/a')}")
```

```python
# Get all papers by an author (by ORCID)
orcid = "0000-0001-8742-3594"  # Jennifer Doudna
r = requests.get(f"{BASE}/works",
                 params={"filter": f"author.orcid:{orcid}",
                         "sort": "cited_by_count:desc",
                         "per_page": 10,
                         "mailto": "your@email.com"})
papers = r.json()["results"]
for p in papers[:5]:
    print(f"  [{p['publication_year']}] {p['title'][:70]} (cites: {p['cited_by_count']})")
```

## Query 4: Citation Network Retrieval

```python
import requests

BASE = "https://api.openalex.org"

work_id = "W2018426904"  # Example paper

# Get what this paper references
r = requests.get(f"{BASE}/works/{work_id}",
                 params={"select": "referenced_works,cited_by_count,title",
                         "mailto": "your@email.com"})
work = r.json()
ref_ids = work.get("referenced_works", [])
print(f"'{work['title']}' cites {len(ref_ids)} papers")
print(f"Total citations: {work['cited_by_count']}")

# Fetch metadata for references (batch)
if ref_ids:
    ids_str = "|".join(id.split("/")[-1] for id in ref_ids[:10])
    r2 = requests.get(f"{BASE}/works",
                      params={"filter": f"openalex_id:{ids_str}",
                              "per_page": 10,
                              "mailto": "your@email.com"})
    refs = r2.json()["results"]
    for ref in refs[:5]:
        print(f"  [{ref['publication_year']}] {ref['title'][:70]}")
```

## Query 5: Concept/Topic Filtering and Trend Analysis

```python
import requests, pandas as pd

BASE = "https://api.openalex.org"

# Get concept ID for "Machine Learning"
r = requests.get(f"{BASE}/concepts",
                 params={"search": "machine learning biology",
                         "per_page": 3,
                         "mailto": "your@email.com"})
for c in r.json()["results"][:3]:
    print(f"Concept: {c['display_name']} (ID: {c['id']}, level: {c['level']})")

# Count papers per year for a concept
concept_id = "C154945302"  # Machine learning
r2 = requests.get(f"{BASE}/works",
                  params={"filter": f"concepts.id:{concept_id},publication_year:2015-2024",
                          "group_by": "publication_year",
                          "per_page": 200,
                          "mailto": "your@email.com"})
groups = r2.json()["group_by"]
df = pd.DataFrame(groups).rename(columns={"key": "year", "count": "papers"})
df = df.sort_values("year")
print(df.tail(5).to_string(index=False))
```

## Query 6: Institution and Venue Queries

```python
import requests

BASE = "https://api.openalex.org"

# Papers from a specific journal in the last year
r = requests.get(f"{BASE}/works",
                 params={"filter": "primary_location.source.issn:0028-0836,publication_year:2023",
                         "per_page": 10,
                         "sort": "cited_by_count:desc",
                         "mailto": "your@email.com"})
data = r.json()
print(f"Nature papers 2023: {data['meta']['count']}")
for w in data["results"][:5]:
    print(f"  [{w['cited_by_count']} cites] {w['title'][:70]}")
```

---

## Workflow 1: Systematic Literature Search

```python
import requests, time, pandas as pd

BASE = "https://api.openalex.org"
MAILTO = "your@email.com"

def systematic_search(query, year_from, year_to, max_results=500):
    """Paginate through results and return a DataFrame."""
    all_results = []
    cursor = "*"
    filters = f"publication_year:{year_from}-{year_to}"

    while len(all_results) < max_results:
        r = requests.get(f"{BASE}/works",
                         params={"search": query, "filter": filters,
                                 "per_page": 200, "cursor": cursor,
                                 "mailto": MAILTO,
                                 "select": "id,doi,title,publication_year,cited_by_count,open_access"})
        r.raise_for_status()
        data = r.json()
        all_results.extend(data["results"])
        cursor = data["meta"].get("next_cursor")
        if not cursor:
            break
        time.sleep(0.1)

    rows = []
    for w in all_results[:max_results]:
        rows.append({
            "openalex_id": w["id"],
            "doi": w.get("doi"),
            "title": w.get("title"),
            "year": w.get("publication_year"),
            "citations": w.get("cited_by_count"),
            "is_oa": w.get("open_access", {}).get("is_oa"),
            "oa_url": w.get("open_access", {}).get("oa_url"),
        })
    return pd.DataFrame(rows)

df = systematic_search("drug repurposing machine learning", 2019, 2024, max_results=200)
df.to_csv("drug_repurposing_literature.csv", index=False)
print(f"Retrieved {len(df)} papers")
print(df[["title", "year", "citations", "is_oa"]].head(5).to_string(index=False))
```

## Workflow 2: Author Collaboration Network

```python
import requests, time, pandas as pd
from collections import defaultdict

BASE = "https://api.openalex.org"
MAILTO = "your@email.com"

def get_author_works(orcid, max_papers=50):
    r = requests.get(f"{BASE}/works",
                     params={"filter": f"author.orcid:{orcid}",
                             "sort": "cited_by_count:desc",
                             "per_page": min(max_papers, 200),
                             "mailto": MAILTO})
    r.raise_for_status()
    return r.json()["results"]

def extract_collaborators(works):
    collab_count = defaultdict(int)
    for work in works:
        for authorship in work.get("authorships", []):
            name = authorship.get("author", {}).get("display_name")
            if name:
                collab_count[name] += 1
    return collab_count

orcid = "0000-0001-8742-3594"
works = get_author_works(orcid, max_papers=50)
collabs = extract_collaborators(works)

top_collabs = sorted(collabs.items(), key=lambda x: -x[1])
df = pd.DataFrame(top_collabs, columns=["collaborator", "papers_together"])
print("Top collaborators:")
print(df.head(10).to_string(index=False))
df.to_csv("collaboration_network.csv", index=False)
```

---

## Recipe: DOI to Metadata Batch Lookup

```python
import requests, pandas as pd, time

BASE = "https://api.openalex.org"

dois = [
    "10.1038/s41592-019-0458-z",
    "10.1186/s13059-021-02519-4",
    "10.1038/s41587-019-0071-9",
]

rows = []
for doi in dois:
    r = requests.get(f"{BASE}/works/https://doi.org/{doi}",
                     params={"select": "title,publication_year,cited_by_count,open_access",
                             "mailto": "your@email.com"})
    if r.ok:
        w = r.json()
        rows.append({
            "doi": doi, "title": w.get("title"),
            "year": w.get("publication_year"),
            "citations": w.get("cited_by_count"),
            "is_oa": w.get("open_access", {}).get("is_oa"),
        })
    time.sleep(0.1)

df = pd.DataFrame(rows)
print(df.to_string(index=False))
```

## Recipe: Count Papers by Country

```python
import requests, pandas as pd

r = requests.get(
    "https://api.openalex.org/works",
    params={"search": "CRISPR therapeutics",
            "filter": "publication_year:2023",
            "group_by": "authorships.institutions.country_code",
            "per_page": 200,
            "mailto": "your@email.com"}
)
df = pd.DataFrame(r.json()["group_by"]).rename(columns={"key": "country", "count": "papers"})
print(df.sort_values("papers", ascending=False).head(10).to_string(index=False))
```

## Recipe: Find Most-Cited Papers in a Field

```python
import requests

r = requests.get(
    "https://api.openalex.org/works",
    params={"search": "protein language model",
            "sort": "cited_by_count:desc",
            "per_page": 10,
            "mailto": "your@email.com"}
)
for w in r.json()["results"]:
    print(f"[{w['cited_by_count']:5d} cites] ({w['publication_year']}) {w['title'][:70]}")
```
