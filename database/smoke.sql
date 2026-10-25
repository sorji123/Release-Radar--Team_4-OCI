-- MANUAL: use a dedicated SQLcl session after verify.sql. No cloud/model calls.
-- All test rows are rolled back on success or failure; identity values are consumed.
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback
set autocommit off
set serveroutput on
set define off

declare
    l_customer varchar2(100) := 'RR_SMOKE_' || rawtohex(sys_guid());
    l_release varchar2(10) := 'RR_SMOKE';
    l_other_release varchar2(10) := 'RR_OTHER';
    l_module varchar2(50) := rawtohex(sys_guid());
    l_vector varchar2(32767) := '[1';
    l_opposite varchar2(32767) := '[-1';
    l_run number;
    l_empty_run number;
    l_object number;
    l_object2 number;
    l_feature number;
    l_feature2 number;
    l_finding number;
    l_discard number;
    l_count number;
    l_rank number;

    procedure assert_true(p_ok boolean, p_message varchar2) is
    begin
        if p_ok is null or not p_ok then
            raise_application_error(-20010, p_message);
        end if;
    end;

    function add_feature(p_key varchar2, p_module varchar2,
                         p_release varchar2, p_vector varchar2) return number is
        l_id number;
    begin
        insert into release_features
            (feature_key, release_code, module, title, description, opt_in, source_kind, embedding)
        values (l_customer || p_key, p_release, p_module, 'Smoke feature',
                'Synthetic evidence for smoke testing.', 'N', 'SYNTHETIC',
                to_vector(p_vector, 1024, float32))
        returning feature_id into l_id;
        return l_id;
    end;

    function add_object(p_key varchar2, p_customer varchar2, p_vector varchar2) return number is
        l_id number;
    begin
        insert into config_objects
            (object_key, customer, object_type, name, module, description, embedding)
        values (p_key, p_customer, 'GROOVY', 'Smoke object', l_module,
                'Synthetic configuration.', to_vector(p_vector, 1024, float32))
        returning object_id into l_id;
        return l_id;
    end;

    -- Negative finding updates must fail for the intended Oracle constraint reason.
    procedure reject_finding(p_set varchar2, p_code number) is
    begin
        begin
            execute immediate 'update impact_findings set ' || p_set || ' where finding_id = :id'
                using l_finding;
        exception when others then
            if sqlcode = p_code then return; end if;
            raise;
        end;
        raise_application_error(-20011, 'Accepted invalid finding: ' || p_set);
    end;
