-- Future Oracle 23ai integration; not executed/compiled on Oracle locally.
-- Pure SQL/PLSQL: also usable in SQL Workshop > SQL Scripts.
create or replace package rr_demo_api authid definer as
    function bootstrap return clob;
    function run_analysis(p_customer varchar2, p_release varchar2) return number;
    function report(p_run_id number) return clob;
end rr_demo_api;
/

create or replace package body rr_demo_api as
    c_customer constant varchar2(100) := 'Northwind Telecom';
    c_release constant varchar2(10) := 'DEMO';
    c_version constant varchar2(100) := 'apex-fixture-v1';

    procedure require_true(p_ok boolean) is
    begin
        if p_ok is null or not p_ok then
            raise_application_error(-20052, 'Fixture validation failed. Restore the demo seed.');
        end if;
    end;

    function text_field(p_json json_object_t, p_key varchar2,
                        p_allow_empty boolean default false) return varchar2 is
        l_element json_element_t;
        l_text varchar2(32767);
    begin
        require_true(p_json.has(p_key));
        l_element := p_json.get(p_key);
        require_true(l_element.is_string());
        l_text := p_json.get_string(p_key);
        -- Bounded authored responses; source descriptions remain unrestricted CLOBs.
        require_true(nvl(lengthb(l_text), 0) <= 16000);
        if not p_allow_empty then
            require_true(regexp_like(l_text, '[^[:space:]]'));
        end if;
        return l_text;
    end;

    procedure validate_response(p_response clob, p_title varchar2,
                                p_description clob, p_opt_in varchar2,
                                p_severity out varchar2, p_confidence out number,
                                p_rationale out clob, p_citation out clob,
                                p_test out clob) is
        l_json json_object_t;
        l_element json_element_t;
        l_test json_object_t;
        l_steps json_array_t;
        l_text varchar2(32767);
        l_citation varchar2(32767);
    begin
        require_true(dbms_lob.getlength(p_response) <= 64000);
        l_json := json_object_t.parse(p_response);
        p_severity := text_field(l_json, 'severity');
        require_true(p_severity in ('BREAKING', 'TEST', 'OPPORTUNITY', 'NONE'));
        require_true(l_json.has('confidence'));
        l_element := l_json.get('confidence');
        require_true(l_element.is_number());
        p_confidence := l_json.get_number('confidence');
        require_true(p_confidence between 0 and 100);
        p_rationale := text_field(l_json, 'rationale');
        l_citation := text_field(l_json, 'cited_text', true);
        p_citation := l_citation;
        if p_severity <> 'NONE' then
            require_true(regexp_like(l_citation, '[^[:space:]]'));
        end if;
        if l_citation is not null then
            require_true(nvl(instr(p_title, l_citation), 0) > 0
                or nvl(dbms_lob.instr(p_description, l_citation), 0) > 0);
        end if;
        if p_severity = 'OPPORTUNITY' then require_true(p_opt_in = 'Y'); end if;
        require_true(l_json.has('test_case'));
        l_element := l_json.get('test_case');
        p_test := null;
        if l_element.is_null() then
            require_true(p_severity = 'NONE');
        else
            require_true(l_element.is_object());
            l_test := l_json.get_object('test_case');
            l_text := text_field(l_test, 'title');
            l_text := text_field(l_test, 'expected');
            require_true(l_test.has('steps'));
            l_element := l_test.get('steps');
            require_true(l_element.is_array());
            l_steps := l_test.get_array('steps');
            require_true(l_steps.get_size() between 1 and 100);
            for i in 0 .. l_steps.get_size() - 1 loop
                l_element := l_steps.get(i);
                require_true(l_element.is_string());
                l_text := l_steps.get_string(i);
                require_true(regexp_like(l_text, '[^[:space:]]'));
            end loop;
            p_test := l_test.to_clob();
        end if;
    end;

    function run_analysis(p_customer varchar2, p_release varchar2) return number is
        -- The demo owns only its transaction, never the caller's pending work.
        pragma autonomous_transaction;
        l_run number;
        l_count number;
        l_pairs number := 0;
        l_severity varchar2(20);
        l_confidence number;
        l_rationale clob;
        l_citation clob;
        l_test clob;
    begin
        if p_customer is null or p_release is null
           or p_customer <> c_customer or p_release <> c_release then
            raise_application_error(-20050, 'Only Northwind Telecom / DEMO is available.');
        end if;
        insert into analysis_runs (customer, release_code, mode, embedding_model,
            chat_model, prompt_version, distance_threshold, top_k)
        values (c_customer, c_release, 'FIXTURE', 'fixture-4d',
            'fixture-responses', c_version, 0.60, 3)
        returning run_id into l_run;
        savepoint demo_run_created;

        select count(*) into l_count from config_objects where customer = c_customer;
        require_true(l_count = 6);
        select count(*) into l_count from config_objects where customer = c_customer
          and object_key in ('nw-account-sync', 'nw-backlog-report', 'nw-summary-field',
                            'nw-quote-validation', 'nw-service-tab', 'nw-discount-approval');
        require_true(l_count = 6);
        select count(*) into l_count from release_features where release_code = c_release;
        require_true(l_count = 4);
        select count(*) into l_count from release_features where release_code = c_release
          and source_kind = 'SYNTHETIC'
          and feature_key in ('demo-account-api', 'demo-backlog-report',
                              'demo-service-summary', 'demo-payroll-layout');
        require_true(l_count = 4);
        select count(*) into l_count from rr_demo_responses
        where customer = c_customer and release_code = c_release;
        require_true(l_count = 4);

        -- Exact prepared pairs. Distances come from authored offline 4D fixtures.
        -- No vector search, model inference, expected labels, or network calls.
        for p in (
            select d.object_key, d.feature_key, d.distance, d.response_json,
                   o.object_id, f.feature_id, f.title, f.description, f.opt_in,
                   f.source_kind
            from rr_demo_responses d
            join config_objects o on o.customer = d.customer and o.object_key = d.object_key
            join release_features f on f.release_code = d.release_code
                and f.feature_key = d.feature_key and f.module = o.module
            where d.customer = c_customer and d.release_code = c_release
              and ((d.object_key = 'nw-account-sync' and d.feature_key = 'demo-account-api' and d.distance = 0)
                or (d.object_key = 'nw-backlog-report' and d.feature_key = 'demo-backlog-report' and d.distance = 0)
                or (d.object_key = 'nw-summary-field' and d.feature_key = 'demo-service-summary' and d.distance = 0)
                or (d.object_key = 'nw-quote-validation' and d.feature_key = 'demo-account-api' and d.distance = 0.2))
            order by d.object_key, d.feature_key
        ) loop
            require_true(p.source_kind = 'SYNTHETIC');
            validate_response(p.response_json, p.title, p.description, p.opt_in,
                l_severity, l_confidence, l_rationale, l_citation, l_test);
            insert into impact_findings (run_id, object_id, feature_id, distance,
                severity, confidence, rationale, cited_text, test_case)
            values (l_run, p.object_id, p.feature_id, p.distance,
                l_severity, l_confidence, l_rationale, l_citation, l_test);
            l_pairs := l_pairs + 1;
        end loop;
        require_true(l_pairs = 4);
        update analysis_runs set status = 'COMPLETED', completed_at = systimestamp,
            objects_checked = 6, features_considered = 4, candidates_selected = l_pairs
        where run_id = l_run;
        commit;
        return l_run;
    exception when others then
        if l_run is not null then
            rollback to demo_run_created;
            update analysis_runs set status = 'FAILED', completed_at = systimestamp,
                error_message = 'Fixture analysis failed validation or storage. Restore the demo seed and retry.'
            where run_id = l_run;
            commit;
            raise_application_error(-20051, 'Fixture analysis failed. See fixture run history.');
        end if;
        rollback;
        raise;
    end;

    function decision_rows(p_run_id number, p_actionable number) return clob is
        l_json clob;
    begin
        select coalesce(json_arrayagg(json_object(
            'object_key' value o.object_key, 'object_name' value o.name,
            'object_type' value o.object_type, 'module' value o.module,
            'object_description' value o.description, 'snippet' value o.snippet,
            'feature_key' value f.feature_key, 'feature_title' value f.title,
            'feature_description' value f.description, 'source_url' value f.source_url,
            'source_kind' value f.source_kind, 'distance' value i.distance,
            'severity' value i.severity, 'confidence' value i.confidence,
            'rationale' value i.rationale,
            'cited_text' value coalesce(i.cited_text, empty_clob()),
            'test_case' value i.test_case format json returning clob)
            order by coalesce(v.finding_rank, 2147483647), o.object_key, f.feature_key
            returning clob), to_clob('[]')) into l_json
        from impact_findings i
        join config_objects o on o.object_id = i.object_id and o.customer = c_customer
        join release_features f on f.feature_id = i.feature_id and f.release_code = c_release
            and f.source_kind = 'SYNTHETIC' and f.module = o.module
        left join rr_ranked_findings v on v.finding_id = i.finding_id
        where i.run_id = p_run_id and (p_actionable = 0 or v.finding_id is not null);
        return l_json;
    end;

    function report(p_run_id number) return clob is
        l_run rr_run_summary%rowtype;
        l_findings clob;
        l_decisions clob;
        l_json clob;
    begin
        select * into l_run from rr_run_summary
        where run_id = p_run_id and customer = c_customer and release_code = c_release
          and mode = 'FIXTURE' and embedding_model = 'fixture-4d'
          and chat_model = 'fixture-responses' and prompt_version = c_version;
        l_findings := decision_rows(p_run_id, 1);
        l_decisions := decision_rows(p_run_id, 0);
        select json_object(
            'schema_version' value 1, 'run_id' value l_run.run_id,
            'status' value l_run.status, 'mode' value l_run.mode,
            'notice' value 'SYNTHETIC fixtures and canned matching; no model calls or live vector search. Not Oracle release guidance.',
            'customer' value l_run.customer, 'release_code' value l_run.release_code,
            'embedding_model' value l_run.embedding_model, 'chat_model' value l_run.chat_model,
            'prompt_version' value l_run.prompt_version,
            'top_k' value l_run.top_k, 'threshold' value l_run.distance_threshold,
            'started_at' value to_char(sys_extract_utc(l_run.started_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            'completed_at' value to_char(sys_extract_utc(l_run.completed_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            'error_message' value case when l_run.status = 'FAILED' then 'Fixture analysis failed. Restore the demo seed and retry.' end,
            'summary' value json_object(
                'objects_checked' value l_run.objects_checked,
                'release_features' value l_run.features_considered,
                'candidate_pairs' value l_run.candidates_selected,
                'findings_by_severity' value json_object(
                    'BREAKING' value l_run.breaking_count, 'TEST' value l_run.test_count,
                    'OPPORTUNITY' value l_run.opportunity_count returning clob),
                'objects_with_findings' value l_run.affected_objects,
                'objects_without_findings' value greatest(0, l_run.objects_checked - l_run.affected_objects)
                returning clob),
            'findings' value l_findings format json,
            'decisions' value l_decisions format json returning clob)
        into l_json from dual;
        return l_json;
    exception when no_data_found then
        raise_application_error(-20053, 'Fixture run not available.');
    end;

    function bootstrap return clob is
        l_runs clob;
        l_report clob;
        l_latest number;
        l_json clob;
    begin
        select coalesce(json_arrayagg(json_object(
            'run_id' value run_id, 'customer' value customer, 'release_code' value release_code,
            'status' value status, 'mode' value mode,
            'started_at' value to_char(sys_extract_utc(started_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            'completed_at' value to_char(sys_extract_utc(completed_at), 'YYYY-MM-DD"T"HH24:MI:SS.FF3"Z"'),
            'objects_checked' value objects_checked, 'candidate_pairs' value candidates_selected,
            'actionable_count' value actionable_count,
            'error_message' value case when status = 'FAILED' then 'Fixture analysis failed. Restore the demo seed and retry.' end
            returning clob) order by run_id desc returning clob), to_clob('[]')) into l_runs
        from (select * from rr_run_summary
              where customer = c_customer and release_code = c_release and mode = 'FIXTURE'
                and embedding_model = 'fixture-4d' and chat_model = 'fixture-responses'
                and prompt_version = c_version
              order by run_id desc fetch first 50 rows only);
        select max(run_id) into l_latest from analysis_runs
        where customer = c_customer and release_code = c_release and mode = 'FIXTURE'
          and embedding_model = 'fixture-4d' and chat_model = 'fixture-responses'
          and prompt_version = c_version and status = 'COMPLETED';
        if l_latest is not null then l_report := report(l_latest); end if;
        select json_object('mode' value 'FIXTURE',
            'customers' value json_array(c_customer returning clob),
            'releases' value json_array(json_object('code' value c_release,
                'label' value 'Demo release' returning clob) returning clob),
            'runs' value l_runs format json, 'report' value l_report format json returning clob)
        into l_json from dual;
        return l_json;
    end;
end rr_demo_api;
/

-- SQL clients can report success even when CREATE PACKAGE compiles with errors.
select name, type, line, position, text from user_errors
where name = 'RR_DEMO_API' order by sequence;
declare
    l_count number;
begin
    select count(*) into l_count from user_objects
    where object_name = 'RR_DEMO_API' and object_type in ('PACKAGE', 'PACKAGE BODY')
      and status = 'VALID';
    if l_count <> 2 then
        raise_application_error(-20054, 'RR_DEMO_API compilation failed; inspect USER_ERRORS.');
    end if;
end;
/
