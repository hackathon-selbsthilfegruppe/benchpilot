# Supported file contract and ingestion validation

- ID: `01_001`
- Type: `Issue`
- Area: `Backend`
- Status: `Closed`

## Goal

Define the accepted input contract for resource ingestion and validate supported file types before writing anything to storage.

## Why now

The docs are explicit that the backend must support `.md`, `.txt`, and `.pdf` resources.

Before we materialize files, we should make the ingestion contract and validation rules explicit.

## Scope

- define accepted file types for ingestion
- define how media types map to allowed extensions
- define validation rules for file inventory entries
- define expectations for required descriptions and source-filename linkage
- reject unsupported or inconsistent ingestion requests early

## Out of scope

- actual PDF text extraction
- API endpoint design
- advanced content inspection beyond the initial contract

## Dependencies

- `00_004` resource schema and TOC model
- `00_006` loader/writer services and validation

## Candidate child issues

- later

## Exit criteria

- supported file types and validation rules are explicit in code
- invalid ingestion inputs fail before filesystem writes begin
- later ingestion steps can assume validated input
