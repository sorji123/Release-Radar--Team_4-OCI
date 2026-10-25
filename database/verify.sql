-- Read-only server verification. Execute as the application owner after install.
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback
set serveroutput on
set define off

select object_name, object_type, status
from user_objects
where object_name in ('RELEASE_FEATURES', 'CONFIG_OBJECTS', 'ANALYSIS_RUNS',
                      'IMPACT_FINDINGS', 'RR_RUN_SUMMARY', 'RR_RANKED_FINDINGS')
order by object_type, object_name;

select name, type, line, position, text
from user_errors
where name in ('RR_RUN_SUMMARY', 'RR_RANKED_FINDINGS')
order by name, sequence;

-- Include any invalid object in this application schema, not just the views.
select object_name, object_type, status
from user_objects where status = 'INVALID'
order by object_type, object_name;

declare
    l_count number;
begin
    select count(*) into l_count from user_objects
    where (object_name in ('RELEASE_FEATURES', 'CONFIG_OBJECTS', 'ANALYSIS_RUNS',
                          'IMPACT_FINDINGS') and object_type = 'TABLE')
       or (object_name in ('RR_RUN_SUMMARY', 'RR_RANKED_FINDINGS') and object_type = 'VIEW');
    if l_count <> 6 then
        raise_application_error(-20002, 'Expected four baseline tables and two views.');
    end if;

    select count(*) into l_count from user_objects where status = 'INVALID';
    if l_count <> 0 then
        raise_application_error(-20003, 'Invalid schema objects found; review diagnostics above.');
    end if;

    select count(*) into l_count from user_constraints
    where table_name in ('RELEASE_FEATURES', 'CONFIG_OBJECTS', 'ANALYSIS_RUNS', 'IMPACT_FINDINGS')
      and (status <> 'ENABLED' or validated <> 'VALIDATED');
    if l_count <> 0 then
        raise_application_error(-20004, 'Baseline constraints must be enabled and validated.');
    end if;
    dbms_output.put_line('PASS: baseline objects present, valid, and constraints enabled/validated.');
end;
/
