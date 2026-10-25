-- Named input binds: :customer VARCHAR2(100), :release_code VARCHAR2(10).
-- Baseline settings: top_k = 3, distance_threshold = 0.60 (strictly less).
-- Exact search; module equality uses the canonical values loaded by the caller.
with scored as (
    select o.object_id, o.object_key, f.feature_id, f.feature_key,
           vector_distance(o.embedding, f.embedding, cosine) as distance
    from config_objects o
    join release_features f on f.module = o.module
    where o.customer = :customer
      and f.release_code = :release_code
      and o.embedding is not null
      and f.embedding is not null
), ranked as (
    select s.*,
           row_number() over (
               partition by object_id
               order by distance, nlssort(feature_key, 'NLS_SORT=BINARY'), feature_id
           ) as candidate_rank
    from scored s
    where distance < 0.60
)
select object_id, object_key, feature_id, feature_key, distance, candidate_rank
from ranked
where candidate_rank <= 3
order by object_id, candidate_rank;
