# PDF extracted-text generation

- ID: `01_003`
- Type: `Issue`
- Area: `Backend`
- Status: `Open`

## Goal

Generate extracted plain-text companions for ingested PDF resource files.

## Why now

The docs are explicit that every PDF should also produce extracted `.txt` for cheap downstream reading and agent access.

This is one of the most important special cases in the ingestion pipeline.

## Scope

- detect PDF files during ingestion
- generate extracted `.txt` output for each PDF
- store the extracted text in the same resource file inventory
- record source-filename linkage from extracted text back to its PDF
- handle extraction failure states explicitly

## Out of scope

- OCR-heavy scanned-document support unless later required
- semantic chunking or embeddings
- broad document post-processing beyond plain-text extraction

## Dependencies

- `01_001` supported file contract and ingestion validation
- `01_002` resource file materialization and storage writes

## Candidate child issues

- later

## Exit criteria

- every ingested PDF produces an extracted `.txt` artifact or an explicit backend error
- extracted text is stored and linked in resource metadata consistently
- downstream reads can rely on the extracted-text convention
