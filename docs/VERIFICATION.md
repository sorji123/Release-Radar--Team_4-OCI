# Verification record — October 25, 2026

This record distinguishes automated checks, observed browser behavior and
unvalidated claims. Re-run the commands in [DEVELOPMENT.md](DEVELOPMENT.md)
to reproduce the automated checks.

| Check | Observed result |
| --- | --- |
| Python regression suite | 30 tests passed |
| JavaScript browser-core suite | 37 checks passed, including real ZIP extraction and review/export validation |
| Official source verification | All 11 catalog excerpts found on their referenced Oracle pages |
| Native Financials ZIP | 94 setup definitions extracted from four supported tables; other tables reported as skipped |
| Sample review | 8 objects; 2 REVIEW, 2 TEST, 2 OPPORTUNITY; 2 unmatched |
| Human review validation | Verified/not-applicable status without evidence is rejected |
| CSV handoff | Downloaded file inspected: 8 rows, QA team assignment and action note retained |
| Invalid replacement | Prior inventory, findings and recorded decision retained |
| Browser Back | Returned to the existing review with the recorded decision |
| Phone layout | Reviewed at 390 × 844; navigation and decision form fit; no horizontal page overflow |
| Browser console | No error entries during the exercised walkthrough |
| Public packaging | Only the explicit public assets are included; unexpected output files fail the build |

The [benchmark JSON](benchmark.json) records the runtime, platform, sample sizes,
iterations and p50/p95 measurements. It measures matching only.

Not validated: AI inference, business time savings, customer adoption, native
setup impact detection, APEX deployment, or actual execution of suggested
regression tests. There is no claim of certification or guaranteed judging score.
