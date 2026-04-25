# BenchPilot — User Stories

> Companion document to `concept.md` and `04_The_AI_Scientist.md`. Personas to ground design decisions for the hackathon submission, plus a design map and a recommendation for clickdummy scope.
>
> **What BenchPilot does in this challenge:** takes a scientific hypothesis as input → runs a literature QC novelty check → generates an operationally realistic experiment plan (protocol, materials with catalog numbers, budget, timeline, validation). Stretch: structured scientist review feeds a learning loop so future plans of the same type improve.

---

## How the personas split

Three groups around the workflow:

- **Plan requesters** — people who hold a hypothesis and need a plan. The primary users.
- **Plan reviewers** — domain experts whose corrections feed the learning loop (stretch goal).
- **Plan consumers** — the lab/CRO that has to actually execute what BenchPilot produces. They are not users of the tool, but the plan must hold up to their scrutiny.

The challenge brief calls out four sample fields — **Diagnostics, Gut Health, Cell Biology, Climate**. The personas below are anchored to those fields plus a few field-agnostic roles, so the demo can credibly span more than one domain.

---

## Personas

### 1. Maya — 1st-year PhD, gut health / aging biology *(plan requester, junior — Gut Health)*
- 1st-year PhD student in a mouse aging lab, working on the gut–senescence axis.
- **Hypothesis she'd type in (sample-input style):** *"Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin."*
- **Current setup:** paper notebook, messy PDFs, Sunday-night panic before lab meeting.
- **Pain:** she can write the hypothesis but has no idea what dose, what controls, what reagents to order, or what 4 weeks looks like in calendar weeks once IACUC and acclimatization are factored in. Her PI doesn't have time to walk her through it.
- **What she needs from BenchPilot:** a plan that shows her what a senior scientist would have done — including the parts she didn't know to ask about ("you'll need IACUC approval, typical lead time 6–10 weeks").
- **Stake:** the spine of the next 4 years.

### 2. Jonas — Postdoc, climate / environmental microbiology *(plan requester, reproducer — Climate)*
- Postdoc reproducing a CO₂-fixation experiment from his PhD in his new lab.
- **Hypothesis he'd type in (sample-input style):** *"Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400 mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%."*
- **Pain:** the original protocol lives across an ex-institute wiki, his laptop, and email threads with his old advisor. Reagent catalog numbers have changed, suppliers have merged. He wants a *clean* plan he can compare against his old protocol to spot drift.
- **What he needs from BenchPilot:** materials list with *current* catalog numbers, plus literature QC explicitly surfacing his old paper as "exact match found" so reviewers don't think he's claiming novelty.
- **Stake:** credibility in the new lab and the validity of all downstream work.

### 3. Dr. Park — Engineer-turned-scientist, point-of-care diagnostics *(plan requester, cross-disciplinary — Diagnostics)*
- Mid-career researcher with an EE background, now leading a point-of-care diagnostics group.
- **Hypothesis she'd type in (sample-input style):** *"A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing."*
- **Pain:** her team has the device-fabrication side covered but not the antibody chemistry, validation panel design, or the ELISA comparator. She needs a plan that bridges electrochemistry and immunoassay competently — exactly the cross-disciplinary scope where a single human expert is rare.
- **What she needs from BenchPilot:** a plan that doesn't quietly default to one discipline; surfacing both supplier classes (electrodes *and* antibodies) and a side-by-side validation against ELISA.
- **Stake:** a translational grant deadline; the diagnostic only matters if it's validated against the gold standard.
- **Architectural pressure:** cross-domain plans are where weak generation shows. Good test case for the quality bar.

### 4. Dr. Patel — PI submitting an exploratory grant *(plan requester, senior — field-agnostic)*
- Mid-career PI at a research university, 12-person lab.
- **Hypothesis she'd type in:** something at the edge of her expertise — a cross-disciplinary idea where she has the biology but not the assay experience.
- **Pain:** writing the methods + budget section of an R21 takes a postdoc a week. Half of that is sourcing realistic costs and timelines for techniques she's never run.
- **What she needs from BenchPilot:** a defensible draft of methods + budget + timeline she can edit, not start from scratch. Bonus: catalog numbers and supplier names she can hand to grants admin.
- **Stake:** grant deadlines that don't move.

