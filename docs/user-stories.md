# BenchPilot — User Stories

> Companion document to `concept.md`. Personas to ground design decisions, plus a persona-driven design map and a recommendation for clickdummy scope.

---

## Personas

Nine personas, ordered by how directly they map to the current concept. The first four are seed personas; the next five expose architectural pressures the first four don't.

### 1. Maya — Starting PhD, aging biology
- 1st-year PhD student in a mouse aging lab.
- **Project:** testing whether protein XYZ is a senolytic (kills senescent cells).
- **Current setup:** paper lab notebook + a messy folder of PDFs.
- **Pain:** vague hypothesis, no idea how to sharpen it — what cell types? what readouts? what controls? Wants a thinking partner that pushes her to make the hypothesis testable, not an LLM that agrees with her.
- **Stake:** the spine of the next 4 years.

### 2. Jonas — Postdoc, wastewater microbiome
- Postdoc, came from a PhD in environmental microbiology.
- **Project:** reproduce a key experiment from his PhD in the new lab as a baseline.
- **Current setup:** PhD-era protocols scattered across an old institute wiki, his laptop, email threads with his old advisor.
- **Pain:** reproducibility *is* the deliverable. If he can't recreate the exact reagents, sequencing pipeline, and analysis steps, the rest of his postdoc is built on sand.
- **Stake:** credibility in the new lab and the validity of everything downstream.

### 3. Lin — Late-PhD, writing up
- 4th-year PhD student, paper #1 in late-draft stage.
- **Project:** a paper about to be submitted. The bibliography needs to be *exactly* right.
- **Current setup:** Zotero with 600+ papers, only ~80 actually relevant.
- **Pain:** wants a curated, locked set of references with the ability to ask "does any of this contradict claim X in section 3?" Does **not** want the system suggesting more papers — wants it to *constrain* itself to her chosen set.
- **Stake:** getting the paper out the door cleanly.

### 4. Sam — Lab technician, multi-project
- Lab tech supporting 4–5 PhD students and postdocs.
- **"Project":** none — jumps in where needed (orders, prep, running protocols, troubleshooting).
- **Current setup:** lab Slack, shared calendar, whoever shouts loudest.
- **Pain:** context-switching is brutal. Walking into Maya's project Monday and Jonas's Tuesday means re-loading two different worlds. Wants a fast "what do I need to know to be useful here today" view.
- **Stake:** not breaking other people's experiments, being efficient with their own time.

### 5. Prof. Schneider — Principal Investigator
- Tenured PI with 8 people in the lab (including Maya, Jonas, Lin, Sam).
- **"Project":** the lab itself — grants, paper pipeline, who's stuck, who's productive.
- **Current setup:** weekly 1:1s, an unmaintained Trello board, a deep fear of opening her inbox.
- **Pain:** no live picture of where each project is. Finds out experiments failed three weeks late. Wants a *dashboard across her people's benches* — TOCs and summaries, not raw data.
- **Stake:** grant renewals, students graduating on time, knowing when to intervene.
- **Architectural pressure:** read-across-benches view + permissions. Are benches private to the user or visible to a supervisor?

### 6. Dr. Aydin — Industry scientist, biotech startup
- Senior scientist at a 30-person biotech.
- **Project:** optimizing a lead compound; results feed IP filings and investor updates.
- **Current setup:** company-mandated ELN + Confluence.
- **Pain:** would love BenchPilot's flexibility but **cannot** put unpublished compound structures into a tool that calls external LLM APIs. Needs an audit trail for FDA-relevant work.
- **Stake:** IP, regulatory exposure, her job.
- **Architectural pressure:** data residency, model choice (local? on-prem?), audit logging. If BenchPilot only works as a hosted SaaS calling Anthropic, half the realistic users can't touch it.

### 7. Theo — Bioinformatician, dry lab
- Computational postdoc, no wet bench.
- **Project:** re-analyzing a public RNA-seq dataset to test a hypothesis about aging clocks.
- **Current setup:** Jupyter notebooks, Snakemake pipelines, Git, 4TB scratch disk.
- **Pain:** markdown-everything is a poor fit. His "data" is code, parameters, pipeline runs, figures — not prose. Wants a component that can *execute* and *version* analyses.
- **Stake:** reproducibility of computational results — half of modern biology.
- **Architectural pressure:** is a component allowed to be *executable* (notebook, pipeline) or only *documentary* (markdown)? Documentary-only quietly excludes the entire dry-lab world.

### 8. Hanna — Master's student, first independent project
- Master's thesis student, 6-month project, loosely supervised by Maya.
- **Project:** a small side-arm of Maya's senolytic work — running one assay.
- **Current setup:** whatever Maya tells her to use. Has never written a hypothesis before.
- **Pain:** doesn't know what she doesn't know. Needs *scaffolding* — prompts that teach her what a good hypothesis, control, or methods section looks like, not a blank chatbox.
- **Stake:** passing her thesis, learning how to do science.
- **Architectural pressure:** is BenchPilot a *power tool* for experts or a *training environment* for novices? Same component would need different preprompts for Maya vs. Hanna.

### 9. Dr. Okafor — Visiting collaborator at another institute
- Microbiome ecologist at a partner university, collaborating with Jonas for 6 months.
- **Project:** contributing analysis on a subset of Jonas's samples; her institute, her compute, her people.
- **Current setup:** shared Dropbox folder + weekly Zoom.
- **Pain:** needs *partial* access to Jonas's bench — protocols and one data subset — without seeing the rest, and without him seeing her unpublished side-work. Wants to contribute back without merge conflicts.
- **Stake:** a co-authored paper and not stepping on each other's data.
- **Architectural pressure:** sharing granularity (whole bench vs. selected components vs. selected files), two-way write semantics, multi-owner benches.

---

## Persona-driven design map

| Persona | Primary need | Component emphasis | Architectural pressure |
|---|---|---|---|
| Maya | Generative thinking partner | Hypothesis, literature, experimental design | Open-ended generation quality |
| Jonas | Archival fidelity | Protocols, reagents, versioned procedures | Versioning, reproducibility |
| Lin | Constrained synthesis | Locked literature corpus, claim-checking | Per-component scope limiting |
| Sam | Cross-project situational awareness | Read across other people's benches | Multi-bench access |
| Schneider | Supervisor oversight | Dashboard view across team | Permissions, auth model |
| Aydin | Compliant private use | Same as Maya/Jonas, but offline | Data residency, audit, model choice |
| Theo | Executable science | Code, pipelines, parameter sets | Components beyond markdown |
| Hanna | Scaffolded learning | Same components, simpler preprompts | Skill-level differentiation |
| Okafor | Cross-institutional collaboration | Selected component sharing | Partial access, multi-owner |

---

## Recommendation

Don't design for all nine. For the clickdummy:
- **Primary persona:** Maya — exercises the chat-first → component-introduction progression cleanly and is dramatic to demo.
- **Secondary persona:** Lin or Jonas — exercises a different axis (constraint vs. fidelity) without doubling the build.
- **Constraints, not features:** treat the others as "we won't preclude this later" — Schneider's supervisor view, Aydin's data residency, Theo's executable components. Naming them now keeps the architecture honest.
