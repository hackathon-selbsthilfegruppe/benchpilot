# BenchPilot — Reagent Provider Access Notes

> Operational notes on how to fetch reagent / catalog / supplier data for the experiment-plan generator. Captures what was tried, what works, and what to avoid re-discovering. Protocol repositories (protocols.io etc.) are integrated separately — see `frontend/src/lib/protocols-io.ts`.

---

## TL;DR

| Provider | Public API? | Practical access path | Notes |
|---|---|---|---|
| **IDT** | ✅ **Yes — SciTools Plus API** (OAuth) | https://www.idtdna.com/pages/tools/apidoc | Best-in-class. OligoAnalyzer, codon optimization, ordering. Use it. |
| **Qiagen** | ✅ Partial (data APIs only) | QCI / BKB / IPA APIs | NOT a protocol/catalog API. For bioinformatics workflows. Web scrape works for protocols. |
| **Sigma-Aldrich (Merck)** | ❌ | **Playwright MCP** or `agent-browser --headed` | Akamai blocks `curl`, `trafilatura`, and `agent-browser` *headless*. Playwright MCP gets through. No "Cell Biology" facet. |
| **Thermo Fisher** | ❌ (catalog) | Scrape — but URL in brief 404s from EU geo-locale | Brief's `/us/en/...` URL hard-redirects to `/at/en/...` which doesn't exist. Need US VPN or different URL. |
| **Promega** | ❌ | Trafilatura returns nav chrome only; **agent-browser headless ✓** | Loads cleanly headless. JS-rendered list, scrape via DOM. |
| **bio-protocol.org** | ❌ | Scrape | Prefer protocols.io. |
| **protocols.io** | ✅ Yes (OAuth 2.0) | https://www.protocols.io/developers | Already wired into the codebase. |
| ATCC, Addgene | Unknown | TODO | Addgene rumored to have a partial API — worth checking. |

For the hackathon clickdummy: **hardcode reagent → catalog-number mappings for the demo hypotheses**. Live scraping is fragile and slow, and judges won't be ordering anything Friday.

### Access-method matrix (tested 2026-04-26)

Tested each access method against the URLs from the challenge brief (`04_The_AI_Scientist.md` § Hints and Resources):

| URL | API | trafilatura | `agent-browser` headless | `agent-browser --headed` | Playwright MCP |
|---|---|---|---|---|---|
| thermofisher.com/us/en/.../application-notes.html | ❌ | 0 words | 404† | 404† | 404† |
| sigmaaldrich.com/US/en/technical-documents | ❌ | 0 words (hangs) | ❌ HTTP/2 reject | ✅ | ✅ |
| promega.com/resources/protocols | ❌ | 59 words (chrome) | ✅ | ✅ | ✅ |
| qiagen.com/us/resources/resourcedetail?id=protocols | △ data APIs | 232 words (chrome) | ✅ | ✅ | ✅ |
| idtdna.com/pages/tools | ✅ SciTools Plus | 0 words | ✅ | ✅ | ✅ |

† Thermo Fisher's `/us/en/home/technical-resources/application-notes.html` redirects (server-side, geo-IP based) to `/at/en/...` for Austrian visitors, and the AT path returns 404. The page exists; you just can't reach it from EU IPs without locale override or VPN.

**Key finding:** Playwright MCP defeats Akamai bot protection that blocks both `curl` and headless `agent-browser`. For Sigma-Aldrich (and possibly other Akamai-fronted sites), Playwright MCP is the **most reliable scraping path** — better than headed `agent-browser` because it doesn't require a visible window.

---

## Sigma-Aldrich (Merck)

### Domain & access

- Root: `https://www.sigmaaldrich.com/`
- Country/locale paths exist (e.g. `/AT/de`, `/US/en`). Behavior is the same; locale only affects language and currency.
- **Akamai bot protection is active.** Both `curl` and headless `agent-browser` Chromium fail with `net::ERR_HTTP2_PROTOCOL_ERROR` / `curl exit 92` / HTTP 000. The host pings fine; the rejection is at the TLS/HTTP-2 layer, fingerprint-based.
- **Two reliable workarounds:**
  - **Playwright MCP** (`mcp__plugin_playwright_playwright__browser_navigate`) — gets through Akamai cleanly, no visible window required. **Preferred.**
  - **`agent-browser --headed`** — works because the visible Chromium has a more browser-like fingerprint. Use when Playwright MCP isn't available or you need the agent-browser CLI ergonomics.
