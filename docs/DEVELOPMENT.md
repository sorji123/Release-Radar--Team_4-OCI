# Development guide

The starter follows the backend plan in the README and `Release Radar.docx`:
Autonomous Database owns persistent data and OCI Generative AI supplies
embeddings and classification. **Oracle APEX is the selected application
platform**, following the original build plan.
The Python package is a small offline harness and a
starting point for the document's Python fallback. It is not a web server and
does not connect to Oracle or OCI yet.

## Work locally

With Python 3.11+ installed, run from the repository root:

```bash
python -m release_radar demo
python -m unittest discover -s tests -v
```

No package installation is needed. `pyproject.toml` records project metadata;
the demo is currently supported from a source checkout, not a standalone wheel.
The report is written to ignored `build/demo-report.json`. An optional path is:

```bash
python -m release_radar demo --output build/my-report.json
```

The harness filters by customer/release/module, computes cosine distance over
hand-authored vectors, takes at most three candidates below distance 0.60,
retrieves fixture responses, validates them, and emits ranked findings. Every
run has a UUID, UTC timestamps, fixture provenance, settings, summary counts,
all classified decisions (including `NONE`), and actionable findings.

The local UUID is an artifact identifier, not the numeric `analysis_runs.run_id`.
A future Oracle writer must create its own identity row and map stable
`object_key`/`feature_key` identifiers to database IDs. The local summary names
`release_features` and `candidate_pairs` map to database `features_considered`
and `candidates_selected`; `threshold` maps to `distance_threshold`.

The local CLI writes a report only after success, exits nonzero on bad input,
and leaves any previous report unchanged on an analysis error. It does not
persist failed runs. The database writer must implement that lifecycle.

## Useful code boundaries

| Location | Responsibility |
| --- | --- |
| `contracts.py` | Dataset fields, strict JSON, category/confidence ranges, source citation and test validation |
| `pipeline.py:select_candidates` | Retrieval semantics tested against hand-authored vectors |
| `pipeline.py:Classifier` | Small interface a future OCI adapter can implement |
| `pipeline.py:build_prompt` | Source-only inputs using `prompts/classify.txt`; evaluation labels excluded |
| `pipeline.py:run_demo` | Fixture-only orchestration; intentionally refuses real release data |
| `database/candidates.sql` | Equivalent retrieval on Oracle's stored vectors |
| `database/002_views.sql` | APEX reporting contract and severity ranking |

The demo does not send prompts to an LLM; the prompt builder is tested separately
for the next integration. Validate live responses through `validate_response`
before persistence. It rejects prose/fences rather than silently extracting a
JSON-looking fragment. The future caller can retry a failed response once with
a repair instruction, then record a failed run. A quoted phrase passing
validation is evidence of grounding, not proof of the semantic verdict.

## First development tasks

These tasks can be assigned to separate teammates. Follow the
[APEX deployment plan](DEPLOYMENT.md) for the application milestones.

1. **Database foundation.** Provision the development schema, apply the scripts
   in `database/README.md`, and run `verify.sql` and `smoke.sql`. Record the actual
   database version and successful output. The SQL has not been run against a
   live Oracle instance as part of this starter.
2. **Data preparation.** Follow `data/README.md`; curate official release text
   with URLs and opt-in flags. Create the rest of Northwind's fictional objects
   and keep expected outcomes in a separate evaluation dataset. Start a loader
   that validates scope and maps stable keys to Oracle IDs.
3. **OCI integration.** Confirm region, model availability and vector dimension.
   Store credentials outside Git. Verify one embedding using
   `config/oci-embedding.example.json` and Oracle's documented APIs. Generate
   both datasets' embeddings with a compatible model/input recipe. Implement
   the PL/SQL route first, or a Python OCI SDK adapter if that blocks progress.
4. **Analysis writer.** Create a `RUNNING` analysis row; fetch scoped candidates;
   construct prompts; validate JSON, citations and tests; persist decisions;
   update counts and terminal status. Treat empty candidate sets as valid,
   reject incomplete embedding coverage, and record the actual model, prompt,
   top-k and threshold. Specify transaction and retry behavior before wiring UI.
5. **APEX application.** Build the three pages in `apex/README.md` and export
   the application into `apex/exports/`. Connect Run only after an executable
   analysis entry point exists.

The initial schema fixes vector dimension at 1024 to match the build plan.
If the chosen model returns another dimension, review and change both columns
before the first install or add an explicit migration to an existing schema.
Never put the demo's four-dimensional vectors into the Oracle tables.

## First live milestone

- A customer and release can be selected in the APEX application.
- A real analysis run finishes as `COMPLETED` or `FAILED`, with accurate counts.
- The dashboard distinguishes finding counts from distinct affected objects.
- Every actionable finding contains a source URL, exact supporting text, a
  rationale, and an executable regression test for a human to review.
- `NONE` decisions remain auditable without appearing as risks; no finding
  does not establish that an object is safe.
- Planted examples and unrelated objects are checked independently; publish
  measured results only after live-model evaluation.

## Team workflow

Use a branch per task and keep schema migrations additive after the baseline
is installed. Run the unit tests before a pull request; GitHub Actions repeats
them on Python 3.11 and 3.13. Do not commit local reports, OCI keys, wallets or
customer exports. Update this guide when interfaces or setup commands change.

## Official API references

- [Oracle vector distance](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/vector_distance.html)
- [DBMS_VECTOR embedding parameters](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/utl_to_embedding-and-utl_to_embeddings-dbms_vector.html)

Model names in the original document are examples. Verify availability in the
chosen tenancy before using them; this starter does not assert that a particular
model is deployed or available in a region.