### 5. Sebastian — CRO scientist scoping client briefs *(plan requester, professional — field-agnostic)*
- Senior scientist at a contract research organisation (CRO).
- **Hypothesis he'd type in:** whatever a pharma client just emailed in a one-paragraph brief — and the field changes week to week.
- **Pain:** a senior scientist can scope a proposal in hours; a junior one takes days, and the quality varies. Bad scoping = lost deals or under-priced contracts.
- **What he needs from BenchPilot:** a first-pass plan he can edit and quote against, plus literature QC so he can flag to the client whether the work has already been done.
- **Stake:** turnaround time on proposals = win rate.
- **Why he's the demo persona:** matches the brief's framing word-for-word ("the lab's scientists scope the work… a senior scientist who's run a similar experiment can do this in hours; one who hasn't may take days").

### 6. Hanna — Master's student, first independent project *(plan requester, novice — Gut Health)*
- 6-month master's project, loosely supervised by Maya, working on a probiotic side-arm.
- **Hypothesis she'd type in:** something her supervisor handed her, only half understood.
- **Pain:** doesn't know what she doesn't know. A blank chatbox terrifies her. Needs scaffolding — example hypotheses, fill-in-the-blanks, a clear "what a good plan looks like" before she's asked to evaluate one.
- **What she needs from BenchPilot:** structured input help (templates, the four sample-input examples from the brief), output explained at a level she can actually learn from.
- **Stake:** passing her thesis, learning how science is planned.
- **Architectural pressure:** does the input UX assume an expert-written hypothesis, or does it help the user *write* one? Different products.

### 7. Prof. Okonkwo — Senior reviewer, cell biology *(plan reviewer — Cell Biology, stretch goal)*
- 25-year veteran in cell biology, runs a 20-person lab.
- **Plan he'd be reviewing (sample-input style):** *"Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose's superior membrane stabilization at low temperatures."*
- **Role with BenchPilot:** doesn't generate plans — corrects them. He flags "wrong concentration", "this catalog number was discontinued", "this control is missing", "the timeline ignores cell-culture doubling time".
- **Pain:** he'd happily teach the system once if it remembered — but won't waste time correcting the same mistake on every plan.
- **What BenchPilot needs to give him:** a structured review interface (annotate sections, rate steps, suggest replacements) and visible evidence that his prior corrections actually changed the next plan in his domain.
- **Stake:** his time. If corrections don't compound, he stops reviewing.
- **Architectural pressure:** the stretch goal lives or dies on whether feedback is *visibly* incorporated. Few-shot replay tagged by experiment type is the minimum demo.

### 8. Aisha — Lab manager at the executing lab *(plan consumer, not a user — field-agnostic)*
- Runs day-to-day operations at the wet lab that receives the plan.
- **Role with BenchPilot:** never opens it. But the plan she receives must be executable — real reagents, real catalog numbers, realistic lead times, equipment her lab actually owns.
- **Pain:** plans that look good on paper but assume she has a flow cytometer she doesn't, or list a reagent that's been on backorder for six months.
- **What BenchPilot needs to do for her:** prefer canonical suppliers, surface lead times where known, flag equipment assumptions explicitly so she can sanity-check before starting.
- **Stake:** weeks of wasted lab time when an unrunnable plan gets started.
- **Architectural pressure:** the *quality bar* in the brief — "would a real scientist trust this enough to order materials and start Friday" — is really about Aisha. Build for her trust even though she never touches the UI.

