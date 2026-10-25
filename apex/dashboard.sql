select run_id, release_code, status, mode, started_at, completed_at,
       objects_checked, features_considered, candidates_selected,
       classified_pairs, breaking_count, test_count, opportunity_count,
       actionable_count, affected_objects
from rr_run_summary
where customer = :G_CUSTOMER
  and run_id = :P2_RUN_ID
