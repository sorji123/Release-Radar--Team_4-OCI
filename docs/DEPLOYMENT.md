# APEX deployment plan

**Selected platform: Oracle APEX.** The application follows the original build
plan: Autonomous Database stores source data, vectors and analysis results;
OCI Generative AI supplies embeddings and classifications; APEX presents the
run form, dashboard, finding evidence and regression tests.

## Current state

The repository includes a working browser MVP with configuration import,
reviewed 26D sources, deterministic matching, readable findings and report
downloads. Install its static assets in APEX using [the MVP guide](MVP.md).
The local preview's Python server serves public assets and checks Oracle's
readiness index; customer analysis takes place in the browser.

The database setup scripts, region SQL, classification prompt and Python
fixture harness remain the foundation for the future database/OCI pipeline.
No live OCI model, database-backed analysis writer or full APEX export is
claimed by this MVP. The deployment sequence below applies to that next stage.

## Deployment sequence

1. Provision an Autonomous Database supporting the required VECTOR features,
   create the application schema and APEX workspace, and establish team access.
2. Apply `database/001_schema.sql` and `database/002_views.sql` in a fresh
   schema, then run `database/verify.sql` and `database/smoke.sql`. Record the
   actual server output; these scripts have not been verified on a live Oracle
   instance as part of this starter.
3. Configure the database credential and network access for OCI outside Git.
   Confirm the chosen region/model and verify one embedding call before loading
   and embedding the real release dataset.
4. Implement the analysis writer: create a run, match candidates, call the
   classifier, validate evidence/tests, save decisions and finish or fail the
   run with accurate counts. Use PL/SQL first, or the Python fallback if needed.
5. Build the three pages in `apex/README.md`. Configure authentication and
   customer/run authorization, then connect Run Analysis to the working entry
   point. Keep source and model text escaped when rendering.
6. Export the app into `apex/exports/`; document the APEX version and import
   instructions. Verify the export in a separate development workspace before
   publishing the demo URL.

## First live milestone

A signed-in demo user selects Northwind Telecom and a release, starts analysis,
sees a completed or failed run, opens a ranked finding with exact source
evidence, and reads its regression test. Keep synthetic data visibly labeled.
Measure the live flow before claiming runtime or detection accuracy.

Before sharing the app, check the login from another device, confirm invalid
run IDs reveal no data, and save a pre-run result plus a short backup recording.
Document the actual environment settings, app ID, deployment commands and
recovery steps once the first deployment works. Keep keys and database wallets
outside version control.
