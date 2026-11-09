-- Foundational draft. Apply only to a disposable local Supabase database first.
-- No browser-accessible RPC can grant access, credits, or job completion.
create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 name text not null check (length(name) between 1 and 200),
 created_at timestamptz not null default now()
);
create table public.organization_members (
 organization_id uuid not null references public.organizations(id),
 user_id uuid not null references auth.users(id),
 role text not null check (role in ('owner','member')),
 created_at timestamptz not null default now(),
 primary key (organization_id,user_id)
);
create index organization_members_user_idx on public.organization_members(user_id,organization_id);

-- Definer avoids RLS recursion; fixed schema and no dynamic SQL.
-- Owner is the trusted migration role; never assign ownership to an API role.
create function private.is_member(target uuid) returns boolean
 language sql stable security definer set search_path = '' as $$
 select exists (select 1 from public.organization_members m
  where m.organization_id=target and m.user_id=(select auth.uid()));
$$;
revoke all on function private.is_member(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;

create table public.tenders (
 id uuid primary key default gen_random_uuid(),
 reference text not null unique check (reference ~ '^N006/[0-9]{2}/V[0-9]{8}$'),
 title text not null,
 public_metadata jsonb not null default '{}',
 synthetic boolean not null default false,
 created_at timestamptz not null default now()
);
create table public.tender_documents (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 tender_id uuid not null references public.tenders(id),
 filename text not null,
 storage_path text not null,
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 unique(organization_id,storage_path),
 check (split_part(storage_path,'/',1)=organization_id::text)
);
create table public.document_versions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 document_id uuid not null,
 sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
 version integer not null check (version>0),
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 unique(organization_id,document_id,version),
 foreign key(organization_id,document_id) references public.tender_documents(organization_id,id)
);
create table public.document_extractions (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 version_id uuid not null,
 extractor_version text not null,
 content text not null,
 locators jsonb not null default '[]',
 warnings jsonb not null default '[]',
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 foreign key(organization_id,version_id) references public.document_versions(organization_id,id)
);
create table public.audits (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 tender_id uuid not null references public.tenders(id),
 status text not null default 'created' check (status in ('created','awaiting_entitlement','queued','fetching_metadata','downloading_documents','extracting_documents','running_rules','running_ai','verifying','generating_package','completed','review_required','failed','cancelled')),
 document_set_hash text check (document_set_hash ~ '^[a-f0-9]{64}$'),
 rule_version text, provider text, model text, prompt_version text,
 schema_version text not null default '1',
 verification_summary jsonb,
 estimated_cost_minor bigint check (estimated_cost_minor>=0),
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 unique(organization_id,id)
);
-- Freeze exact input version membership, rather than mutable document references.
create table public.audit_document_versions (
 organization_id uuid not null,
 audit_id uuid not null,
 version_id uuid not null,
 primary key(organization_id,audit_id,version_id),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id),
 foreign key(organization_id,version_id) references public.document_versions(organization_id,id)
);
create table public.findings (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 audit_id uuid not null,
 title text not null,
 category text not null check(category in ('financial','legal','technical','chronological','qualification','conflict')),
 severity text not null check(severity in ('critical','high','medium','low')),
 kind text not null check(kind in ('source_fact','calculation','assessment')),
 explanation text not null,
 action text not null,
 unique(organization_id,id),
 unique(organization_id,audit_id,id),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id)
);
create table public.finding_evidence (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 audit_id uuid not null,
 finding_id uuid not null,
 version_id uuid not null,
 locator jsonb not null,
 quoted_span text not null check(length(quoted_span)>0),
 verification_status text not null default 'unverified' check(verification_status in ('unverified','source_verified','unsupported')),
 verification_method text,
 foreign key(organization_id,audit_id,finding_id) references public.findings(organization_id,audit_id,id),
 foreign key(organization_id,audit_id,version_id) references public.audit_document_versions(organization_id,audit_id,version_id)
);
create table public.audit_jobs (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 audit_id uuid not null,
 idempotency_key text not null,
 state text not null default 'queued' check(state in ('queued','running','completed','failed','cancelled')),
 attempt integer not null default 0 check(attempt>=0),
 max_attempts integer not null default 3 check(max_attempts between 1 and 10),
 lease_owner text, lease_expires_at timestamptz,
 run_after timestamptz not null default now(),
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 unique(organization_id,idempotency_key),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id)
);
create index audit_jobs_claim_idx on public.audit_jobs(state,run_after,lease_expires_at);
create table public.audit_job_events (
 id bigint generated always as identity primary key,
 organization_id uuid not null,
 job_id uuid not null,
 state text not null,
 safe_metadata jsonb not null default '{}',
 created_at timestamptz not null default now(),
 foreign key(organization_id,job_id) references public.audit_jobs(organization_id,id)
);
create table public.payments (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 stripe_checkout_id text unique,
 stripe_payment_intent_id text unique,
 status text not null check(status in ('pending','paid','failed','refunded','disputed')),
 amount_minor bigint not null check(amount_minor>=0),
 currency text not null default 'czk' check(currency='czk'),
 created_at timestamptz not null default now(),
 unique(organization_id,id)
);
-- Raw provider events are server-only; sensitive payloads should be minimized.
create table public.stripe_events (
 id text primary key,
 type text not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 status text not null default 'received' check(status in ('received','processed','failed','ignored')),
 payload_digest text not null check(payload_digest ~ '^[a-f0-9]{64}$')
);
create table public.entitlements (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 audit_id uuid not null,
 payment_id uuid not null,
 granted_at timestamptz not null default now(),
 expires_at timestamptz,
 revoked_at timestamptz,
 unique(organization_id,audit_id),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id),
 foreign key(organization_id,payment_id) references public.payments(organization_id,id)
);
-- Ledger records represent signed credit units, never money.
-- reserve/release move available credits; consume finalizes a reservation with delta 0.
create table public.credit_ledger (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 audit_id uuid,
 payment_id uuid,
 operation text not null check(operation in ('grant','reserve','consume','release','refund','expire','adjustment')),
 delta bigint not null,
 idempotency_key text not null,
 created_at timestamptz not null default now(),
 unique(organization_id,id),
 unique(organization_id,idempotency_key),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id),
 foreign key(organization_id,payment_id) references public.payments(organization_id,id),
 check ((operation in ('grant','release','refund') and delta>0) or (operation in ('reserve','expire') and delta<0) or (operation='consume' and delta=0) or (operation='adjustment' and delta<>0))
);
create table public.credit_reservations (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 audit_id uuid not null,
 ledger_id uuid not null,
 units bigint not null check(units>0),
 state text not null default 'reserved' check(state in ('reserved','consumed','released')),
 created_at timestamptz not null default now(),
 unique(organization_id,audit_id),
 foreign key(organization_id,audit_id) references public.audits(organization_id,id),
 foreign key(organization_id,ledger_id) references public.credit_ledger(organization_id,id)
);

