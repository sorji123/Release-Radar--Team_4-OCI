whenever oserror exit failure rollback
whenever sqlerror exit failure rollback
set define off

-- Includes runs with no findings; counts are pairs, not distinct objects.
create or replace view rr_run_summary as
select r.run_id, r.customer, r.release_code, r.status, r.mode,
       r.objects_checked, r.features_considered, r.candidates_selected,
       r.started_at, r.completed_at, r.error_message,
       r.embedding_model, r.chat_model, r.prompt_version,
       r.distance_threshold, r.top_k,
       nvl(f.classified_pairs, 0) as classified_pairs,
       nvl(f.breaking_count, 0) as breaking_count,
       nvl(f.test_count, 0) as test_count,
       nvl(f.opportunity_count, 0) as opportunity_count,
       nvl(f.none_count, 0) as none_count,
       nvl(f.actionable_count, 0) as actionable_count,
       nvl(f.affected_objects, 0) as affected_objects
from analysis_runs r
left join (
    select run_id, count(*) as classified_pairs,
           sum(case when severity = 'BREAKING' then 1 else 0 end) as breaking_count,
           sum(case when severity = 'TEST' then 1 else 0 end) as test_count,
           sum(case when severity = 'OPPORTUNITY' then 1 else 0 end) as opportunity_count,
           sum(case when severity = 'NONE' then 1 else 0 end) as none_count,
           sum(case when severity <> 'NONE' then 1 else 0 end) as actionable_count,
           count(distinct case when severity <> 'NONE' then object_id end) as affected_objects
    from impact_findings
    group by run_id
) f on f.run_id = r.run_id;

-- NONE stays in the base table for audit but does not become a displayed risk.
-- Consumers must filter by authorized customer + run_id and ORDER BY finding_rank.
create or replace view rr_ranked_findings as
select i.finding_id, i.run_id, r.customer, r.release_code,
       r.status as run_status, r.mode,
       i.object_id, o.object_key, o.object_type, o.name as object_name,
       o.module, o.description as object_description, o.snippet,
       i.feature_id, f.feature_key, f.title as feature_title,
       f.description as feature_description, f.opt_in, f.source_kind, f.source_url,
       i.distance, i.severity, i.confidence, i.rationale, i.cited_text, i.test_case,
       case i.severity when 'BREAKING' then 1 when 'TEST' then 2
                       when 'OPPORTUNITY' then 3 end as severity_order,
       row_number() over (
           partition by i.run_id
           order by case i.severity when 'BREAKING' then 1 when 'TEST' then 2
                                    when 'OPPORTUNITY' then 3 end,
                    i.confidence desc, i.distance, i.object_id, i.feature_id, i.finding_id
       ) as finding_rank
from impact_findings i
join analysis_runs r on r.run_id = i.run_id
join config_objects o on o.object_id = i.object_id
join release_features f on f.feature_id = i.feature_id
where i.severity <> 'NONE';

prompt APEX read views created. Run verify.sql to check server object status.
