# BenchPilot — Reagent Provider Access Notes

> Operational notes on how to fetch reagent / catalog / supplier data for the experiment-plan generator. Captures what was tried, what works, and what to avoid re-discovering. Protocol repositories (protocols.io etc.) are integrated separately — see `frontend/src/lib/protocols-io.ts`.

---

## TL;DR

| Provider | Public API? | Practical access path | Notes |
|---|---|---|---|
| **Sigma-Aldrich (Merck)** | No | Headed Chromium via `agent-browser`; faceted search UI | Akamai blocks headless and curl. No "Cell Biology" facet for Protocol+Tech-Article search. |
| **Thermo Fisher** | No (catalog) | Scrape product pages | Developer portal exists but only for their lab-software customers. |
| **bio-protocol.org** | No | Scrape | Use protocols.io instead where possible — that one *does* have a public API. |
| **protocols.io** | Yes (OAuth 2.0) | https://www.protocols.io/developers | Already wired into the codebase. |
| Promega, Qiagen, IDT, ATCC, Addgene | Unknown | TODO | Brief lists them as supplier references but not investigated. |

For the hackathon clickdummy: **hardcode reagent → catalog-number mappings for the demo hypotheses**. Live scraping is fragile and slow, and judges won't be ordering anything Friday.

---

## Sigma-Aldrich (Merck)

### Domain & access

- Root: `https://www.sigmaaldrich.com/`
- Country/locale paths exist (e.g. `/AT/de`, `/US/en`). Behavior is the same; locale only affects language and currency.
- **Akamai bot protection is active.** Both `curl` and headless Chromium fail with `net::ERR_HTTP2_PROTOCOL_ERROR` / `curl exit 92` / HTTP 000. The host pings fine; the rejection is at the TLS/HTTP-2 layer, fingerprint-based.
- **Headed Chromium works.** All extraction must run under `agent-browser --headed` (or a real desktop browser).
- Beware: in Sigma-Aldrich's own marketing copy, "API" almost always means *Active Pharmaceutical Ingredient*, not Application Programming Interface. Search results for "Sigma API" will mislead you.

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
- ❌ `trafilatura` — same underlying fetcher problem.
- ❌ `agent-browser` (default headless) — same fingerprint rejection.
- ❌ Searching the Anwendungsgebiete list for "Cell Biology" — it's not there.
- ❌ Trusting the item counts long-term — they shift as content is added.

---

## Thermo Fisher

### Domain & access

- Root: `https://www.thermofisher.com/`
- No public catalog/products API. The "developer portal" they advertise is for **Platform for Science** (their LIMS/lab-informatics SaaS) and only available to existing software customers — not for browsing the store.
- IAPI on GitHub (`thermofisherlsms/iapi`) is for *instrument control*, not catalog lookup.
- Smart EPU Open API is cryo-EM software plugin only.

### How to fetch catalog data

There is no clean path. Options, in order of preference:

1. **Hardcode** the handful of catalog numbers you need for the hackathon's demo hypotheses. This is the recommended option for the clickdummy.
2. **Scrape** product pages at `thermofisher.com/order/catalog/product/<SKU>`. Bot protection is present but generally less aggressive than Sigma-Aldrich; `agent-browser --headed` should work.
3. **Lean on the LLM** with a prominent "verify before ordering" disclaimer in the UI. Catalog numbers in training data are often stale.

### What does NOT work

- ❌ Treating the Platform-for-Science Developer Portal as a product API. It isn't.
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

## Suppliers not yet investigated

The challenge brief lists these as supplier references; access mechanics are TODO:

- Promega — `promega.com/resources/protocols`
- Qiagen — `qiagen.com/us/resources/resourcedetail?id=protocols`
- IDT — `idtdna.com/pages/tools` (primer/qPCR design tools; may have an API)
- ATCC — `atcc.org` (cell-line protocols)
- Addgene — `addgene.org/protocols` (cloning; *Addgene does have a partial API* — worth checking before scraping)

When investigating any of these, document the result here in the same shape as the Sigma-Aldrich section: domain, access notes, what works, what doesn't, recipe.

---

## Recommendation for the hackathon

For the clickdummy demo, **don't depend on any supplier scraping in the live demo path**. Instead:

1. For the four sample-input fields (Diagnostics, Gut Health, Cell Biology, Climate), pre-curate a small reagent → catalog-number → supplier table by hand. ~20 entries is enough to make every demo hypothesis look concrete.
2. Treat protocols.io as the only real-time external dependency.
3. Show "supplier: Sigma-Aldrich, cat# XXX, ~€YY" in generated plans, but mark them as "verify with supplier before ordering" in the UI — that's both honest and reassuring to a judge.

Live scraping (Sigma-Aldrich, Thermo) is interesting *post*-hackathon. For 24-hour demo work, the failure modes (bot blocks, slow page loads, drift) are not worth the risk.
