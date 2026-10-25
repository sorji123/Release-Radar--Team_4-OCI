# APEX starter page guide

**Oracle APEX is the selected application platform.** See the
[deployment plan](../docs/DEPLOYMENT.md) for the first live milestone.

There is no exported APEX application yet. Install the database scripts first,
create an app in the target APEX workspace, and use the page definitions below.
The SQL files in this folder are region sources, not SQLcl install scripts.

## Shared setup

- Use the schema containing `rr_run_summary` and `rr_ranked_findings` as the
  parsing schema. Configure authentication for the team/demo users.
- Create application item `G_CUSTOMER`, set server-side to a customer the
  signed-in user is authorized to access. The initial demo can restrict it to
  `Northwind Telecom`. Do not trust a browser-supplied customer value.
- Protect run/finding page items with session state protection and enforce run
  ownership server-side. Bind variables scope queries; they do not replace
  authorization. Define authorization before allowing multiple customers.
- Keep escaping enabled for configuration text, model output, evidence and test
  steps. Treat source URLs as external links and validate their schemes.
- Display `mode`, source kind, run status and any failure state. Clearly label
  synthetic fixture results wherever they are displayed.

## Page 1: release selection and run history

Create `P1_RELEASE_CODE` as a select list from distinct `release_features.release_code`.
Use `run_history.sql` for an interactive report with links to page 2, passing
`run_id` into `P2_RUN_ID`.

Add a Run Analysis button only when the team implements a working server entry
point. It should pass the authorized customer and selected release to the
writer, receive the generated run ID, then navigate to page 2. The repository
does not currently define `run_analysis`; adding a process that calls it now
would fail. For UI development, load an explicitly labeled fixture run through
a reviewed loader or use isolated temporary data in a development schema.

## Page 2: dashboard and findings

Create protected hidden item `P2_RUN_ID`. Use `dashboard.sql` for a summary/cards
region and `findings.sql` for the findings report. Show Breaking, Needs testing,
and Opt-in opportunity counts, plus objects checked and affected objects.

Link `finding_id` to page 3 as `P3_FINDING_ID` and carry the run into `P3_RUN_ID`.
Sort by `finding_rank`; the view itself does not guarantee display ordering.
The summary can show failed/in-progress runs, while the findings report only
displays completed runs. Do not present partial results as a completed analysis.

## Page 3: evidence and regression test

Create protected items `P3_RUN_ID` and `P3_FINDING_ID`. Use `finding_detail.sql`
to fetch exactly one authorized finding. Lay out the configuration description
and snippet beside the release title, description, opt-in flag, URL and quote.
Render rationale and confidence, then parse `test_case` into title, ordered steps
and expected result using APEX JSON handling or `JSON_TABLE`. Keep output escaped.

The executive summary/download is a later feature. First make one complete
path from a run to evidence and a usable test work on the live URL.

## Export and check

After pages work in the workspace, save a reproducible APEX export under
`apex/exports/` and document the export's APEX version and install steps here.
An app export should not contain runtime credentials or customer data. Verify
that a fresh import works, invalid run IDs reveal no results, and the demo login
works from another device before considering the app ready.
