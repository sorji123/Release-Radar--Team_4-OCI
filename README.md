# Release Radar

**Understand what an Oracle Fusion Cloud update means for your business—before you apply it.**

Release Radar is a proposed AI assistant that compares Oracle Fusion Cloud release notes with a customer's customizations. It helps teams identify potential breaking changes, decide what to test, and discover new features that could replace custom work.

> Upload your configuration, pick the release, get a ranked impact report with the regression tests already written.

Built for the **AI World Hackathon** by **Team 4**.

**Project status:** MVP planning. This repository contains the [hackathon build plan](Release%20Radar.docx) and this guide. The application, sample datasets, and deployment are planned work; the features below describe the intended MVP.

## Why Release Radar?

Quarterly updates introduce changes across Oracle Fusion applications. Administrators and implementation teams need to understand how those changes affect their own scripts, workflows, integrations, reports, and page customizations.

The build plan describes a process that can take one to two weeks: read release notes, compare them with configuration spreadsheets, identify risks, and write regression tests by hand.

Release Radar aims to turn that review into a focused list of actions, with supporting release-note text for every finding. The time savings are a project goal and still need to be measured.

## Who is it for?

- **Fusion application administrators** preparing for quarterly updates.
- **Functional leads** responsible for Sales, Service, ERP, or HCM processes.
- **System integrator (SI) teams** managing releases for customers.

## What will users get?

Each finding will connect a release feature to a specific customer configuration object and provide:

- An impact category and confidence score.
- A short explanation of the potential effect.
- The release-note text supporting the finding.
- A regression test with steps and an expected result.

| Category | What it means | Suggested action |
| --- | --- | --- |
| **Breaking** | The supplied release information indicates that existing behavior will change or stop without action. | Review the affected configuration and plan a fix. |
| **Needs testing** | A related change may affect the configuration, but breakage is not established. | Run the generated regression test. |
| **Opt-in opportunity** | An optional new feature could replace something the customer built manually. | Evaluate whether to enable the feature. |
| **No relevant impact found** | The supplied information does not establish a strong connection. | No finding is raised for that pair; this does not prove the configuration is unaffected. |

The planned executive summary will show counts by category, the top three risks, and an effort estimate.

## Planned user journey

1. **Select a customer and release.** The first demo uses a prepared sample customer and dataset.
2. **Run the analysis.** Release Radar compares configurations with relevant release features.
3. **Review the dashboard.** Findings appear in priority order, with breaking changes first.
4. **Inspect a finding.** View the configuration snippet beside the supporting release-note text.
5. **Open the generated test.** Review the steps and expected result before testing in the customer's environment.
6. **Review or download the summary.** Share the main risks and next steps with stakeholders once the summary feature is implemented.

Uploading a customer's own CSV or JSON configuration is a secondary MVP feature. The first working flow uses curated data.

## How it works

The planned application uses Oracle Autonomous Database to store data and coordinate analysis, OCI Generative AI to create embeddings and evaluate potential impacts, and Oracle APEX to present the results.

```mermaid
flowchart TD
    A[Oracle release notes] --> C[Create embeddings with OCI Generative AI]
    B[Customer configuration] --> C
    C --> D[Store data and vectors in Autonomous Database]
    D --> E[Find likely matches with vector search]
    E --> F[Classify impact and generate tests with OCI Generative AI]
    F --> G[Save findings with supporting release text]
    G --> H[Oracle APEX dashboard and finding details]
```

The analysis has three main steps:

1. **Embed:** Convert release features and configuration descriptions into numerical representations of their meaning.
2. **Match:** Use vector search to select likely relationships. The initial design takes up to three release features per configuration object, filters by module, and applies a distance threshold that needs tuning.
3. **Classify and cite:** Ask the language model to evaluate each candidate pair using only the supplied text, quote its evidence, and generate a test. Weak connections should return `NONE`.

| Component | Responsibility |
| --- | --- |
| Oracle Autonomous Database | Store release features, configuration objects, embeddings, and findings. |
| AI Vector Search | Narrow the release features considered for each configuration object. |
| OCI Generative AI | Generate embeddings, impact classifications, explanations, and tests. |
| SQL and PL/SQL | Coordinate the analysis and save results. |
| Oracle APEX | Provide customer/release selection, dashboards, and finding details. |
| Python with the OCI SDK | Serve as a fallback for model calls if the PL/SQL integration blocks progress. |

