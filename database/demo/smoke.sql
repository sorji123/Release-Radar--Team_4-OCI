-- MANUAL Oracle check. NOT executed locally. SQL Workshop SQL Scripts compatible.
-- Run after seed.sql + package.sql. Creates TWO committed FIXTURE demo runs.
-- Enable SERVEROUTPUT in SQLcl to see PASS; assertion failures raise errors.
declare
    l_run number;
    l_again number;
    l_foreign number;
    l_count number;
    l_json clob;
    l_root json_object_t;
    l_summary json_object_t;
    l_severities json_object_t;
    l_array json_array_t;
    l_element json_element_t;
    l_finding json_object_t;

    procedure check_true(p_ok boolean, p_message varchar2) is
    begin
        if p_ok is null or not p_ok then raise_application_error(-20060, p_message); end if;
    end;

    procedure reject_scope(p_customer varchar2, p_release varchar2) is
        l_id number;
    begin
        l_id := rr_demo_api.run_analysis(p_customer, p_release);
        raise_application_error(-20061, 'Invalid scope accepted.');
    exception when others then
        if sqlcode <> -20050 then raise; end if;
    end;
begin
    l_root := json_object_t.parse(rr_demo_api.bootstrap());
    check_true(l_root.get_string('mode') = 'FIXTURE', 'Bootstrap mode.');
    l_array := l_root.get_array('customers');
    check_true(l_array.get_size() = 1 and l_array.get_string(0) = 'Northwind Telecom', 'Customer list.');
    l_array := l_root.get_array('releases');
    check_true(l_array.get_size() = 1, 'Release list.');

    reject_scope('Another Customer', 'DEMO');
    reject_scope('Northwind Telecom', '26D');
    reject_scope(null, 'DEMO');
    reject_scope('Northwind Telecom', null);
    l_run := rr_demo_api.run_analysis('Northwind Telecom', 'DEMO');
    l_again := rr_demo_api.run_analysis('Northwind Telecom', 'DEMO');
    check_true(l_again <> l_run, 'Each request creates a distinct run.');
    select count(*) into l_count from rr_run_summary
    where run_id in (l_run, l_again) and mode = 'FIXTURE' and status = 'COMPLETED'
      and objects_checked = 6 and features_considered = 4 and candidates_selected = 4
      and classified_pairs = 4 and breaking_count = 1 and test_count = 1
      and opportunity_count = 1 and none_count = 1 and actionable_count = 3
      and affected_objects = 3 and completed_at >= started_at
      and embedding_model = 'fixture-4d' and chat_model = 'fixture-responses';
    check_true(l_count = 2, 'Counts, lifecycle, NONE audit, or provenance mismatch.');

    l_json := rr_demo_api.report(l_run);
    l_root := json_object_t.parse(l_json);
    check_true(l_root.get_number('run_id') = l_run, 'Report identity.');
    check_true(l_root.get_string('status') = 'COMPLETED', 'Report status.');
    check_true(l_root.get_string('customer') = 'Northwind Telecom', 'Report customer.');
    check_true(l_root.get_string('release_code') = 'DEMO', 'Report release.');
    l_summary := l_root.get_object('summary');
    check_true(l_summary.get_number('objects_checked') = 6, 'Objects checked.');
    check_true(l_summary.get_number('release_features') = 4, 'Features considered.');
    check_true(l_summary.get_number('candidate_pairs') = 4, 'Prepared pairs.');
    check_true(l_summary.get_number('objects_with_findings') = 3, 'Affected objects.');
    check_true(l_summary.get_number('objects_without_findings') = 3, 'Unaffected count.');
    l_severities := l_summary.get_object('findings_by_severity');
    check_true(l_severities.get_number('BREAKING') = 1 and l_severities.get_number('TEST') = 1
        and l_severities.get_number('OPPORTUNITY') = 1, 'Severity totals.');
    l_array := l_root.get_array('decisions');
    check_true(l_array.get_size() = 4, 'Four decisions including NONE.');
    l_array := l_root.get_array('findings');
    check_true(l_array.get_size() = 3, 'Three actionable findings.');
    for i in 0 .. l_array.get_size() - 1 loop
        l_element := l_array.get(i);
        l_finding := treat(l_element as json_object_t);
        check_true(l_finding.get_string('severity') = case i
            when 0 then 'BREAKING' when 1 then 'TEST' else 'OPPORTUNITY' end, 'Finding order.');
        check_true(l_finding.get_string('source_kind') = 'SYNTHETIC', 'Synthetic source.');
        check_true(l_finding.has('module') and l_finding.has('object_description')
            and l_finding.has('feature_description') and l_finding.has('snippet'), 'Source details.');
        l_element := l_finding.get('test_case');
        check_true(l_element.is_object(), 'test_case must be an object, not escaped JSON.');
    end loop;

    -- A non-demo provenance run must never be exposed, even in the allowed scope.
    insert into analysis_runs (customer, release_code, mode)
    values ('Northwind Telecom', 'DEMO', 'OCI') returning run_id into l_foreign;
    begin
        l_json := rr_demo_api.report(l_foreign);
        raise_application_error(-20062, 'Non-fixture run exposed.');
    exception when others then
        if sqlcode <> -20053 then raise; end if;
    end;
    rollback; -- Removes only the local scope probe; API runs are autonomous.
    begin
        l_json := rr_demo_api.report(-1);
        raise_application_error(-20063, 'Unknown run exposed.');
    exception when others then
        if sqlcode <> -20053 then raise; end if;
    end;
    l_root := json_object_t.parse(rr_demo_api.bootstrap());
    l_element := l_root.get('report');
    check_true(l_element.is_object(), 'Bootstrap includes a completed report.');
    dbms_output.put_line('PASS: fixture API, scope, report, and view assertions. Two demo runs retained.');
exception when others then
    rollback;
    raise;
end;
/
