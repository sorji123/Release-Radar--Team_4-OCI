# Development guide

The current product is a static browser application with deterministic review
rules. It does not use OCI Generative AI or other Oracle AI integrations.
The original Python classification harness and database scripts are separate
prototype resources, not the runtime behind the public website.

## Work locally

```bash
python -m release_radar site
python -m unittest discover -s tests -v
node tests/web/core.test.mjs
node scripts/benchmark_web.mjs --output build/benchmark.json
python -m release_radar build-site
```

Use Python 3.11+ and Node 24. No third-party packages are needed.
The site runs at `http://127.0.0.1:8765`. Browser checks cover parsing, limits,
matching, real-export compatibility, review decisions, and safe CSV/Markdown
exports. Python checks cover source validation, public packaging, the local
server allowlist, and the separate synthetic harness.

## Code boundaries

| File | Responsibility |
| --- | --- |
| `web/rr-core.js` | Pure import, rule matching, human-decision validation, report formatting |
| `web/rr-app.js` | Navigation, dialogs, upload state, demo guide and browser interactions |
| `web/rr-style.css` | Responsive visual system and focus states |
| `web/rr-data.js` | Generated catalog and sample payload; do not edit directly |
| `data/releases/26D.json` | Source-linked feature catalog, matching terms and suggested tests |
| `release_radar/site.py` | Build validation, static output and optional public readiness check |

Maintain a new source with its actual release, exact URL, a short verified
excerpt, activation conditions, an actionable test and a known expected result.
Do not rename old notes to a newer quarter. Verify with
`python scripts/verify_release_sources.py`, rebuild, and add independent cases
that test both relevance and false positives.

## State and import rules

- Imports remain in memory. A failed replacement keeps the previous inventory
  and review. A successful replacement clears the old report.
- The sample is fictional and stays labeled. Native setup previews do not
  assert custom status, module ownership, or impact.
- Verified/not-applicable decisions require a reviewer note. The UI cannot
  automatically verify a suggested test.
- Every export contains the complete report, including unmatched objects.
  CSV cells are quoted and formula prefixes neutralized.
- Navigation uses browser history and supports `#demo`, `#overview`,
  `#configuration`, `#review`, and `#sources`.

## Performance and validation

The benchmark performs one warmup and 25 measured matching runs at 8, 250,
and 1,000 objects. CI requires p95 below 1,000 ms at 1,000 objects against the
11-note catalog. This budget excludes import, rendering, network, human work
and execution of the suggested tests. Keep the scope visible when citing it.

Before sharing, exercise upload, sample review, a source link, a review
decision, exports, an invalid replacement, browser Back, and mobile layout.
Verify the live URL after Pages deployment succeeds.

## Next development proof

1. Have domain reviewers label independent inventories before tuning rules.
2. Measure precision, missed changes and reviewer corrections.
3. Broaden real release coverage only with reviewed sources and regression cases.
4. Extend native export mapping with explicit semantics and customization flags.
5. Run pilots to measure time to an accepted test plan and willingness to pay.

The synthetic `python -m release_radar demo` command remains available to
exercise the original candidate/citation contracts. Its vectors and outputs
are fixtures and do not demonstrate model performance.
