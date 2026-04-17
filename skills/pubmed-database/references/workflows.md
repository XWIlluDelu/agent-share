# PubMed Common Workflows and Recipes

## Workflow 1: Systematic Review Search

```python
import requests, time, xml.etree.ElementTree as ET

BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/"
API_KEY = "YOUR_API_KEY"

def pubmed_request(endpoint, params):
    params.setdefault("api_key", API_KEY)
    response = requests.get(f"{BASE_URL}{endpoint}", params=params)
    response.raise_for_status()
    time.sleep(0.1 if API_KEY != "YOUR_API_KEY" else 0.34)
    return response

# 1. Define PICO-structured query
query = (
    # Population
    "(diabetes mellitus, type 2[mh] OR type 2 diabetes[tiab]) AND "
    # Intervention + Comparison
    "(metformin[nm] OR lifestyle modification[tiab]) AND "
    # Outcome
    "(glycemic control[tiab] OR HbA1c[tiab]) AND "
    # Study design filter
    "(randomized controlled trial[pt] OR systematic review[pt]) AND "
    # Date range
    "2020:2024[dp]"
)

# 2. Search with history server
resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed", "term": query,
    "usehistory": "y", "retmode": "json"
})
result = resp.json()["esearchresult"]
total = int(result["count"])
print(f"Systematic review hits: {total}")

# 3. Batch fetch all results as XML
articles = []
for start in range(0, total, 200):
    resp = pubmed_request("efetch.fcgi", {
        "db": "pubmed", "query_key": result["querykey"],
        "WebEnv": result["webenv"],
        "retstart": start, "retmax": 200,
        "rettype": "xml", "retmode": "xml"
    })
    root = ET.fromstring(resp.text)
    for article in root.findall('.//PubmedArticle'):
        pmid = article.findtext('.//PMID')
        title = article.findtext('.//ArticleTitle')
        abstract = article.findtext('.//AbstractText')
        articles.append({"pmid": pmid, "title": title, "abstract": abstract})
    time.sleep(0.5)

print(f"Retrieved {len(articles)} articles for screening")
```

## Workflow 2: Literature Monitoring Pipeline

```python
import json, datetime

# 1. Construct monitoring query
topic_query = (
    "(CRISPR[tiab] OR gene editing[tiab]) AND "
    "(therapeutics[tiab] OR clinical trial[pt])"
)

# 2. Search recent publications (last 30 days)
today = datetime.date.today()
start_date = today - datetime.timedelta(days=30)
query = f"{topic_query} AND {start_date.strftime('%Y/%m/%d')}:{today.strftime('%Y/%m/%d')}[dp]"

resp = pubmed_request("esearch.fcgi", {
    "db": "pubmed", "term": query,
    "retmax": 100, "retmode": "json", "sort": "pub_date"
})
pmids = resp.json()["esearchresult"]["idlist"]

# 3. Get summaries for new articles
if pmids:
    resp = pubmed_request("esummary.fcgi", {
        "db": "pubmed", "id": ",".join(pmids), "retmode": "json"
    })
    for uid in pmids:
        info = resp.json()["result"].get(uid, {})
        print(f"[{uid}] {info.get('title', 'N/A')[:80]}")
        print(f"  {info.get('fulljournalname', '')} — {info.get('pubdate', '')}")
```

---

## Recipe: Download Abstracts for a Gene Set

```python
import requests, time

def fetch_abstracts(gene_list, max_per_gene=5):
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    records = []
    for gene in gene_list:
        r = requests.get(f"{base}/esearch.fcgi",
                         params={"db": "pubmed", "term": f"{gene}[gene] AND Homo sapiens[orgn]",
                                 "retmax": max_per_gene, "retmode": "json"})
        ids = r.json()["esearchresult"]["idlist"]
        if ids:
            fetch = requests.get(f"{base}/efetch.fcgi",
                                 params={"db": "pubmed", "id": ",".join(ids), "rettype": "abstract"})
            records.append({"gene": gene, "pmids": ids, "text": fetch.text[:500]})
        time.sleep(0.34)
    return records

results = fetch_abstracts(["BRCA1", "TP53", "EGFR"])
for r in results:
    print(f"{r['gene']}: {r['pmids']}")
```

## Recipe: Track New Publications via Date Filter

```python
import requests
from datetime import date, timedelta

week_ago = (date.today() - timedelta(days=7)).strftime("%Y/%m/%d")
today = date.today().strftime("%Y/%m/%d")

resp = requests.get("https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi",
                    params={"db": "pubmed", "term": "CRISPR AND cancer",
                            "datetype": "pdat", "mindate": week_ago, "maxdate": today,
                            "retmax": 20, "retmode": "json"})
data = resp.json()["esearchresult"]
print(f"New CRISPR+cancer papers this week: {data['count']}")
print("PMIDs:", data["idlist"])
```
