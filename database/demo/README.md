# Future APEX fixture backend

**Not deployed, compiled, or executed on Oracle.** These scripts are optional future
integration work. The GitHub Pages prepared-data dashboard does not depend on them.
Local checks cover fixture parity and generated SQL content, not Oracle execution.

Everything is explicitly `FIXTURE` / `SYNTHETIC`. There are no model, credential,
network, or vector-search calls. Existing four application tables and the two views
are used unchanged; one `rr_demo_responses` table holds authored JSON responses,
keyed by release/customer/object/feature. `expected.json` is never read.

## Installation when an Oracle environment is available

Use an Oracle 23ai-compatible schema with the existing `001_schema.sql` and
`002_views.sql` already installed. Do not rerun the fresh-schema baseline over an
existing database. The owner needs CREATE TABLE, CREATE PROCEDURE and quota.

In a dedicated SQLcl session, from the repository root:

```sql
@database/demo/install.sql
@database/demo/smoke.sql
```

`install.sql` has SQLcl error-exit directives and relative includes. For browser
SQL Workshop, use **SQL Scripts** and run `seed.sql`, then `package.sql`, then
optionally `smoke.sql` separately. Those files have no SQLcl directives. Inspect
the package compilation diagnostics; successful local generation is not proof of
Oracle compatibility. Smoke creates two committed fixture runs; it requires a
dedicated session because its scope probe is rolled back.

Seed is idempotent: creates its response table only if absent and merges six
objects, four features and four responses by stable keys. It preserves identities
and run history. DDL commits implicitly; seed DML commits together or rolls back.
Seeding resets these fixture rows, including null embeddings. The 4D vectors are
never loaded into the baseline 1024D columns. Existing views join current source
text, so this is a fixed demonstration dataset, not a historical snapshot system.

`generate_seed.py` rebuilds the checked-in seed offline from the source JSON and
derives the four canned distances from `embeddings.json`. It writes only
`database/demo/seed.sql`. Python is optional at deployment time.

## API and APEX wiring

The definer-rights package exposes only:

```sql
rr_demo_api.bootstrap()                                      -- CLOB
rr_demo_api.run_analysis('Northwind Telecom', 'DEMO')          -- NUMBER run_id
rr_demo_api.report(run_id)                                   -- CLOB
```

`run_analysis` must be called from PL/SQL. It accepts exactly the named customer
and release (nulls and other values fail). It owns an autonomous transaction:
all four decisions and COMPLETED status commit together; validation/storage
failure rolls back decisions, commits a sanitized FAILED run, and raises -20051.
Invalid scope raises -20050 before creating a run. A caller rollback does not undo
API runs. Do not hold locks on fixture source rows while calling the API.

Matching joins only the four prepared response pairs and verifies dataset counts,
module alignment, source kind, distance, JSON types, severity, confidence, nonempty
rationale, verbatim evidence, opportunity opt-in, and test-case shape. It does not
infer impacts or compare against evaluation labels. Provenance `fixture-4d` /
`fixture-responses` identifies canned offline matching, not live model execution.

Reports retain all four `decisions`, including NONE. `findings` contains only the
three actionable rows in existing view rank order. Summary: 6 objects, 4 features,
4 pairs, one BREAKING, one TEST, one OPPORTUNITY, 3 objects with findings and 3
without findings. Absence of a finding is not proof of safety. Source strings and
JSON aggregates use CLOB output; `test_case` is a JSON object rather than a quoted
JSON string. Reports check customer/release/mode and package provenance.

Create APEX On Demand application processes in the existing application's parsing
schema, using its existing authentication/authorization scheme:

- `RR_BOOTSTRAP`: paste `bootstrap-process.sql`.
- `RR_RUN_ANALYSIS`: paste `run-process.sql`; `x01` is customer and `x02` release.

Process files are PL/SQL editor snippets, with no slash terminator. No public grants
or authentication changes are supplied. Bootstrap returns
`{mode, customers, releases, runs, report}`; runs are newest-first, capped at 50,
and report is the latest completed fixture report or JSON null before the first
run. Analysis returns the full report directly. Errors return a JSON object with
`mode` and a fixed `error` string; callers must check `error` even on HTTP success.
The snippets build the response before writing headers and print CLOB chunks with
`htp.prn`, preserving JSON without truncation or inserted newlines. See Oracle's
[CLOB output example](https://docs.oracle.com/en/industries/retail/retail-data-store-cloud-services/23.1.401.0/rdsig/c_extension.htm).

Before future deployment, execute smoke on Oracle and exercise a corrupted
response in a disposable schema to verify FAILED status and zero partial findings;
restore with seed.sql. Neither server smoke nor that failure-path exercise has
been executed in this change.