begin
    -- Nonzero 1024-dimensional unit vectors; no model or external service involved.
    for n in 2..1024 loop
        l_vector := l_vector || ',0';
        l_opposite := l_opposite || ',0';
    end loop;
    l_vector := l_vector || ']';
    l_opposite := l_opposite || ']';

    -- Insert ties in reverse key order so ranking cannot accidentally use insertion order.
    l_discard := add_feature('_D', l_module, l_release, l_vector);
    l_discard := add_feature('_C', l_module, l_release, l_vector);
    l_feature2 := add_feature('_B', l_module, l_release, l_vector);
    l_feature := add_feature('_A', l_module, l_release, l_vector);
    l_discard := add_feature('_NULL', l_module, l_release, null);
    l_discard := add_feature('_FAR', l_module, l_release, l_opposite);
    l_discard := add_feature('_MODULE', l_module || '_OTHER', l_release, l_vector);
    -- Same stable key is legal in a different release.
    l_discard := add_feature('_A', l_module, l_other_release, l_vector);
    l_object := add_object('one', l_customer, l_vector);
    l_object2 := add_object('two', l_customer, l_vector);
    l_discard := add_object('null-vector', l_customer, null);
    -- Same stable key is legal for a different customer.
    l_discard := add_object('one', l_customer || '_OTHER', l_vector);

    begin
        l_discard := add_feature('_A', l_module, l_release, l_vector);
        raise_application_error(-20012, 'Duplicate release/feature key accepted.');
    exception when dup_val_on_index then null;
    end;
    begin
        l_discard := add_object('one', l_customer, l_vector);
        raise_application_error(-20013, 'Duplicate customer/object key accepted.');
    exception when dup_val_on_index then null;
    end;

    -- Mirrors candidates.sql with local variables replacing its named binds.
    l_count := 0;
    for p in (
        with scored as (
            select o.object_id, o.object_key, f.feature_id, f.feature_key,
                   vector_distance(o.embedding, f.embedding, cosine) as distance
            from config_objects o
            join release_features f on f.module = o.module
            where o.customer = l_customer and f.release_code = l_release
              and o.embedding is not null and f.embedding is not null
        ), ranked as (
            select s.*, row_number() over (
                partition by object_id
                order by distance, nlssort(feature_key, 'NLS_SORT=BINARY'), feature_id
            ) as candidate_rank
            from scored s where distance < 0.60
        )
        select object_id, feature_key, distance, candidate_rank
        from ranked where candidate_rank <= 3
    ) loop
        l_count := l_count + 1;
        assert_true(p.object_id in (l_object, l_object2), 'Customer/null-object filter failed.');
        assert_true(abs(p.distance) < 0.000001, 'Unexpected cosine distance.');
        assert_true(p.feature_key = l_customer || case p.candidate_rank
            when 1 then '_A' when 2 then '_B' when 3 then '_C' end,
            'Scope, threshold, null-feature exclusion, or deterministic tie failed.');
    end loop;
    assert_true(l_count = 6, 'Expected exactly three candidates for each of two objects.');

    insert into analysis_runs (customer, release_code, mode, embedding_model, chat_model, prompt_version)
    values (l_customer, l_release, 'FIXTURE', 'smoke-unit-vectors', 'smoke-no-model', 'smoke-v1')
    returning run_id into l_run;
    insert into analysis_runs (customer, release_code, mode)
    values (l_customer, l_release, 'FIXTURE') returning run_id into l_empty_run;

    select count(*) into l_count from rr_run_summary
    where run_id = l_empty_run and status = 'RUNNING' and classified_pairs = 0
      and actionable_count = 0 and affected_objects = 0;
    assert_true(l_count = 1, 'Empty run must appear with zero counts.');

    insert into impact_findings
        (run_id, object_id, feature_id, distance, severity, confidence, rationale, cited_text, test_case)
    values (l_run, l_object, l_feature, 0, 'BREAKING', 80, 'Synthetic test rationale.',
            'Synthetic evidence', '{"title":"Smoke","steps":["Check"],"expected":"Pass"}')
    returning finding_id into l_finding;
    insert into impact_findings
        (run_id, object_id, feature_id, distance, severity, confidence, rationale, cited_text, test_case)
    values (l_run, l_object, l_feature2, 0, 'TEST', 100, 'Synthetic test rationale.',
            'Synthetic evidence', '{"title":"Smoke","steps":["Check"],"expected":"Pass"}');
    insert into impact_findings
        (run_id, object_id, feature_id, distance, severity, confidence, rationale)
    values (l_run, l_object2, l_feature, 2, 'NONE', 0, 'No impact established.');

    begin
        insert into impact_findings
            (run_id, object_id, feature_id, distance, severity, confidence, rationale)
        values (l_run, l_object2, l_feature, 0, 'NONE', 0, 'Duplicate pair.');
        raise_application_error(-20014, 'Duplicate run/object/feature accepted.');
    exception when dup_val_on_index then null;
    end;
    reject_finding('severity = ''UNKNOWN''', -2290);
    reject_finding('confidence = -1', -2290);
    reject_finding('confidence = 101', -2290);
    reject_finding('distance = -0.01', -2290);
    reject_finding('distance = 2.01', -2290);
    reject_finding('test_case = ''not json''', -2290);
    reject_finding('test_case = ''{"title":"one","title":"two"}''', -2290);
    reject_finding('feature_id = -1', -2291);

    begin
        update analysis_runs set status = 'COMPLETED' where run_id = l_run;
        raise_application_error(-20015, 'Completion without timestamp accepted.');
    exception when others then
        if sqlcode <> -2290 then raise; end if;
    end;
    update analysis_runs
    set status = 'COMPLETED', completed_at = systimestamp,
        objects_checked = 2, features_considered = 4, candidates_selected = 6
    where run_id = l_run;
    update analysis_runs
    set status = 'FAILED', completed_at = systimestamp, error_message = 'Intentional smoke failure.'
    where run_id = l_empty_run;

    select count(*) into l_count from rr_run_summary
    where run_id = l_run and status = 'COMPLETED' and classified_pairs = 3
      and breaking_count = 1 and test_count = 1 and opportunity_count = 0
      and none_count = 1 and actionable_count = 2 and affected_objects = 1;
    assert_true(l_count = 1, 'Summary must distinguish pair counts, NONE, and affected objects.');
    select count(*) into l_count from rr_ranked_findings where run_id = l_run;
    assert_true(l_count = 2, 'Ranked findings must exclude NONE.');
    select finding_rank into l_rank from rr_ranked_findings where finding_id = l_finding;
    assert_true(l_rank = 1, 'BREAKING must rank before TEST even at lower confidence.');
    select count(*) into l_count from rr_run_summary
    where run_id = l_empty_run and status = 'FAILED' and classified_pairs = 0;
    assert_true(l_count = 1, 'Failed empty run must remain visible.');

    rollback;
    select count(*) into l_count from analysis_runs where customer = l_customer;
    assert_true(l_count = 0, 'Smoke rows were not rolled back.');
    dbms_output.put_line('PASS: smoke assertions succeeded; all test rows rolled back.');
exception when others then
    rollback;
    raise;
end;
/
