select finding_id, finding_rank, object_name, object_type, module,
       feature_title, severity, confidence, source_kind, mode
from rr_ranked_findings
where customer = :G_CUSTOMER
  and run_id = :P2_RUN_ID
  and run_status = 'COMPLETED'
order by finding_rank
