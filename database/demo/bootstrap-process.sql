-- Paste this block (no trailing slash) into APEX On Demand process RR_BOOTSTRAP.
declare
    l_json clob;
    l_chunk varchar2(32767);
    l_offset pls_integer := 1;
begin
    begin
        l_json := rr_demo_api.bootstrap();
    exception when others then
        l_json := '{"mode":"FIXTURE","error":"Fixture data unavailable. Check demo installation."}';
    end;
    owa_util.mime_header('application/json; charset=utf-8', false);
    owa_util.http_header_close;
    while l_offset <= dbms_lob.getlength(l_json) loop
        l_chunk := dbms_lob.substr(l_json, 8000, l_offset);
        htp.prn(l_chunk);
        l_offset := l_offset + length(l_chunk);
    end loop;
end;
