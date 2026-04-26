import urllib.request
import urllib.parse
import json
import time

BASE = "https://api.semanticscholar.org/graph/v1"
API_KEY = "s2k-VMbB6bhghy9xvQg0AcslvmVasNnv86IXBChQAE9C"
QUERY = "cellular senescence beta-galactosidase assay"
OUTPUT_FILE = "semantic-scholar-results.json"

FIELDS = "title,authors,year,abstract,tldr,citationCount,externalIds,openAccessPdf"


def get(path, params={}, retries=3):
    url = f"{BASE}{path}?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": "BenchPilot/0.1 (hackathon research tool)",
        "x-api-key": API_KEY,
    })
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(req) as res:
                return json.loads(res.read())
        except urllib.error.HTTPError as e:
            if e.code == 429:
                wait = 30 * (attempt + 1)
                print(f"  Rate limited, waiting {wait}s...")
                time.sleep(wait)
            else:
                print(f"  HTTP {e.code}: {e.read().decode()[:200]}")
                raise
    raise Exception("Max retries exceeded")


def literature_review(hypothesis: str, limit: int = 20) -> dict:
    print(f"\n=== Literature review: '{hypothesis[:80]}' ===")

    results = get("/paper/search", {
        "query": hypothesis,
        "limit": limit,
        "fields": FIELDS,
    })

    papers = results.get("data", [])
    total = results.get("total", 0)

    # sort by citation count descending, pick top 3
    papers.sort(key=lambda p: p.get("citationCount") or 0, reverse=True)

    print(f"  {total} total results, reviewing top {len(papers)} sorted by citations\n")

    reviewed = []
    for p in papers:
        tldr = p.get("tldr") or {}
        abstract = p.get("abstract") or ""
        summary = tldr.get("text") or abstract[:200]

        authors = ", ".join(a["name"] for a in p.get("authors", [])[:2])
        if len(p.get("authors", [])) > 2:
            authors += " et al."

        doi = (p.get("externalIds") or {}).get("DOI")

        entry = {
            "title": p.get("title"),
            "authors": authors,
            "year": p.get("year"),
            "citations": p.get("citationCount"),
            "summary": summary,
            "doi": doi,
            "url": f"https://www.semanticscholar.org/paper/{p['paperId']}",
        }
        reviewed.append(entry)

        title = (p.get("title") or "")[:70].encode("ascii", "replace").decode()
        summary_safe = summary[:120].encode("ascii", "replace").decode()
        print(f"  [{p.get('year', '?')}] {title}")
        print(f"         {authors} | {p.get('citationCount', 0)} citations")
        print(f"         {summary_safe}...")
        print()

    # crude novelty signal based on total results + citation counts
    if total == 0:
        signal = "not found"
    elif total < 10 or max((p.get("citationCount") or 0) for p in papers) < 20:
        signal = "similar work exists"
    else:
        signal = "similar work exists"
        # "exact match" would need LLM to compare hypothesis vs abstracts

    print(f"  Novelty signal: {signal}")
    print(f"  Top references: {len(reviewed[:3])}")

    return {
        "query": hypothesis,
        "total": total,
        "signal": signal,
        "references": reviewed[:3],
        "all_papers": reviewed,
    }


if __name__ == "__main__":
    result = literature_review(QUERY)

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2, ensure_ascii=False)

    print(f"\nWritten to {OUTPUT_FILE}")
