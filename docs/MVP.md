# Release Radar website MVP

The website accepts a customization inventory, checks it against a reviewed
selection of real Oracle 26D release notes, and explains each suggestion with
an official source, a next step and a regression test. It runs in the browser
and is packaged for an Oracle APEX Static Content page.

## Run the website

From the repository root, using Python 3.11 or newer:

```bash
python3 -m release_radar site
```

Open **http://127.0.0.1:8765**. Use `--port 8766` if that port is occupied.
No Python packages, npm installation, database or API key is required.

1. Choose **Try Northwind Telecom**, or import an inventory.
2. Inspect the extracted objects on **Your configuration**.
3. Choose **Review against 26D**.
4. Filter findings, open their evidence and suggested tests, and download the
   Markdown or JSON report.

The sample is fictional and visibly labeled. Its eight objects result in two
priority reviews, two testing suggestions, two opportunities and two objects
with no matching note. These numbers are behavior checks, not measured AI
accuracy. The old `python3 -m release_radar demo` command still runs its separate
synthetic pipeline fixtures.

## Import contract

The real Fusion export is pending. The MVP supports a **normalized inventory**,
not every native Fusion export package. Start with
[`config/fusion-customizations.example.json`](../config/fusion-customizations.example.json).

JSON can be a list or an envelope with `customer`, optional `source_release`,
and a `customizations` array. `config_objects`, `objects` and `items` are also
recognized array names. Grouped `groovyScripts`, `customObjects`, `customFields`,
`pageCustomizations`, `workflows`, `integrations` and `reports` are supported.

| Field | Meaning |
| --- | --- |
| `object_key` | Unique identifier. Recommended, and required to avoid identifier collisions when combining files. |
| `name` | Human-readable name; required. |
| `object_type` | `GROOVY`, `APP_COMPOSER`, `PAGE_COMPOSER`, `WORKFLOW`, `OIC`, or `REPORT`. Unknown types are retained for manual review. |
| `module` | Sales, Service, ERP, HCM, SCM or Common. Missing modules cannot match module-specific notes. |
| `description` | Purpose and affected features. Supply this or a snippet. |
| `snippet` | Optional relevant code/configuration text; displayed as text and never executed. |
| `is_custom` | Optional boolean. Explicit false values exclude standard objects and are counted in the import summary. |

CSV uses these fields as headers and supports quoted values, embedded commas
and multiline fields. XML uses a `configuration` root and `customization`,
`configObject` or `object` elements with named fields as attributes or children:

```xml
<configuration customer="Example Company">
  <customization object_key="service-page" object_type="PAGE_COMPOSER" module="Service">
    <name>Service request tab</name>
    <description>A custom tab on the Service Request details page.</description>
  </customization>
</configuration>
```

ZIPs may contain these inventories, including nested folders. Other file types
are skipped with a visible count. Supported files with invalid content fail the
import rather than silently producing partial results. Limits: 5 MB input,
10 MB expanded content, 100 ZIP entries and 1,000 objects. Encrypted ZIP, ZIP64,
XML DTDs and external entities are rejected. Native MDS/FSM/Visual Builder
package adapters will be based on the actual export when it arrives.

## What the review means

- **Review first:** a documented condition could affect the customization;
  someone must check that condition, such as a migration profile or retired view.
- **Needs testing:** a related change deserves a regression test.
- **Opportunity:** a standard capability may help replace or simplify custom work.
- **No matching note:** no rule matched the reviewed selection. This is not a
  guarantee that the object is safe or a complete assessment of its module.

The current catalog covers **11 selected Sales, Service and cross-application
notes**. It was checked against Oracle's official 26D documentation on
**October 25, 2026**. ERP, HCM and SCM have no dedicated feature coverage yet;
cross-application rules can still flag relevant reporting/extraction concerns.

`web/rr-core.js` uses explicit type, module and term-group rules. It does not
pretend to make live OCI model calls or assign unsupported confidence scores.
Future OCI/vector analysis can be added behind a separately tested adapter;
the existing offline Python harness remains intact.

## Latest-release checks and catalog updates

The preview checks Oracle's public readiness index without sending any
configuration data. It caches the result for five minutes. A newer published
quarter blocks a latest-release analysis until the catalog is updated. If
Oracle cannot be reached, a visible notice identifies the dated snapshot being
used. The check discovers the quarter; it does not ingest a new quarter's notes.

```bash
python3 -m release_radar check-release
python3 scripts/verify_release_sources.py
```

To maintain the catalog, review official feature pages, update
`data/releases/26D.json` (or add the new release and update the build target),
keep excerpts short, update the checked date, tune the explicit matching rules,
and add independent regression cases before rebuilding. Never rename old notes
to a newer quarter. `web/rr-data.js` is generated and checked in for deployment.

## Add the MVP to an APEX application

The browser assets use plain HTML, CSS and JavaScript. They do not need a Node
server or Python runtime in APEX. This is a Static Content integration, not a
full exported APEX application or the database-backed analysis implementation.
The package still needs to be verified in the team's actual APEX workspace.

1. Run `python3 -m release_radar build-site` to create
   `build/release-radar-apex-assets.zip`.
2. In your existing APEX application, upload and unzip the archive under
   **Shared Components → Static Application Files**. Keep filenames unchanged.
3. Create a page with a **Static Content** region. Paste
   [`apex/mvp-region.html`](../apex/mvp-region.html) as its source. Use a blank
   region template so the app's layout is not wrapped in a second panel.
4. In the page's **CSS → File URLs**, add `#APP_FILES#rr-style.css`.
5. In **JavaScript → File URLs**, add these files in this order:

   ```text
   #APP_FILES#rr-core.js
   #APP_FILES#rr-data.js
   #APP_FILES#rr-app.js
   ```

6. Use a page template with enough width for the workspace, and retain your
   application's appropriate authentication. The JavaScript initializes the
   region when the page loads. Test sample upload, a finding, a download and
   keyboard navigation before sharing the page URL.

In APEX, the default freshness display is the catalog's verification date.
It does not claim to check Oracle live. An optional administrator-provided
same-origin endpoint can be connected with `data-status-url="/your-endpoint"`
on the root div. It must return `{"latest_release":"26D"}` after inspecting the
current official index; never accept an arbitrary browser-supplied remote URL.

Oracle documentation: [static files](https://docs.oracle.com/en/database/oracle/apex/26.1/htmdb/managing-static-application-files.html),
[loading JavaScript](https://docs.oracle.com/en/database/oracle/apex/26.1/apxdc/including-helper-functions-all-pages.html).

## Privacy and review state

Uploaded files, extracted objects and findings stay in memory in the current
browser page. They are not written to localStorage or sent to a model/server.
Reloading clears them. Downloaded reports are created only when requested.
The local preview serves only the UI assets and a read-only release-status
endpoint; repository files and credentials are not served.

## Validation

```bash
python3 -m unittest discover -s tests -v
node tests/web/core.test.mjs
python3 -m release_radar build-site
git diff --check
```

Node 22+ is needed only for JavaScript checks, not to run or deploy the website.
CI checks Python behavior, browser-core logic and reproducible generated data.
Browser acceptance checks cover real JSON/XML/ZIP upload, invalid replacement
files, filters, evidence dialogs, report downloads and responsive layouts.
