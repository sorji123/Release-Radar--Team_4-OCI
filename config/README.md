# OCI configuration example

`oci-embedding.example.json` is a parameter template for the planned in-database
embedding call. It is **not automatically loaded** by the offline Python demo.
Replace the region and model with verified tenancy values and create the named
database credential separately using your team's credential process. No secret
belongs in this template.

After your DBA has granted the required package/network access, assign the
filled JSON to a SQLcl CLOB bind named `embed_params`, then test one call:

```sql
select vector_dimension_count(
    dbms_vector.utl_to_embedding('Release Radar smoke test', json(:embed_params))
) as embedding_dimensions
from dual;
```

The result must match the schema's 1024 dimensions. This query makes a real
provider request and may incur OCI usage charges; it is a manual integration
step and has not been run by this starter. See Oracle's
[embedding API reference](https://docs.oracle.com/en/database/oracle/oracle-database/26/vecse/utl_to_embedding-and-utl_to_embeddings-dbms_vector.html)
for current parameters and credential setup links. Add verified chat parameters
alongside this file when implementing live classification.
