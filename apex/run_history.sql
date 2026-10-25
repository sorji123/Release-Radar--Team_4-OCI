select run_id, release_code, status, mode, started_at, completed_at,
       objects_checked, actionable_count, affected_objects
from rr_run_summary
where customer = :G_CUSTOMER
order by started_at desc, run_id desc
