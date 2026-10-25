# Problem, customer and differentiation evidence

Reviewed October 25, 2026. Public sources below establish a recurring release
management workflow. They are not customer interviews or proof that this product
has demand.

## Specific problem and user

**Initial user:** a Fusion Sales or Service administrator or release lead who
maintains customer extensions, reports, integrations and workflows. An
implementation partner may repeat the same review across customers.

**Job:** identify relevant quarterly changes, relate them to the customer's
configuration, decide what to test, and assign owners before production updates.
The painful handoff is between a general release note and a specific,
reviewable customer action.

| Evidence | What it supports | Limit |
| --- | --- | --- |
| [Oracle: Quarterly updates made easy](https://blogs.oracle.com/fusioninsider/quarterly-updates-made-easy) | Quarterly cadence and the need to review release details and test customizations, including integrations, extensions, reports and workflows | Guidance does not measure our users' labor or willingness to buy |
| [Oracle ERP: Harness the Business Value of Quarterly Updates](https://blogs.oracle.com/erp-ace/harness-the-business-value-of-quarterly-updates) | Custom reports and roles need customer-specific attention; Oracle notes limited visibility into custom BI Publisher data models | ERP evidence supports the broader problem; the current app has limited ERP coverage |
| [Oracle: Cloud Applications Readiness](https://docs.oracle.com/en/cloud/saas/readiness/news.html) | Release changes span multiple application families and quarters | The site is not a count of addressable paying customers |
| [Opkey Oracle release advisories](https://www.opkey.com/oracle-advisory) | An existing vendor markets impact analysis and testing recommendations around quarterly updates | A vendor offering is evidence of an alternative, not independent demand validation |

These sources show the problem extends beyond the fictional Northwind example.
They do not justify a market-size estimate, a savings percentage, or a claim that
customers have adopted Release Radar.

## Before and after

| Stage | Manual baseline to evaluate in a pilot | Current product |
| --- | --- | --- |
| Gather context | Locate release notes and a customer inventory | Import a local inventory and use a versioned source catalog |
| Assess relevance | Search text, compare objects, copy references | Transparent type/module/term matches with source quotations |
| Decide what to test | Draft a checklist and discuss applicability | Inspect suggested tests and record a human decision |
| Handoff | Copy tasks into a spreadsheet and assign owners | Export CSV/Markdown/JSON with owner, evidence and next action |

This is a proposed workflow comparison. No time reduction has yet been measured
with real users.

## Alternatives and positioning

| Alternative | Established value | Release Radar's proposed focus | Remaining proof |
| --- | --- | --- | --- |
| Oracle readiness documentation | Authoritative feature and enablement information | Connect a local inventory to a portable, cited action plan | Coverage and matching quality on unseen inventories |
| Spreadsheets and manual review | Flexible process with domain judgment | Reproducible matching plus a consistent evidence and handoff format | Whether reviewers accept it and save time |
| Opkey release advisories | Curated quarterly insights, impact analysis and testing recommendations | A lightweight browser workflow linking an uploaded inventory to individual review decisions | No claim of superior detection, automation or cost |

The current public code and rules are easy to copy. A possible future advantage
would be a maintained corpus of reviewed change-to-configuration mappings and
validated test outcomes across quarters, collected with customer permission.
That corpus and any resulting defensibility do not exist yet.

## Pilot and investment questions

Target three release teams and follow two quarterly review cycles. This is a
proposal, not an existing customer pipeline.

1. Have domain experts label relevant and irrelevant changes before testing.
2. Compare time to an accepted test plan with each team's current process.
3. Record accepted suggestions, false alarms, missed relevant changes, reviewer
   edits, and time spent investigating each suggestion.
4. Ask whether teams would use the tool again and who would approve payment.
5. Investigate a team subscription or consulting-partner license only after
   validating repeat use and willingness to pay; no price or revenue is assumed.

Potential impact is less repetitive triage, clearer ownership and a reusable
release audit trail. The next version should prove these benefits with observed
customer outcomes before adding more products or claiming a competitive moat.
