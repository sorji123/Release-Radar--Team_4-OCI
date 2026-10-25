# Release Radar database baseline

SQL assets for the Oracle Autonomous Database + OCI Generative AI + APEX design in the root README and `Release Radar.docx`. These files create storage and read queries only. **Cloud orchestration is not implemented:** there is no `run_analysis` procedure, embedding call, classifier, credential setup, or APEX application here.

Oracle APEX is the selected application platform. These tables and read views support its pages; see the [APEX deployment plan](../docs/DEPLOYMENT.md).

**Verification status:** local file/SQL lexical checks passed. Candidate and view semantics passed an in-memory SQLite check with adapted Oracle functions (scope, top three, ties, strict cutoff, empty runs, counts, and ordering). This does not validate Oracle DDL, VECTOR behavior, or PL/SQL compilation. **Not installed or executed on a live Oracle database.** Run the server checks below before claiming deployment or integration success.

## Install with SQLcl

Use a fresh application schema on an Oracle Autonomous Database version supporting `VECTOR(1024, FLOAT32)` and `VECTOR_DISTANCE` (the plan targets 23ai/26ai). The owner needs `CREATE TABLE`, `CREATE VIEW`, and sufficient tablespace quota. Provision access and configure a wallet/TNS connection separately; this repository contains no credentials or cloud setup.

Start SQLcl from the repository root. The connection example prompts for the password; replace the schema and configured TNS alias with your own values.

```text
sql /nolog
connect RADAR@your_configured_tns_alias
@database/001_schema.sql
@database/002_views.sql
@database/verify.sql
@database/smoke.sql
```

Use a dedicated session with no pending work for `smoke.sql`: it disables autocommit and rolls back the session on success or failure. It inserts only synthetic rows, makes no network/model calls, and leaves identity sequence gaps. It checks scoped stable keys, candidate filtering/ties/top three, finding constraints, run lifecycle states, empty-run summaries, `NONE` exclusion, and severity ranking. The candidate assertion mirrors `candidates.sql`; keep both queries aligned when changing retrieval. The smoke run's deliberately partial classification count exercises reporting; it is not a completed production pipeline.

`verify.sql` prints compilation diagnostics and raises an error if baseline tables/views are missing, **any** object in the application schema is invalid, or baseline constraints are disabled/unvalidated. Scripts exit SQLcl on SQL/OS errors. Save the actual server output as verification evidence.

`001_schema.sql` is a one-time, non-destructive initial migration. It refuses to run if any baseline table name already exists; it never drops, truncates, or replaces tables. It is not an idempotent upgrade. Oracle DDL commits implicitly, so a failure can leave a partial installation that rollback cannot undo. Inspect that state and prepare a reviewed repair migration. `002_views.sql` can be rerun to replace these two view definitions.

## Storage contract

| Table | Purpose and keys |
| --- | --- |
| `release_features` | Identity `feature_id`; external `feature_key` unique within `release_code`. Required module, title, CLOB description, explicit `opt_in` (`Y`/`N`) and `source_kind` (`SYNTHETIC`/`ORACLE`). Oracle sources require `source_url`. |
| `config_objects` | Identity `object_id`; external `object_key` unique within `customer`. Required type/name/module/description; optional snippet. Types: `GROOVY`, `APP_COMPOSER`, `PAGE_COMPOSER`, `WORKFLOW`, `OIC`, `REPORT`. No expected-severity or evaluation labels. |
| `analysis_runs` | Identity `run_id`; customer/release, explicit `FIXTURE` or `OCI` mode, status, counters, timestamps, error, model/prompt provenance, threshold and top-k. |
| `impact_findings` | Identity `finding_id`; foreign keys to run/object/feature; unique `(run_id, object_id, feature_id)`; distance, severity, confidence, CLOB rationale/evidence (`cited_text`), JSON CLOB `test_case`. |

Both embedding columns are nullable 1024-dimensional FLOAT32 vectors to support loading before embedding. Use one compatible embedding model/version and input recipe across both datasets; reject zero/non-finite vectors in the loader. Model changes require re-embedding both sides. Stable keys are input identifiers, not generated numeric IDs. Normalize module/customer/release values consistently before loading; matching uses equality without fuzzy normalization. Evaluation truth belongs in separate offline data and must never enter configuration descriptions or classifier input.

Run status defaults to `RUNNING`. Set `status` and `completed_at` together on completion or failure; `FAILED` also requires an `error_message`, and other states disallow it. This enforces valid row states, not transition history. A future writer must allow only `RUNNING` to terminal transitions, decide commit/retry behavior, and reject writes to terminal runs. Do not put secrets in error text.