The primary design does not require a separate application server. The Python fallback would write findings to the same database for APEX to display.

## Demo data

The build plan proposes **26D** as the demo release and **Northwind Telecom** as a fictional customer.

### Release features

Manually curate **20–30 real Oracle What's New items** for the selected release. Capture the release, module, feature title, description, and customer-action or opt-in information. Use Oracle's stated opt-in flag rather than asking the model to infer it.

### Customer configurations

Create approximately **25 fictional configuration objects**:

| Configuration type | Planned count | Example |
| --- | --- | --- |
| Groovy scripts or object functions | 5 | Require a signed quote before closing an opportunity. |
| App Composer custom objects or fields | 5 | A Site Survey object linked to a Service Request. |
| Page Composer or Visual Builder changes | 4 | A custom tab or hidden fields on a service page. |
| Workflows or approval rules | 3 | Route discounts above 15% for approval. |
| Oracle Integration Cloud (OIC) integrations | 4 | Synchronize accounts with a billing system. |
| BI Publisher (BIP) or OTBI reports | 4 | Report weekly service-request backlog. |

Each object should include its type, name, module, description, and a code or configuration snippet where useful.

Include a small set of deliberately matched examples with expected impact categories, plus unrelated objects. These provide a basic check that the analysis catches relevant changes without flagging everything. Example counts and performance figures in the build plan are illustrative, not measured results.

## MVP scope

| Priority | Planned capabilities |
| --- | --- |
| **Must have** | Curated release and configuration data; vector matching; AI classification with confidence and citations; a regression test per finding; a live APEX app with demo login and results dashboard. |
| **Should have** | A one-page executive summary and CSV/JSON configuration uploads. |
| **Could have** | CSV export of test cases and comparison of two releases. |
| **Future work** | Direct connections to Fusion environments and automatic ingestion of Oracle release content. |

The first milestone is one complete, reliable path from selecting a customer and release to reviewing cited findings and generated tests on a live URL.

## Getting started with implementation

Use the [Release Radar build plan](Release%20Radar.docx) for the SQL/PLSQL skeletons, classification prompt, detailed schedule, and demo script.

### Prerequisites

- An OCI tenancy with access to Autonomous Database and OCI Generative AI.
- A database version that supports the vector features used in the design.
- An Oracle APEX workspace and application schema.
- OCI credentials and database network access configured for model calls.
- Available embedding and chat models in the chosen OCI region.

Confirm model names, endpoints, and regional availability before adapting the document's sample code.

### Suggested build order

1. **Establish the foundation.** Provision the database, create an APEX app and demo user, verify the live URL, and complete one embedding call.
2. **Prepare and load data.** Create `release_features`, `config_objects`, and `impact_findings`; load the two curated datasets and generate embeddings.
3. **Build the analysis.** Retrieve candidate matches, classify them with the supplied prompt, validate the returned JSON and cited text, and save findings under an analysis run.
4. **Build the interface.** Add the run form, severity counts, findings list, and detail page with evidence and generated tests.
5. **Validate and polish.** Check known examples, measure runtime, prepare a cached result, and add the executive summary if time permits.

The original plan budgets roughly six hours. Prioritize a working live demo, then add secondary features.

## Demo readiness checklist

- [ ] Known breaking examples are correctly identified.
- [ ] Unrelated examples do not produce false breaking alerts.
- [ ] Every finding includes supporting text that appears in its release item.
- [ ] Generated tests include clear steps and an expected result.
- [ ] Detection results are recorded against the prepared examples.
- [ ] Analysis completes within the two-minute demo target, or a cached run is ready.
- [ ] The live URL and demo login work from another device.
- [ ] A short backup video is available.

The planned 90-second demo follows one breaking finding from the dashboard to its evidence and test case, then shows an opt-in opportunity and the summary.

## Roadmap

- Import configurations directly from Fusion environments and OIC exports.
- Ingest release content automatically each quarter.
- Use administrator feedback to improve feature-to-configuration matching.
- Send generated tests to customer test-automation tools and track results.
- Pilot with two or three customers and measure time spent on release-impact analysis before and after adoption.

## Repository contents

| File | Description |
| --- | --- |
| [README.md](README.md) | Project overview, planned workflow, scope, and implementation guide. |
| [Release Radar.docx](Release%20Radar.docx) | Original hackathon build plan, architecture, code skeletons, validation checklist, and pitch outline. |
