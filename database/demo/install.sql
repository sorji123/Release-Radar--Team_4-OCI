-- SQLcl only. Baseline tables/views must already exist in this schema.
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback
set define off
set serveroutput on
@@seed.sql
@@package.sql
prompt Demo backend installed. Run @database/demo/smoke.sql separately.
