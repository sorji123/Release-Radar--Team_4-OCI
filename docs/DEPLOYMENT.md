# Deployment

The current submission is a static browser application on
[GitHub Pages](https://sorji123.github.io/Release-Radar--Team_4-OCI/#demo).
No login, backend database, AI service, or API credential is required.

## Public preview

`.github/workflows/demo-pages.yml` tests and builds the site on `main` and
`feature/rubric-readiness`, then deploys `build/site/`. The preview branch
allows review before merging into main. Pages deployment requires the
repository's Pages source to be **GitHub Actions**.

```bash
python -m release_radar build-site
```

The output contains only `index.html`, the five listed static assets, and
`.nojekyll`. The build rejects unexpected files in the public output directory.
The repository root, Financials export, and authentication files are never copied
into the public artifact. Use a clean build directory for a fresh package.

Verify the final Pages run and open `#demo` in a new browser session. Run the
sample, open evidence, record a decision, and download the action plan. The
static site shows the catalog verification date; it does not claim to check
Oracle's release index live.

## Local preview

`python -m release_radar site` serves only the public allowlist on
`127.0.0.1:8765`. The optional `/api/release-status` endpoint retrieves Oracle's
public index without sending inventory content. An unavailable network produces
a visible snapshot notice. The local server is not an authenticated public service.

## Optional APEX hosting

The same build writes `build/release-radar-apex-assets.zip`. Follow
[the MVP guide](MVP.md#add-the-mvp-to-an-apex-application) to load these as Static
Application Files and use `apex/mvp-region.html` in a Static Content region.
This uses APEX as a host for the current browser workflow and requires no Oracle
AI features. Verify layout, import, dialogs, downloads and authentication in the
actual workspace before claiming an APEX deployment.

No live APEX deployment is included in this submission. The historical database
and vector prototypes are not prerequisites for running this site.

## Local credentials

`authApexworkspace` is ignored and removed from the tracked branch. If a secret
was committed previously, deleting the current file does not remove it from
Git history; the owner must rotate it. Never put credentials or customer data
in the static asset directory.
