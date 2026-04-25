![][image1]

In collaboration with MIT Club of Northern California and MIT Club of Germany

C H A L L E N G E

**04**

· · · · · · · · · · · · · · · · · · · ·

**The AI Scientist**

*From hypothesis to runnable experiment plan*

P O W E R E D   B Y

**![][image2]**  
**FULCRUM SCIENCE**

**The Challenge**

Turning a scientific question into a runnable experiment takes weeks of manual work — designing the protocol, estimating costs, sourcing materials, staffing the team. It’s not the ideas that slow science down; it’s the operations.

Here’s how it typically works: an organisation — a pharma company, a university, a research funder — sends a brief to a specialist lab or Contract Research Organisation (CRO). The lab’s scientists scope the work: they figure out what steps to follow, what to buy, how long it will take, and how much it will cost. Then they send back a proposal. A senior scientist who’s run a similar experiment before can do this in hours. One who hasn’t may take days — and the quality difference is real. A plan with the wrong chemical concentration or an unrealistic timeline can send a lab down the wrong path for weeks.

Your challenge is to build an AI-powered tool that compresses this process: take a scientific question as input, and generate a complete, operationally realistic experiment plan that a real lab could pick up and execute. You don’t need to be a scientist to build this — you need to know how to build tools that make experts faster.

| The mRNA moment | What accelerated COVID-19 vaccine development wasn’t a new idea — the mRNA hypothesis had existed for decades. It was the ability to move from hypothesis to executable experiment at unprecedented speed. That’s the gap you’re closing. |
| :---- | :---- |

**What You're Building**

A focused, end-to-end application with three stages:

| 1\. Input Natural language scientific question | 2\. Literature QC Has this exact protocol been done before? | 3\. Experiment Plan Full operational plan — the core deliverable |
| :---- | :---- | :---- |

**Primary Challenge: Full Experiment Planning**

This is where you can make your mark. Can you build the tool that a real PI would actually want to use? Can you generate an experiment plan so complete, so operationally grounded, that a lab could pick it up on Monday and start running it by Friday? Here's what that looks like in practice — a plan that includes:

* **Protocol** — step-by-step methodology grounded in real published protocols

* **Materials and supply chain** — specific reagents, catalog numbers, suppliers

* **Budget** — realistic cost estimate with line items

* **Timeline** — phased breakdown with dependencies

* **Validation approach** — how success or failure will be measured

| Quality bar | Would a real scientist trust this plan enough to order the materials and start running it? That is the standard. |
| :---- | :---- |

**Literature Quality Control Step**

Before generating the plan, run a quick check: has this experiment, or something very close to it, been done before?

Think of this as a plagiarism check, but for science. It’s not a deep literature review — it’s a fast signal that tells the scientist whether they’re breaking new ground or building on existing work. The output should be simple:

* A novelty signal: “not found”, “similar work exists”, or “exact match found”  
* 1–3 relevant references where applicable, so the scientist can follow up

Use any literature source you like — arXiv, Semantic Scholar, protocol repositories, or others. The source matters less than the signal being accurate and fast.

**The UI**

Build a polished end-to-end interface. Submitted projects will be evaluated on both the quality of the generated plan and the quality of the experience.

The UI should make it easy to:

* Enter a scientific question in plain language

* See the literature QC result clearly before the plan is generated

* Read and navigate the full experiment plan

* Understand the budget, timeline, and materials at a glance

**Stretch Goal: Scientist Review — Closing the Learning Loop**

This is the hardest challenge in the brief, and the one with the highest ceiling.

**The core idea:** every time a scientist reviews and corrects a generated plan, that feedback becomes a training signal. Over time, the system gets better at generating plans for similar experiment types — learning from expert knowledge rather than just retrieving it.

What this looks like in practice:

* A structured review interface where a scientist can rate, correct, and annotate sections of the plan — protocol steps, reagent choices, budget lines, timeline assumptions

* A feedback store that captures corrections in structured form, tagged by experiment type and domain

* A generation layer that incorporates prior feedback when producing new plans of a similar type — at minimum as few-shot examples, at best as a lightweight fine-tuning loop

The demo that wins this stretch goal is one where a judge can watch the system generate a plan, a scientist leave structured corrections, and the next plan for a similar experiment visibly reflect those corrections — without being explicitly re-prompted.

