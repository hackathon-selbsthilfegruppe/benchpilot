# Backend resource ingestion pipeline

- ID: `01_000`
- Type: `Epic`
- Area: `Backend`
- Status: `Open`

## Goal

Implement the backend file-ingestion pipeline for resources.

## Why now

Resources are the durable shared memory substrate. The backend must handle real files, not just abstract metadata.

We already know we need support for `.md`, `.txt`, and `.pdf`, with extracted `.txt` generated for every PDF.

## Scope

- support `.md`, `.txt`, and `.pdf` resource files
- generate extracted `.txt` for PDFs
- persist per-file metadata in the resource model
- store short file descriptions alongside filenames
- validate supported file types and expected output layout

## Out of scope

- advanced semantic search
- vector indexing
- OCR-heavy document workflows unless later required

## Dependencies

- `00_000` backend component/resource model

## Candidate child issues

- PDF extraction pipeline
- file metadata schema
- resource folder materialization
- validation and error handling

## Exit criteria

- backend can ingest supported resource files into the agreed folder structure
- every PDF resource produces an extracted `.txt`
- resource metadata captures file inventory and short descriptions consistently
