-- Initial migration for a fresh application schema; deliberately not idempotent.
-- Oracle DDL commits implicitly. Never use this as an upgrade/reset script.
whenever oserror exit failure rollback
whenever sqlerror exit failure rollback
set define off

declare
    l_existing number;
begin
    select count(*) into l_existing
    from user_objects
    where object_name in ('RELEASE_FEATURES', 'CONFIG_OBJECTS',
                          'ANALYSIS_RUNS', 'IMPACT_FINDINGS');
    if l_existing > 0 then
        raise_application_error(-20001,
            'Baseline objects already exist; use a fresh schema or a reviewed upgrade.');
    end if;
end;
/

create table release_features (
    feature_id   number generated always as identity,
    feature_key  varchar2(100 char) not null,
    release_code varchar2(10 char) not null,
    module       varchar2(50 char) not null,
    title        varchar2(400 char) not null,
    description  clob not null,
    opt_in       char(1 char) not null,
    source_url   varchar2(2000 char),
    source_kind  varchar2(10 char) not null,
    embedding    vector(1024, float32),
    created_at   timestamp with time zone default systimestamp not null,
    constraint rr_feature_pk primary key (feature_id),
    constraint rr_feature_key_uq unique (release_code, feature_key),
    constraint rr_feature_opt_ck check (opt_in in ('Y', 'N')),
    constraint rr_feature_source_ck check (source_kind in ('SYNTHETIC', 'ORACLE')),
    constraint rr_feature_url_ck check (source_kind <> 'ORACLE' or source_url is not null)
);

create table config_objects (
    object_id   number generated always as identity,
    object_key  varchar2(100 char) not null,
    customer    varchar2(100 char) not null,
    object_type varchar2(50 char) not null,
    name        varchar2(200 char) not null,
    module      varchar2(50 char) not null,
    description clob not null,
    snippet     clob,
    embedding   vector(1024, float32),
    created_at  timestamp with time zone default systimestamp not null,
    constraint rr_object_pk primary key (object_id),
    constraint rr_object_key_uq unique (customer, object_key),
    constraint rr_object_type_ck check (object_type in
        ('GROOVY', 'APP_COMPOSER', 'PAGE_COMPOSER', 'WORKFLOW', 'OIC', 'REPORT'))
);

create table analysis_runs (
    run_id              number generated always as identity,
    customer            varchar2(100 char) not null,
    release_code        varchar2(10 char) not null,
    status              varchar2(10 char) default 'RUNNING' not null,
    mode                varchar2(7 char) not null,
    objects_checked     number default 0 not null,
    features_considered number default 0 not null,
    candidates_selected number default 0 not null,
    started_at          timestamp with time zone default systimestamp not null,
    completed_at        timestamp with time zone,
    error_message       varchar2(4000 char),
    embedding_model     varchar2(255 char),
    chat_model          varchar2(255 char),
    prompt_version      varchar2(100 char),
    distance_threshold  number default 0.60 not null,
    top_k               number default 3 not null,
    constraint rr_run_pk primary key (run_id),
    constraint rr_run_status_ck check (status in ('RUNNING', 'COMPLETED', 'FAILED')),
    constraint rr_run_mode_ck check (mode in ('FIXTURE', 'OCI')),
    constraint rr_run_counts_ck check (
        objects_checked >= 0 and objects_checked = trunc(objects_checked)
        and features_considered >= 0 and features_considered = trunc(features_considered)
        and candidates_selected >= 0 and candidates_selected = trunc(candidates_selected)),
    constraint rr_run_threshold_ck check (distance_threshold > 0 and distance_threshold <= 2),
    constraint rr_run_top_k_ck check (top_k >= 1 and top_k = trunc(top_k)),
    constraint rr_run_time_ck check (completed_at >= started_at),
    constraint rr_run_lifecycle_ck check (
        (status = 'RUNNING' and completed_at is null and error_message is null)
        or (status = 'COMPLETED' and completed_at is not null and error_message is null)
        or (status = 'FAILED' and completed_at is not null and error_message is not null))
);

create table impact_findings (
    finding_id number generated always as identity,
    run_id     number not null,
    object_id  number not null,
    feature_id number not null,
    distance   number not null,
    severity   varchar2(20 char) not null,
    confidence number not null,
    rationale  clob not null,
    cited_text clob,
    test_case  clob,
    created_at timestamp with time zone default systimestamp not null,
    constraint rr_finding_pk primary key (finding_id),
    constraint rr_finding_pair_uq unique (run_id, object_id, feature_id),
    constraint rr_finding_run_fk foreign key (run_id) references analysis_runs (run_id),
    constraint rr_finding_object_fk foreign key (object_id) references config_objects (object_id),
    constraint rr_finding_feature_fk foreign key (feature_id) references release_features (feature_id),
    constraint rr_finding_severity_ck check (severity in ('BREAKING', 'TEST', 'OPPORTUNITY', 'NONE')),
    constraint rr_finding_confidence_ck check (confidence between 0 and 100),
    constraint rr_finding_distance_ck check (distance between 0 and 2),
    constraint rr_finding_test_json_ck check (test_case is json strict with unique keys)
);

create index rr_feature_scope_ix on release_features (release_code, module);
create index rr_object_scope_ix on config_objects (customer, module);
create index rr_run_scope_ix on analysis_runs (customer, release_code, started_at);
-- The unique pair index already starts with run_id; cover the other foreign keys.
create index rr_finding_object_ix on impact_findings (object_id);
create index rr_finding_feature_ix on impact_findings (feature_id);

comment on column impact_findings.distance is 'Cosine distance, lower is closer; not similarity or confidence.';
comment on column impact_findings.test_case is 'JSON object expected by the writer: title, steps array, expected. Shape and evidence require application validation.';
comment on column impact_findings.cited_text is 'Writer must require a nonempty verbatim citation for non-NONE findings.';
comment on column analysis_runs.completed_at is 'Terminal timestamp for either COMPLETED or FAILED.';
comment on column config_objects.object_key is 'Stable external key within customer. Offline expected labels must not be loaded here.';

prompt Baseline tables created. Run 002_views.sql and verify.sql next.