- Beware: in Sigma-Aldrich's own marketing copy, "API" almost always means *Active Pharmaceutical Ingredient*, not Application Programming Interface. Search results for "Sigma API" will mislead you.
- Note on `/US/en/technical-documents`: that URL hard-redirects (server-side) to the AT/de facet-search URL above for EU IPs. The "technical documents" page IS the facet-search.

### Two surfaces worth knowing

1. **Product catalog** — individual product pages at URLs like `sigmaaldrich.com/<locale>/en/product/<brand>/<sku>`. Contains catalog number, pricing, pack sizes, datasheet links. Not investigated yet for scraping.
2. **Protocols + Technical Articles search** — faceted search UI at:

   ```
   https://www.sigmaaldrich.com/AT/de/search/facet-search
     ?facet=facet_content_type:Protocol
     &facet=facet_content_type:Technical Article
     &focus=sitecontent
     &page=1
     &perpage=30
     &sort=relevance
     &term=facet-search
     &type=site_content
   ```

   URL parameters are stable: `facet=facet_content_type:<Type>` can be repeated; `perpage` accepts at least 30; `term=facet-search` is the placeholder used when there's no keyword.

### How to navigate the search (recipe)

```bash
source ~/.cargo/env
agent-browser --headed open "<facet-search URL above>"
agent-browser wait --load networkidle
agent-browser snapshot -i -c       # see initial result list + Filter button
agent-browser click @<Filter>      # opens filter panel
agent-browser click @<Anwendungsgebiete>  # expand application-area facet
agent-browser screenshot /tmp/f.png --full   # filter checkboxes are unlabeled in a11y tree — read them visually
agent-browser click @<MehrAnzeigen>          # "Show more" reveals the rest of the categories
# pick a checkbox, then:
agent-browser click @<Erledigt>    # "Done" closes the filter and reapplies
```

**Critical caveat:** the Anwendungsgebiete checkboxes show up as unnamed `generic` nodes in the accessibility snapshot. You cannot click them by text label from `snapshot -i`. Workflow:
1. Take a `--full` screenshot of the open filter.
2. Read it to identify the checkbox you want.
3. Click by visual position, or by clicking the StaticText label adjacent to it.

### Available Anwendungsgebiete (Protocol + Technical Article search, observed 2026-04-26)

In order shown after clicking "Mehr anzeigen", with item counts in parentheses:

| Category | Count |
|---|---|
| Batteries, supercapacitors, and fuel cells | 3 |
| Microelectronics and nanoelectronics | 8 |
| Nanopartikel und Mikropartikel synthesis | 8 |
| Solid state synthesis | 3 |
| Cancer research | 2 |
| Gene expression and silencing | 3 |
| Pharma and biopharma manufacturing | 2 |
| Photovoltaics and solar cells | 2 |
| Large molecule HPLC | 2 |
| Reaction design and optimization | 2 |
| Sampling | 2 |
| Small molecule HPLC | 2 |
| 3D printing | 1 |
| Analytical chemistry | 1 |

**Important gap:** there is **no "Cell Biology" / "Zellbiologie" facet** in the Protocol + Technical Article search. Closest cell-biology-adjacent facets are "Cancer research" and "Gene expression and silencing" — together only **5 articles**. If you need more cell-biology coverage, do a keyword search (`term=cell biology`) instead of a facet filter, and accept lower precision.

Counts are small overall (the entire facet-filtered universe of "Protocol or Technical Article" is in the low hundreds). Sigma-Aldrich is a thin source for protocols compared to protocols.io.

### Extracting a single article

Once on a result page:

```bash
agent-browser wait --load networkidle
agent-browser snapshot -i -c           # inspect structure
# or, if rendering is heavy / a11y is poor:
agent-browser screenshot /tmp/article.png --full
agent-browser get text @<bodyContainer>
```

Save under `~/Documents/hackathon-selbsthilfegruppe/benchpilot/data/sigma-aldrich/NN-slug.md` with frontmatter:

```markdown
---
title: <full title>
url: <canonical URL>
type: Protocol | Technical Article
source: sigmaaldrich.com
downloaded: YYYY-MM-DD
---
```

### What does NOT work for Sigma-Aldrich

- ❌ `curl` — Akamai drops the TLS handshake or HTTP/2 stream.
- ❌ `trafilatura` — same underlying fetcher problem (returns 0 words).
- ❌ `agent-browser` (default **headless**) — same fingerprint rejection.
- ❌ Searching the Anwendungsgebiete list for "Cell Biology" — it's not there.
- ❌ Trusting the item counts long-term — they shift as content is added.