Counters are caller-maintained nonnegative integers: `objects_checked` is the number of objects actually examined, `features_considered` is the release-feature pool considered, and `candidates_selected` is the number of pairs selected for classification. They are not inferred from findings; a checked object may have no candidates. Record real `embedding_model`, `chat_model`, and `prompt_version` before completing an OCI run. These are nullable during setup; fixture runs should use explicit fixture provenance rather than claim an OCI model ran. Default retrieval metadata is `distance_threshold = 0.60`, `top_k = 3`.

Severity is `BREAKING`, `TEST`, `OPPORTUNITY`, or `NONE`; confidence is 0..100 and cosine distance is 0..2. The writer must require cited text and a test case for non-`NONE` findings. `test_case` must be strict JSON with unique object keys when supplied. The intended object shape is `{"title":"...","steps":["..."],"expected":"..."}`. The database checks JSON syntax, not required evidence, that shape, nonempty CLOB content, quote grounding, or an opportunity's opt-in eligibility; validate those in the future writer. The schema avoids compound CLOB null-check constraints; the run's error summary is a bounded `VARCHAR2(4000)` so its lifecycle checks use scalar values. Foreign keys ensure existence, not that a finding's customer/release/module agrees with its run: validate that scope before insertion. There are no cascade deletes. Keep source rows immutable after use, or add versioning/snapshots before allowing edits; views join their current text.

## Candidate query and APEX reads

`candidates.sql` uses exact cosine distance, excludes null vectors on both sides, filters the named customer/release and equal module, then selects at most three features **per object** with distance **strictly below 0.60**. Smaller distance means closer; 0.60 is a distance cutoff, not a similarity score. Ties sort by the stable feature key using binary collation, then numeric feature ID. No approximate vector index or cloud call is needed for this small baseline. See Oracle's [VECTOR_DISTANCE reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/vector_distance.html).

```sql
variable customer varchar2(100)
variable release_code varchar2(10)
begin
    :customer := 'Northwind Telecom';
    :release_code := '26D';
end;
/
@database/candidates.sql
```

The query has exactly two named binds, `:customer` and `:release_code`. A driver executes its SELECT without the final SQLcl semicolon. Baseline threshold/top-k are constants; changing run metadata alone does not change retrieval. If tuning them later, change the query, defaults, smoke assertions, and writer together, or introduce validated numeric binds and persist their actual values.

`rr_run_summary` includes empty/failed runs, metadata, classified-pair counts by severity, actionable-pair count, and distinct affected-object count. `NONE` is auditable but is not an actionable finding. Do not label the difference between checked and affected objects as proven safe. `rr_ranked_findings` excludes `NONE` and ranks each run by severity (`BREAKING`, `TEST`, `OPPORTUNITY`), confidence descending, distance ascending, then numeric IDs. A view does not guarantee display order; use `ORDER BY finding_rank`.

Example report SQL for the future APEX pages:

```sql
select * from rr_run_summary
where customer = :P1_CUSTOMER
order by started_at desc, run_id desc;

select * from rr_ranked_findings
where customer = :P2_CUSTOMER and run_id = :P2_RUN_ID
order by finding_rank;

select * from rr_ranked_findings
where customer = :P2_CUSTOMER and run_id = :P2_RUN_ID
  and severity in ('BREAKING', 'TEST')
order by finding_rank fetch first 3 rows only;
```

These views provide no row-level authorization. APEX must authorize customer access and validate run ownership, protect session state, escape report/detail text, and clearly show fixture mode and incomplete/failed status. Successful-run-only dashboards should additionally filter `status = 'COMPLETED'` or `run_status = 'COMPLETED'` as appropriate.

## Next wiring

1. Load curated release/configuration records using their scoped stable keys; keep synthetic and Oracle sources distinguishable. Add the loader and separate offline evaluation data outside this directory.
2. Implement and validate embedding generation against the chosen OCI model and database version. Store actual provenance; exclude missing vectors and report their coverage.
3. Build orchestration: create a run, retrieve candidates, assemble grounded prompts, validate classification JSON/evidence/test shape and customer/release/module scope, persist findings and counters, then finish or fail the run atomically according to a documented transaction policy. Do not bind an APEX button to a nonexistent `run_analysis` procedure.
4. Wire APEX selectors, run history, reports and detail/test pages to the authorized data. Run `verify.sql` and `smoke.sql` manually on the target server, then test the real end-to-end flow separately.
