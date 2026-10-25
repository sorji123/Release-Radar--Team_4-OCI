-- Paste this block (no trailing slash) into APEX On Demand process RR_RUN_ANALYSIS.
-- x01 = customer; x02 = release. Success returns the full report directly.
declare
    l_run number;
    l_json clob;
    l_chunk varchar2(32767);
    l_offset pls_integer := 1;
begin
    begin
        l_run := rr_demo_api.run_analysis(apex_application.g_x01, apex_application.g_x02);
        l_json := rr_demo_api.report(l_run);
    exception when others then
        if sqlcode = -20050 then
            l_json := '{"mode":"FIXTURE","error":"Only Northwind Telecom / DEMO is available."}';
        else
            l_json := '{"mode":"FIXTURE","error":"Fixture analysis unavailable. Check demo installation and run history."}';
        end if;
    end;
    owa_util.mime_header('application/json; charset=utf-8', false);
    owa_util.http_header_close;
    while l_offset <= dbms_lob.getlength(l_json) loop
        l_chunk := dbms_lob.substr(l_json, 8000, l_offset);
        htp.prn(l_chunk);
        l_offset := l_offset + length(l_chunk);
    end loop;
end;
