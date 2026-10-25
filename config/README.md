# Configuration examples

`fusion-customizations.example.json` is the fictional Northwind inventory used
by the website. It is a normalized inventory and remains visibly labeled as a
sample in the UI and exports.

The repository's Financials setup ZIP can be previewed through a limited native
adapter. See the [MVP import contract](../docs/MVP.md#import-contract) for supported
tables, skipped content, and the distinction between a setup definition and a
confirmed customization.

Keep real customer exports outside Git. The website reads files in browser
memory; it does not upload them to a backend or model.

`oci-embedding.example.json` is a historical template from the original build
plan. It is not used by the current website or required for the submission.
OCI GenAI and Oracle-specific AI integration are outside the current scope.