### What DOES work

- ✅ **Playwright MCP** (`mcp__plugin_playwright_playwright__browser_navigate`) — preferred.
- ✅ `agent-browser --headed`.
- ✅ Any real desktop browser (Chrome, Firefox).

---

## Thermo Fisher

### Domain & access

- Root: `https://www.thermofisher.com/`
- No public catalog/products API. The "developer portal" they advertise is for **Platform for Science** (their LIMS/lab-informatics SaaS) and only available to existing software customers — not for browsing the store.
- IAPI on GitHub (`thermofisherlsms/iapi`) is for *instrument control*, not catalog lookup.
- Smart EPU Open API is cryo-EM software plugin only.
- **Geo-locale gotcha:** the brief's URL `thermofisher.com/us/en/home/technical-resources/application-notes.html` returns **404 from EU IPs**. Server-side redirect rewrites `/us/en/` → `/at/en/` (or whatever the visitor's locale is), and the `/at/en/` path doesn't have the application-notes page. To reach it: use a US VPN, override locale via cookie, or pull individual application-note URLs that you already know.
- All four access methods (trafilatura, both agent-browser modes, Playwright MCP) hit the 404 — this is not a bot block, it's a missing page in the EU site tree.

### How to fetch catalog data

There is no clean path. Options, in order of preference:

1. **Hardcode** the handful of catalog numbers you need for the hackathon's demo hypotheses. This is the recommended option for the clickdummy.
2. **Scrape** individual product pages at `thermofisher.com/order/catalog/product/<SKU>` — those URLs are not locale-redirected. Use Playwright MCP or `agent-browser --headed`.
3. **Lean on the LLM** with a prominent "verify before ordering" disclaimer in the UI. Catalog numbers in training data are often stale.

### What does NOT work

- ❌ Treating the Platform-for-Science Developer Portal as a product API. It isn't.
- ❌ Hitting `/us/en/` URLs from EU IPs without locale override.
- ❌ Trusting LLM-generated catalog numbers without flagging them as unverified.

---

## bio-protocol.org

### Domain & access

- Root: `https://bio-protocol.org/`
- No public API. Search interface only (`/exchange/`).
- Scrapable, but if the goal is "fetch a real protocol body," **prefer `protocols.io`** — it has a documented public API (OAuth 2.0) and similar coverage of life-sciences protocols.

---

## protocols.io (covered for completeness)

- **Has a public API**: https://www.protocols.io/developers
- OAuth 2.0 for auth.
- Already integrated in this repo: see `frontend/src/lib/protocols-io.ts` and `frontend/src/app/api/protocols/search/route.ts`. Schema in `protocols-io-schema.json`.
- Should be the **primary protocol-fetching backend** for plan generation. Use Sigma-Aldrich and bio-protocol.org only as supplementary sources when protocols.io has no relevant hit.

---

## Promega

### Domain & access

- Root: `https://www.promega.com/`
- **No public API.** Protocols are exposed only via the website search at `promega.com/resources/protocols`.
- **No bot protection issues.** Loads cleanly with `agent-browser` headless and Playwright MCP. Trafilatura returns only navigation chrome (~59 words) — the protocol list is JS-rendered.
- Geo-redirects: `/resources/protocols` → `at.promega.com/resources/protocols#sort=relevancy` for EU visitors. Locale in the subdomain, not the path.

### Recipe

```bash
source ~/.cargo/env
agent-browser open "https://www.promega.com/resources/protocols"
agent-browser wait --load networkidle
agent-browser snapshot -i -c    # find the search/filter inputs
```

The page has search-by-catalog-number, search-by-product-name, search-by-literature-part-number, and category browse. Fill the input, press Enter, and parse the results list from a fresh snapshot.

### What works / does NOT

- ✅ `agent-browser` headless and headed.
- ✅ Playwright MCP.
- ❌ trafilatura — returns only login/cookie chrome.

---

## Qiagen

### Domain & access

- Root: `https://www.qiagen.com/`
- **Has APIs, but not for protocols/catalog.** Specifically:
  - **QCI (QIAGEN Clinical Insight) API** — REST, for uploading clinical genomics samples. Requires a QCI license.
  - **QIAGEN Biomedical Knowledge Base (BKB) API** — for AI/ML access to their curated biomedical knowledge graph. Commercial.
  - **QIAGEN IPA APIs** — for Ingenuity Pathway Analysis workflows.
  - None of these expose the protocol library or product catalog.