create function private.reject_ledger_mutation() returns trigger
 language plpgsql set search_path='' as $$
 begin raise exception 'Credit ledger is append-only' using errcode='55000'; end;
$$;
revoke all on function private.reject_ledger_mutation() from public,anon,authenticated;
create trigger ledger_immutable before update or delete on public.credit_ledger
 for each row execute function private.reject_ledger_mutation();

-- Explicit allowlist: public schema contains no anonymously readable data.
-- Financial/job writes remain server-only even for organization owners.
alter table public.organizations enable row level security;
revoke all on public.organizations from anon, authenticated;
grant all on public.organizations to service_role;
alter table public.organization_members enable row level security;
revoke all on public.organization_members from anon, authenticated;
grant all on public.organization_members to service_role;
alter table public.tenders enable row level security;
revoke all on public.tenders from anon, authenticated;
grant all on public.tenders to service_role;
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from anon, authenticated;
grant all on public.stripe_events to service_role;
alter table public.tender_documents enable row level security;
revoke all on public.tender_documents from anon, authenticated;
grant all on public.tender_documents to service_role;
alter table public.document_versions enable row level security;
revoke all on public.document_versions from anon, authenticated;
grant all on public.document_versions to service_role;
alter table public.document_extractions enable row level security;
revoke all on public.document_extractions from anon, authenticated;
grant all on public.document_extractions to service_role;
alter table public.audits enable row level security;
revoke all on public.audits from anon, authenticated;
grant all on public.audits to service_role;
alter table public.audit_document_versions enable row level security;
revoke all on public.audit_document_versions from anon, authenticated;
grant all on public.audit_document_versions to service_role;
alter table public.findings enable row level security;
revoke all on public.findings from anon, authenticated;
grant all on public.findings to service_role;
alter table public.finding_evidence enable row level security;
revoke all on public.finding_evidence from anon, authenticated;
grant all on public.finding_evidence to service_role;
alter table public.audit_jobs enable row level security;
revoke all on public.audit_jobs from anon, authenticated;
grant all on public.audit_jobs to service_role;
alter table public.audit_job_events enable row level security;
revoke all on public.audit_job_events from anon, authenticated;
grant all on public.audit_job_events to service_role;
alter table public.payments enable row level security;
revoke all on public.payments from anon, authenticated;
grant all on public.payments to service_role;
alter table public.entitlements enable row level security;
revoke all on public.entitlements from anon, authenticated;
grant all on public.entitlements to service_role;
alter table public.credit_ledger enable row level security;
revoke all on public.credit_ledger from anon, authenticated;
grant all on public.credit_ledger to service_role;
alter table public.credit_reservations enable row level security;
revoke all on public.credit_reservations from anon, authenticated;
grant all on public.credit_reservations to service_role;
grant select on public.tender_documents to authenticated;
create policy tenant_read on public.tender_documents for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.document_versions to authenticated;
create policy tenant_read on public.document_versions for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.document_extractions to authenticated;
create policy tenant_read on public.document_extractions for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.audits to authenticated;
create policy tenant_read on public.audits for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.audit_document_versions to authenticated;
create policy tenant_read on public.audit_document_versions for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.findings to authenticated;
create policy tenant_read on public.findings for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.finding_evidence to authenticated;
create policy tenant_read on public.finding_evidence for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.audit_jobs to authenticated;
create policy tenant_read on public.audit_jobs for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.audit_job_events to authenticated;
create policy tenant_read on public.audit_job_events for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.payments to authenticated;
create policy tenant_read on public.payments for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.entitlements to authenticated;
create policy tenant_read on public.entitlements for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.credit_ledger to authenticated;
create policy tenant_read on public.credit_ledger for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.credit_reservations to authenticated;
create policy tenant_read on public.credit_reservations for select to authenticated using ((select private.is_member(organization_id)));
grant select on public.organizations,public.organization_members,public.tenders to authenticated;
create policy member_org_read on public.organizations for select to authenticated using ((select private.is_member(id)));
create policy member_members_read on public.organization_members for select to authenticated using ((select private.is_member(organization_id)));
create policy authenticated_public_metadata on public.tenders for select to authenticated using (true);
grant usage,select on sequence public.audit_job_events_id_seq to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('tender-documents','tender-documents',false,26214400,array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/plain','text/markdown'])
on conflict(id) do nothing;

-- Prefix is compared as text (no unsafe UUID casts on attacker-controlled paths).
create policy tender_object_read on storage.objects for select to authenticated
 using (bucket_id='tender-documents' and exists (
  select 1 from public.organization_members m where m.user_id=(select auth.uid())
   and m.organization_id::text=(storage.foldername(name))[1]));
create policy tender_object_insert on storage.objects for insert to authenticated
 with check (bucket_id='tender-documents' and exists (
  select 1 from public.organization_members m where m.user_id=(select auth.uid())
   and m.organization_id::text=(storage.foldername(name))[1]));
-- Deliberately no client UPDATE/DELETE: immutable version keys; server owns retention.
