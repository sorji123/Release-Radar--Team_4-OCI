# Rubric review

Based on the scoring-rubric image supplied by the team. Work began from
`origin/main` at `0a00b70` on October 25, 2026, and incorporates the subsequent
`ce6a345` CI update. Weights total 100%.
The table maps each criterion to inspectable evidence; it does not assign a
predicted score or guarantee a passing judgment.

The team's chosen scope excludes OCI GenAI and Oracle-specific AI features.
The current public product uses explicit rules. AI-related criteria remain
unmet rather than being represented by fixture outputs or marketing claims.

## Demand Reality & Problem Severity — 25%

| Criterion | Submission evidence | Status |
| --- | --- | --- |
| Specific problem with clear pain | Customer-specific quarterly triage and ownership handoff, described on Demo & evidence and in [market evidence](MARKET_EVIDENCE.md) | Evidence supplied |
| Target user, what they do today, how this helps | Fusion admin/release lead; manual review versus import → evidence → decision → action plan | Demonstrable workflow; user interviews pending |
| Potential social, business or technical impact | Less repetitive triage and clearer ownership; pilot measures time and accepted actions | Hypothesis; no measured business impact claimed |

## Target Customer & Market Scope — 20%

| Criterion | Submission evidence | Status |
| --- | --- | --- |
| Clear user | Sales/Service release owners and implementation partners | Defined |
| Evidence beyond one isolated case | Oracle quarterly guidance, ERP custom-report concerns, cross-product readiness library and an existing competing offer | Public evidence supplied; no adoption proof |
| Novel use of AI | No model calls in the application | Not demonstrated under chosen scope |
| Creative problem-solving | Local import, source-linked triage, human review and portable action plan in one flow | Demonstrable |
| Differentiation | Explicit comparison with Oracle readiness, manual review and Opkey advisories | Positioning hypothesis; not validated superiority |
| Why it matters enough to use | Recurring release work and handoff; the demo makes the next action concrete | Hypothesis pending repeat-use pilots |

## Solution Fit & Product Design — 20%

| Criterion | Submission evidence | Status |
| --- | --- | --- |
| Makes the user's life obviously better | Ranked suggestions, exact references, suggested tests, owner and decision recording | Demonstrable; savings not measured |
| Before and after workflow | [Market workflow table](MARKET_EVIDENCE.md#before-and-after), in-app Demo & evidence | Supplied |
| Intuitive | No-login sample, import inspection, clear categories and accessible dialogs | Desktop/390-pixel walkthrough verified; see [verification record](VERIFICATION.md) |
| Key action easier | Turn a source-linked finding into an assigned, exportable review action | Implemented |
| Clean interface and workflow | Responsive layout; filters/search; history-aware navigation; failed uploads retain prior work | Implemented and covered by UI verification |

## Technical Execution & Demo Proof — 20%

| Criterion | Submission evidence | Status |
| --- | --- | --- |
| Working software users can open, verify and understand | [Public demo](https://sorji123.github.io/Release-Radar--Team_4-OCI/#demo), sample outcomes and source links | Verify deployment/CI on this branch before presentation |
| Live demo URL | Same URL, dedicated `#demo` route | Published by GitHub Actions |
| Clear login and verification steps | No login; [90-second walkthrough](SUBMISSION.md#90-second-walkthrough) and offline fallback | Supplied |
| Proper use of AI | No AI runtime; old harness is explicitly synthetic and separate | Not demonstrated |
| Architecture detail | [Current architecture](SUBMISSION.md#current-architecture-and-trust-boundaries), code map and deployment allowlist | Supplied |
| Performance | [Reproducible benchmark](benchmark.json), per-review matching time and CI budget | Measured matching only; not end-to-end or business latency |

## Differentiation & Investment Readiness — 15%

| Criterion | Submission evidence | Status |
| --- | --- | --- |
| Important, durable and meaningfully different | Recurring quarterly workflow; proposed inventory-to-evidence-to-owner handoff | Public problem evidence; product differentiation unvalidated |
| Better than alternatives | [Comparison](MARKET_EVIDENCE.md#alternatives-and-positioning) states a narrow proposed advantage without claiming better detection | Comparative pilot needed |
| Hard to copy | Potential maintained mapping/outcome history; public rules alone offer little defensibility | No established moat |
| What next version should prove | Independent precision/recall evaluation, three-team/two-quarter pilot, accepted plans and willingness to pay | Concrete proposed validation plan |

## Changes made for this review

- Based the work on the latest fetched main rather than the previous UI branch.
- Added a public demo/evidence route and a source-backed submission narrative.
- Added owner, evidence note and review status with a full CSV action-plan export.
- Preserved the previous inventory/review on failed imports and repaired back/deep-link navigation.
- Supported the repository's Financials ZIP as a limited native setup preview,
  with unverified customization status and unsupported tables disclosed.
- Distinguished an older live release index from a genuinely newer quarter.
- Added JavaScript checks and a performance budget to CI; packaged public assets
  through an allowlist and restored current-code Pages deployment.
- Removed the tracked local authentication file and ignored it. Historical
  exposure still requires credential rotation by its owner.
- Rewrote current product/deployment docs to match the implementation and scope.

## Remaining evidence that code cannot manufacture

Customer interviews, adoption, measured time savings, willingness to pay and a
defensible data advantage require real validation. The AI criteria conflict with
the chosen no-AI scope and cannot honestly be marked complete. Present the
working review workflow strongly and disclose these limits when asked.
