# PubMed E-utilities API Reference

## Setup Helper

```python
import requests, time

BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
API_KEY = "YOUR_API_KEY"

def pubmed_request(endpoint, params):
    params.setdefault("api_key", API_KEY)
    response = requests.get(f"{BASE_URL}{endpoint}", params=params)
    response.raise_for_status()
    time.sleep(0.1 if API_KEY != "YOUR_API_KEY" else 0.34)
    return response
```

## 1. ESearch — Search and Retrieve PMIDs

```python
# Basic search
resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed",
    "term": "CRISPR[tiab] AND genome editing[tiab] AND 2024[dp]",
    "retmax": 100,
    "retmode": "json",
    "sort": "relevance",  # or "pub_date", "first_author"
})
result = resp.json()["esearchresult"]
pmids = result["idlist"]
total = result["count"]
print(f"Total hits: {total}, Retrieved: {len(pmids)}")

# With history server (for large result sets > 500)
resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed",
    "term": "cancer AND 2024[dp]",
    "usehistory": "y",
    "retmode": "json",
})
result = resp.json()["esearchresult"]
webenv = result["webenv"]
query_key = result["querykey"]
total = int(result["count"])
print(f"Stored {total} results on history server")
```

## 2. EFetch — Download Full Records

```python
# Fetch abstracts as text
resp = pubmed_request("efetch.fcgi", {
    "db": "pubmed",
    "id": ",".join(pmids[:10]),
    "rettype": "abstract",
    "retmode": "text",
})
print(resp.text[:500])

# Fetch XML for structured parsing
resp = pubmed_request("efetch.fcgi", {
    "db": "pubmed",
    "id": ",".join(pmids[:10]),
    "rettype": "xml",
    "retmode": "xml",
})

# Fetch from history server (batch processing)
batch_size = 500
for start in range(0, total, batch_size):
    resp = pubmed_request("efetch.fcgi", {
        "db": "pubmed",
        "query_key": query_key,
        "WebEnv": webenv,
        "retstart": start,
        "retmax": batch_size,
        "rettype": "xml",
        "retmode": "xml",
    })
    print(f"Fetched records {start}–{start + batch_size}")
    time.sleep(0.5)
```

## 3. ESummary and ELink

```python
# ESummary — lightweight document summaries
resp = pubmed_request("esummary.fcgi", {
    "db": "pubmed",
    "id": ",".join(pmids[:5]),
    "retmode": "json",
})
for uid, data in resp.json()["result"].items():
    if uid == "uids":
        continue
    print(f"PMID {uid}: {data.get('title', '')[:80]}")
    print(f"  Journal: {data.get('fulljournalname', '')}, "
          f"Date: {data.get('pubdate', '')}")

# ELink — find related articles
resp = pubmed_request("elink.fcgi", {
    "dbfrom": "pubmed",
    "db": "pubmed",
    "id": pmids[0],
    "cmd": "neighbor",
    "retmode": "json",
})

# Links to PubMed Central
resp = pubmed_request("elink.fcgi", {
    "dbfrom": "pubmed",
    "db": "pmc",
    "id": pmids[0],
    "retmode": "json",
})
```

## 4. Citation Matching (ECitMatch)

```python
# ECitMatch — match partial citations to PMIDs
# Format: journal|year|volume|first_page|author_name|key|
citation = "Science|2008|320|5880|1185|key1|"
resp = pubmed_request("ecitmatch.cgi", {
    "db": "pubmed",
    "rettype": "xml",
    "bdata": citation,
})
print(f"Matched PMID: {resp.text.strip()}")

# Batch citation matching
citations = [
    "Nature|2020|580|7801|71|ref1|",
    "Science|2019|366|6463|347|ref2|",
]
resp = pubmed_request("ecitmatch.cgi", {
    "db": "pubmed",
    "rettype": "xml",
    "bdata": "\r".join(citations),
})
```

## 5. Publication Type Filtering

```python
# Filter by publication type
type_filters = {
    "rcts": "randomized controlled trial[pt]",
    "reviews": "systematic review[pt]",
    "meta": "meta-analysis[pt]",
    "guidelines": "guideline[pt]",
    "case_reports": "case reports[pt]",
}

# Filter by text availability
availability = {
    "free_text": "free full text[sb]",
    "has_abstract": "hasabstract[text]",
}

# Combine filters
query = (
    "diabetes mellitus[mh] AND "
    "randomized controlled trial[pt] AND "
    "2023:2024[dp] AND "
    "free full text[sb] AND "
    "english[la]"
)
resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed", "term": query, "retmax": 100, "retmode": "json"
})
print(f"Free RCTs on diabetes (2023-2024): {resp.json()['esearchresult']['count']}")
```

## 6. Search by Identifier

```python
# Search by specific identifier types
id_queries = {
    "pmid": "12345678[pmid]",
    "doi": "10.1056/NEJMoa123456[doi]",
    "pmc": "PMC123456[pmc]",
}

# Example: fetch by DOI
resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed",
    "term": "10.1056/NEJMoa2034577[doi]",
    "retmode": "json"
})
pmids = resp.json()["esearchresult"]["idlist"]
```
