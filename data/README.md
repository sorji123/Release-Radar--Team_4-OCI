# Data for development

## Website release catalog

`releases/26D.json` contains 11 reviewed Oracle Sales, Service and common
release notes for the browser MVP, with source URLs, brief excerpts, matching
rules and suggested tests. The catalog is dated October 25, 2026. Run
`python3 scripts/verify_release_sources.py` to check the excerpts against
their public pages. Run `python3 -m release_radar build-site` after edits.

The website's fictional configuration inventory lives in
`config/fusion-customizations.example.json`. The catalog and inventory use the
browser contract described in [the MVP guide](../docs/MVP.md); they are not
input to the synthetic Python classifier below.

## Synthetic pipeline fixtures

`demo/` contains **synthetic** release changes and fictional Northwind Telecom
configurations. `DEMO` is not an Oracle quarterly release. The `example.invalid`
URLs are intentional provenance placeholders, not working citations to Oracle.
Do not present these records or their canned confidence scores as real advice.

The six objects cover all six configuration types in the build plan. Four small
release items exercise BREAKING, TEST, OPPORTUNITY, a rejected candidate (NONE),
and two objects without candidates. The HCM item tests module filtering.

| File | Role |
| --- | --- |
| `release_features.json` | Source text, opt-in flags, release/module and provenance |
| `config_objects.json` | Customer configurations; no expected verdicts |
| `embeddings.json` | Hand-authored four-dimensional vectors for offline matching |
| `responses.json` | Canned classifier responses for each candidate pair |
| `expected.json` | Evaluation labels read only by tests |

Feature keys are unique within a release; object keys are unique within a
customer. Fixture vectors use `features[release_code][feature_key]` and
`objects[customer][object_key]`; responses use
`responses[customer][release_code]["object_key|feature_key"]`. The expected file
covers the default Northwind/DEMO scope only.

Changing the threshold or vectors may produce a pair without a fixture response.
The demo fails explicitly in that case; add an intentional response or use the
default settings. Fixture tests verify program behavior, not AI accuracy.

## Expanding the dataset for live OCI analysis

1. Expand the reviewed selection to 20–30 real items from Oracle's current
   What's New release, mapping them to the pipeline contract. Verify the
   current quarter before adding more notes.
2. Preserve a stable `feature_key`, `release_code`, `module`, `title`, verbatim
   `description`, Oracle's `opt_in` (`Y`/`N`), `source_kind=ORACLE`, and the exact
   official `source_url`. A URL alone does not verify a copied claim.
3. Expand the fictional configuration set to about 25 objects with stable
   `object_key` values. Keep module names consistent with release items.
4. Have a teammate label the planted examples in a separate evaluation file.
   Never supply these labels to a model or use them to select candidates.
5. Load text into Oracle using Data Workshop or a future importer, mapping keys
   to the database identity columns. Generate fresh embeddings with one model
   and the dimension required by `database/001_schema.sql`.

The fixture runner deliberately rejects `ORACLE` source data: live classification
and real-data import are follow-up work. Do not load the four-dimensional demo
vectors into the 1024-dimensional database columns.