| Why this matters | A system that learns from scientist feedback compounds in value over time. Every review makes the next plan better. This is the difference between a tool and a platform. |
| :---- | :---- |

**Sample Inputs**

Not sure what to test your tool with? Here are four example inputs — each is a real scientific hypothesis written the way a researcher would actually phrase it. Your tool should be able to take any of these and produce a full experiment plan.

Don’t worry if the scientific terminology is unfamiliar — we’ve added plain-English translations for each one.

.

| Diagnostics | A paper-based electrochemical biosensor functionalized with anti-CRP antibodies will detect C-reactive protein in whole blood at concentrations below 0.5 mg/L within 10 minutes, matching laboratory ELISA sensitivity without requiring sample preprocessing. *In plain English: can we build a cheap, fast blood test for inflammation that works without lab equipment?* |
| :---- | :---- |
| **Gut Health** | Supplementing C57BL/6 mice with Lactobacillus rhamnosus GG for 4 weeks will reduce intestinal permeability by at least 30% compared to controls, measured by FITC-dextran assay, due to upregulation of tight junction proteins claudin-1 and occludin. *In plain English: does a specific probiotic measurably strengthen the gut lining in mice?* |
| **Cell Biology** | Replacing sucrose with trehalose as a cryoprotectant in the freezing medium will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to the standard DMSO protocol, due to trehalose’s superior membrane stabilization at low temperatures. *In plain English: can we keep more cells alive when freezing them by swapping one preservative for another?* |
| **Climate**  | Introducing Sporomusa ovata into a bioelectrochemical system at a cathode potential of −400mV vs SHE will fix CO₂ into acetate at a rate of at least 150 mmol/L/day, outperforming current biocatalytic carbon capture benchmarks by at least 20%. *In plain English: can a specific microbe be used to convert CO₂ into a useful chemical compound more efficiently than current methods?* |

| What makes these strong inputs | Each hypothesis names a specific intervention, states a measurable outcome with a threshold, gives a mechanistic reason, and implies a clear control condition. "AI will improve drug discovery" is a goal, not a hypothesis. |
| :---- | :---- |

**Hints and Resources**

**Protocol Repositories**

