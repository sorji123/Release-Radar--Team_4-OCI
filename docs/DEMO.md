# Team demo

This feature branch adds a working browser prototype. The shareable preview
uses GitHub Pages; Oracle APEX remains the planned application platform.

## Run locally

From the repository root, with Python 3.11+:

```bash
python scripts/build_demo_data.py
python -m http.server 8080 --bind 127.0.0.1 --directory web
```

Open `http://127.0.0.1:8080`. Serve the folder over HTTP rather than opening
`index.html` directly, because the browser fetches the prepared JSON dataset.

## Present the product in 90 seconds

1. Explain the task: understand how an upcoming Fusion release may affect a
   customer's customizations, with evidence and test cases for each finding.
2. Select Northwind Telecom and the Demo release, then run the prepared demo.
3. Show the severity totals and the prioritized findings.
4. Open the account integration finding. Compare the configuration snippet
   with the quoted release text, then show the regression test.
5. Open the optional service-summary finding to show an adoption opportunity.
6. Filter/search the list and export the result for team review.

Be explicit: **this is an interactive prototype using synthetic source data,
authored vectors and prepared responses.** The preview makes no model calls,
does not access Fusion environments, and cannot assess a real customer's data.
The confidence values belong to the fixtures. Do not present the results as
measured AI detection accuracy.

## Publishing the preview

The `Publish demo preview` workflow tests the Python pipeline, regenerates
`web/demo-data.json`, and deploys **only `web/`** through GitHub Pages.
Pushes to `feature/apex-live-demo` or `develop` trigger publication. The latest
successful deployment is the currently visible preview; the deployment uses
the `github-pages` environment. Repository credentials and backend code are
outside the uploaded web artifact.

The static preview uses prepared responses in the browser. New preview runs
are local to the page session; refreshing restores the published prepared
dataset. It is designed to demonstrate the workflow, not server persistence.

## APEX integration after the preview

The frontend includes an APEX AJAX adapter for `RR_BOOTSTRAP` and
`RR_RUN_ANALYSIS`. The matching fixture database package and seed are under
`database/demo/`. The SQL still requires validation in the target Oracle
environment before use.

To create a self-contained Static Content region for the later APEX app:

```bash
python scripts/build_apex_region.py
```

Use the generated `build/apex-region.html` with the two AJAX processes supplied
by the database integration. The region is a convenience bundle, not a complete
APEX application export. The same prepared-data labels remain in APEX; live
OCI embedding and classification are a separate integration milestone.
