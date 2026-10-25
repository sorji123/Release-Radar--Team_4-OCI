select finding_id, object_name, object_type, module, object_description, snippet,
       feature_title, feature_description, opt_in, source_kind, source_url,
       severity, confidence, rationale, cited_text, test_case, mode
from rr_ranked_findings
where customer = :G_CUSTOMER
  and run_id = :P3_RUN_ID
  and finding_id = :P3_FINDING_ID
  and run_status = 'COMPLETED'