- **No bot protection on the protocols page.** Loads with `agent-browser` headless and Playwright MCP. Trafilatura returns mostly nav chrome (~232 words).

### Recipe

```bash
source ~/.cargo/env
agent-browser open "https://www.qiagen.com/us/resources/resourcedetail?id=protocols"
agent-browser wait --load networkidle
agent-browser snapshot -i -c
```

The page has a search interface with filters by product line, application area, and document type. Browse the tree to a specific product, then download the PDF protocol from the product page.

### What works / does NOT

- ✅ `agent-browser` headless and headed.
- ✅ Playwright MCP.
- ❌ trafilatura — too much chrome, no real content.
- ❌ Treating QCI/BKB/IPA as a protocols API. They're not.

---

## IDT — Integrated DNA Technologies

### Domain & access

- Root: `https://www.idtdna.com/`
- **Has a real public API: SciTools Plus API.** OAuth 2.0, documented at https://www.idtdna.com/pages/tools/apidoc and https://dev.idtdna.com/pages/products/gmp-oem-and-integrations/integrations/scitools-plus-api.
- **What the API exposes:**
  - **OligoAnalyzer™** — sequence analysis (Tm, hairpins, dimers).
  - **Codon optimization.**
  - **Complexity screening** for synthesizable sequences.
  - **Order creation via cXML.**
  - **Order tracking and invoice retrieval.**
- **Auth model:** OAuth, requires an IDT account + API key. Swagger and Postman collections provided.
- **Audience:** primarily bioinformatics teams and procurement systems integrating oligo design / ordering. Perfectly aligned with the hackathon if any sample input involves primers, qPCR, or synthesized DNA.

### Recipe (API)

1. Create an IDT account (free) at idtdna.com.
2. Request API access; obtain client ID and secret.
3. OAuth flow: exchange creds for access token.
4. Hit endpoints documented in their Swagger.

For a clickdummy, you may not need the API at all — the website is freely loadable (`agent-browser` headless ✓, Playwright MCP ✓) and contains all the tools as web UIs.

### Geo-redirects

`idtdna.com/pages/tools` → `eu.idtdna.com/page/tools` for EU visitors. The API endpoints are global, but check whether the Swagger URLs differ by region.

### What works / does NOT

- ✅ **SciTools Plus API** — preferred for any oligo/qPCR/codon work.
- ✅ `agent-browser` headless and headed.
- ✅ Playwright MCP.
- ❌ trafilatura — page is a JS-rendered tool launcher; no useful text.

---

## Suppliers not yet investigated

- ATCC — `atcc.org` (cell-line protocols)
- Addgene — `addgene.org/protocols` (cloning; *Addgene does have a partial API* — worth checking before scraping)

When investigating any of these, document the result here in the same shape as the existing sections: domain, access notes, what works, what doesn't, recipe.

---

## Recommendation for the hackathon

For the clickdummy demo, **don't depend on any supplier scraping in the live demo path**. Instead:

1. For the four sample-input fields (Diagnostics, Gut Health, Cell Biology, Climate), pre-curate a small reagent → catalog-number → supplier table by hand. ~20 entries is enough to make every demo hypothesis look concrete.
2. Treat **protocols.io** and (if any sample input touches oligos/qPCR) the **IDT SciTools Plus API** as the only real-time external dependencies. Both are documented public APIs.
3. Show "supplier: Sigma-Aldrich, cat# XXX, ~€YY" in generated plans, but mark them as "verify with supplier before ordering" in the UI — that's both honest and reassuring to a judge.

### Tool selection rule of thumb

| Need | Use this |
|---|---|
| Public API exists and covers the use case | Use the API (protocols.io, IDT SciTools Plus, Qiagen QCI for clinical, …) |
| No API; site is Akamai-fronted or fingerprint-checked (Sigma-Aldrich) | **Playwright MCP** > `agent-browser --headed` > anything else |
| No API; site loads cleanly | `agent-browser` headless (fastest) or trafilatura (fastest text-only) |
| Page is mostly nav chrome with JS-rendered content | `agent-browser` snapshot or Playwright MCP — trafilatura will return junk |
| The brief's URL 404s | Check for geo-locale redirect (Thermo `/us/en/` → `/at/en/` issue) |

Live scraping (Sigma-Aldrich, Thermo) is interesting *post*-hackathon. For 24-hour demo work, the failure modes (bot blocks, slow page loads, drift, broken URLs from EU IPs) are not worth the risk.