### 9. Dr. Aydin — Industry scientist at a regulated biotech *(plan requester, constrained — out of scope for hackathon)*
- Senior scientist at a 30-person biotech; results feed IP filings.
- **Hypothesis she'd type in:** can't — her hypotheses contain unpublished compound structures she's not allowed to send to external LLM APIs.
- **Pain:** she'd love the tool but can't legally use it without on-prem inference and a clear data-flow diagram.
- **What BenchPilot needs to acknowledge:** for the hackathon, she's out of scope. Naming her now keeps the architecture honest about what "self-hostable" would later require.
- **Stake:** IP exposure, regulatory audit.
- **Architectural pressure:** data residency + model choice. Park, don't preclude.

---

## Persona-driven design map

| Persona | Field | Role | What they need from BenchPilot | Architectural pressure |
|---|---|---|---|---|
| Maya | Gut Health | Plan requester (junior) | Plan + the parts she didn't know to ask | Output must be self-explaining |
| Jonas | Climate | Plan requester (reproducer) | Current catalog numbers + "exact match" QC | Literature QC accuracy |
| Park | Diagnostics | Plan requester (cross-disciplinary) | Bridges device + assay competently | Cross-domain quality |
| Patel | (any) | Plan requester (senior, grant) | Defensible methods/budget/timeline draft | Citation quality, budget realism |
| Sebastian | (any) | Plan requester (CRO, professional) | Fast scoping draft | Turnaround speed, edit-friendliness |
| Hanna | Gut Health | Plan requester (novice) | Scaffolded input, learnable output | Input UX assumes expertise — or doesn't |
| Okonkwo | Cell Biology | Plan reviewer (stretch) | Structured review + visible learning | Feedback store + replay loop |
| Aisha | (any) | Plan consumer (not a user) | Executable, equipment-aware plans | Quality bar — "Friday-runnable" |
| Aydin | (any, regulated) | Constrained requester (out of scope) | On-prem inference | Data residency (defer) |

### Field coverage check

| Sample-input field | Persona that exercises it |
|---|---|
| Diagnostics | Park (primary), Sebastian (any client brief) |
| Gut Health | Maya (primary), Hanna (novice variant) |
| Cell Biology | Okonkwo (reviewer), Sebastian (any client brief) |
| Climate | Jonas (primary) |

Every sample-input field has at least one persona anchored to it — useful when picking which sample input to drive the live demo.

---

## Recommendation for the clickdummy

The challenge brief defines the deliverable; personas just sharpen *who you're building for*.

- **Primary persona:** **Sebastian (CRO scientist)** — closest to the brief's framing, professional enough to demand operational realism, most dramatic before/after demo.
- **Secondary persona:** **Maya (junior PhD)** — proves the tool isn't just for experts. Her hypothesis is the kind of thing a judge can imagine themselves typing.
- **Cross-disciplinary stress test:** **Park (diagnostics)** — use her hypothesis to show the plan doesn't collapse to a single discipline.
- **Stretch-goal persona:** **Prof. Okonkwo** — only matters if you build the review/learning loop. Don't add him to the demo unless that loop visibly works.
- **Quality-bar persona:** **Aisha** — invisible in the UI, but the plan you generate must satisfy her. Use her as the evaluation lens: "would Aisha's lab actually start this on Friday?"
- **Defer:** Hanna (novice scaffolding) and Aydin (compliance) — name them so the architecture stays honest, but don't build for them now.

### Mapping personas to the three stages of the brief

| Stage | Who tests it | What "good" looks like for them |
|---|---|---|
| 1. Hypothesis input | Maya, Sebastian, Park | Sebastian pastes a client brief; Maya types her PhD hypothesis; Park tests a cross-domain one. All accepted without reformatting. |
| 2. Literature QC | Jonas, Patel | Jonas sees his old paper as "exact match"; Patel sees 2 prior papers as "similar work exists". |
| 3. Experiment plan | Aisha (quality bar), Sebastian (turnaround) | Aisha would order the materials. Sebastian would send the plan to the client. |
| Stretch: review loop | Okonkwo | His correction to plan #1 visibly changes plan #2 in the same domain. |