* [protocols.io](http://protocols.io): largest active repository, structured format: [protocols.io](https://www.protocols.io)

* Bio-protocol: peer-reviewed, linked to papers: [bio-protocol.org](https://bio-protocol.org)

* Nature Protocols: premium detail: [nature.com/nprot](https://www.nature.com/nprot)

* JOVE: video protocols with written transcripts: [jove.com](https://www.jove.com)

* OpenWetWare: community protocols: [openwetware.org](https://openwetware.org)

**Supplier References**

* Thermo Fisher application notes: [thermofisher.com/us/en/home/technical-resources/application-notes.html](https://www.thermofisher.com/us/en/home/technical-resources/application-notes.html)

* Sigma-Aldrich technical bulletins: [sigmaaldrich.com/US/en/technical-documents](https://www.sigmaaldrich.com/US/en/technical-documents)

* Promega protocols: [promega.com/resources/protocols](https://www.promega.com/resources/protocols)

* Qiagen protocols: [qiagen.com/us/resources/resourcedetail?id=protocols](https://www.qiagen.com/us/resources/resourcedetail?id=protocols)

* IDT primer design and qPCR: [idtdna.com/pages/tools](https://www.idtdna.com/pages/tools)


**Reagent and Cell Line References**

* ATCC cell line protocols: [atcc.org](https://www.atcc.org)

* Addgene cloning and transfection: [addgene.org/protocols](https://www.addgene.org/protocols)

**Scientific Standards**

* MIQE Guidelines for qPCR: [ncbi.nlm.nih.gov/pmc/articles/PMC2737408](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC2737408/)

**Contact:** [arun@fulcrum.science](mailto:arun@fulcrum.science) / [jonas@fulcrum.science](mailto:jonas@fulcrum.science)

**What Good Looks Like**

*A participant enters: “Can we improve solar cell efficiency by testing alternative materials?”*

The tool checks whether this protocol exists, surfaces 2 prior papers, flags it as “similar work exists”, then generates a full plan: a 6-step synthesis protocol grounded in protocols.io, a materials list with catalog numbers and a £12,000 budget estimate, and a 10-week timeline.

That is the bar. Build something a real scientist would want to use.

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJcAAAA5CAYAAAA7ibnnAAADaklEQVR4Xu2bX27TQBCHd00lFAQvCJ6QuAXPnIQ3DsEZkLgDN0IcACSugKCCtDRk4v3F4/Guk6ZtBOn3SVN7/3p29+dZ20pTAgAAAAAAAAAAAAAAAAAAAACAo5Pzn/Xf1drseFXOZZdr+zVUBtgPL6QoqmgqB9iJF45FLEUvicgiVktwTxJAgygWE5aJSef+KItRDmDC7zQWVTy2opXE59sCjPARKUajKJ4osGgAI7biyDrPG2HtEpMXn+oCDDxI2T4rROHELc8LaM4ABnKXl2kqKr0ZrgWV+7JOkaqkp2I7BF2vhl3vNl8Uru1nN77JaijC78OP1Pcn7NynT4KLNCxcfGBvne+TPgT1U8P8PLTfGhrrdZB/rW3f8vYVl+ZrF13M+NcJD+2bL/CyKBJNWGgziVSHLFbE2rfuXi8uXc/ebEVcrOJX966kFXXkY6yv9HeXF7E6am/XjuP1fcrH5yX9reRddV33vpRZ+sPaPqZp1Na8PitpWyf1WdKj8TwtZb6PoxIFsnIOR7EMlkcfTCUipWW3gfrSFmHnJioJa+46vnxXXSPW16IJ5fl6cfG82Awri4ITb9J8X15cc/5bvgk7tjcep/b175TzNJ0wmTnkF1CmAauNRHhX+Ds/clluBEOL6n3JJc+Q/3PEOz9Gjhq1BdWNZ3j/VdeilPA+x23ez+2c/97vWOdRyT863iEnMFuwbfTydWQadBzIXTA3qbYYmvzaxMrHryWtsXh8/7VyS7e2ZVNv7bqG5cXoake/bb8teSrXW7mI4rZPQdanJwow+v+w5B+djWNugszkrCZVA4w2O+lpmNjW5O/LsjKhwhbK3mS35N6nWF+TL8wfL0xhebUx2aK3fuXRapPOzs5ep95H70+Z3+zbXOScbRcxXqX+Wj/74+bZN2L+L3Pu4rxqbbYsFosXaSzoo+GilbPpz2lqkUv5ntiX6tn5TUUG/xmKUn7xV+u7SMJQmQ/vVk+i+ZS2ZLX3glVdL7jqXQ6nSRDXRlgShcpqW+NoO0qDOH20ahkCu0e8LHt7EcfmeUAiiNui1auh+r5eFJUsbqdwT7jIXbZtUKLqhZWbohJRQNF8hLRPBADX4nOaPsTHZzCAG/MlDSKzby0AAAAAAAAAAAAAAAAAAAAAAAAAAAAAcP9Yrew//gFOkL+5AnVJ2EG1gAAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJUAAAA8CAYAAABvsfhpAAABmElEQVR4Xu3Zvy4EURTH8fMmKpEoETRegFItkdAT7yEKiYRGo/YgGo1GLRIUIpQK7snMxs1v7z+ziol8P8lJ9p77d2ZOdje7ZgAAAAAAAAAAAAAAAAAAAAAAAAAA4D97DvGlSUvnVG3MjSYyauuU3IW40mRwZG3r+pj4nIt97jjK5fi80h6t179v3Tqn2hE5sG6Mjx29VFE9STtH56nWm1pbJ2Xehs1TWlTuus/X/FVR+TNwvtZD3NHz8zjvn4wdtVRR3Us7R+ep1ptaWyel9kBbaVG9hHiM2iW1Mwy5ft87br9Gr2v7jUaqqFq9hXjXZG8zxJomM3L759ae8HmfmozcaiJBi8rpgy0pjSv1xfTd59K6uR+S3+3zo7YiMYv1EOchlrWjQs8wiZ0Qe9G4Fn6GC2u/lni/1Lk9P6fJjIUQZyG2tKMid/83pO1yYwEAsO4j0L97nGgHMIQXkwYwyLZNF1Mchz9DgTotoFIARUs2XTQtseqTAeV/Z2ix/Cb8h1sAAAAAAAAAAAAAAAAAAAAAAAAAAGbxDUmmi50V29u/AAAAAElFTkSuQmCC>