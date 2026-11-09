begin;
create extension if not exists pgtap with schema extensions;
set search_path = public, extensions;
select plan(23);

insert into auth.users(id,email) values
 ('10000000-0000-0000-0000-000000000001','tenant-a@example.invalid'),
 ('10000000-0000-0000-0000-000000000002','tenant-b@example.invalid');
insert into public.organizations(id,name) values
 ('20000000-0000-0000-0000-000000000001','Synthetic organization A'),
 ('20000000-0000-0000-0000-000000000002','Synthetic organization B');
insert into public.organization_members(organization_id,user_id,role) values
 ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','owner'),
 ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002','owner');
insert into public.tenders(id,reference,title,synthetic) values
 ('30000000-0000-0000-0000-000000000001','N006/26/V99999999','Synthetic SQL test tender',true);
insert into public.audits(id,organization_id,tender_id) values
 ('40000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001'),
 ('40000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001');
insert into public.tender_documents(id,organization_id,tender_id,filename,storage_path) values
 ('50000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','a.txt','20000000-0000-0000-0000-000000000001/a.txt'),
 ('50000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000001','b.txt','20000000-0000-0000-0000-000000000002/b.txt');
insert into public.document_versions(id,organization_id,document_id,sha256,version) values
 ('60000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','50000000-0000-0000-0000-000000000001',repeat('a',64),1),
 ('60000000-0000-0000-0000-000000000002','20000000-0000-0000-0000-000000000002','50000000-0000-0000-0000-000000000002',repeat('b',64),1);
insert into public.audit_document_versions(organization_id,audit_id,version_id) values
 ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000001');
insert into public.findings(id,organization_id,audit_id,title,category,severity,kind,explanation,action) values
 ('70000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','Synthetic finding','financial','high','assessment','Synthetic only','Review');
insert into public.credit_ledger(id,organization_id,operation,delta,idempotency_key) values
 ('80000000-0000-0000-0000-000000000001','20000000-0000-0000-0000-000000000001','grant',1,'sql-test-grant');
insert into storage.objects(bucket_id,name) values
 ('tender-documents','20000000-0000-0000-0000-000000000001/test-a.txt'),
 ('tender-documents','20000000-0000-0000-0000-000000000002/test-b.txt');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
select is((select count(*)::integer from public.organizations),1,'A sees only its organization');
select is((select count(*)::integer from public.organization_members),1,'A sees only its organization membership');
select is((select count(*)::integer from public.audits),1,'A sees only its audit');
select is((select count(*)::integer from public.tender_documents),1,'A sees only its documents');
select is((select count(*)::integer from public.document_versions),1,'A sees only its versions');
select is((select count(*)::integer from public.audits where organization_id='20000000-0000-0000-0000-000000000002'),0,'Direct tenant B query is empty');
select is((select count(*)::integer from storage.objects where bucket_id='tender-documents'),1,'A cannot read B storage objects');
select throws_ok($$insert into public.entitlements(organization_id,audit_id,payment_id) values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001',gen_random_uuid())$$,'42501',null,'Browser cannot grant entitlements');
select throws_ok($$insert into public.credit_ledger(organization_id,operation,delta,idempotency_key) values ('20000000-0000-0000-0000-000000000001','grant',100,'attacker')$$,'42501',null,'Browser cannot grant credits');
select throws_ok($$update public.audits set status='completed'$$,'42501',null,'Browser cannot complete audits');
select throws_ok($$insert into public.organization_members(organization_id,user_id,role) values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','owner')$$,'42501',null,'Browser cannot join another organization');
select throws_ok($$select * from public.stripe_events$$,'42501',null,'Raw provider event table is server-only');
select throws_ok($$insert into storage.objects(bucket_id,name) values ('tender-documents','20000000-0000-0000-0000-000000000002/spoof.txt')$$,'42501',null,'Cross-tenant upload is rejected');
select lives_ok($$insert into storage.objects(bucket_id,name) values ('tender-documents','20000000-0000-0000-0000-000000000001/own.txt')$$,'Own tenant upload is allowed');
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',true);
select is((select count(*)::integer from public.findings),0,'B cannot see A findings');
select is((select count(*)::integer from public.credit_ledger),0,'B cannot see A credits');
select is((select count(*)::integer from public.audits where organization_id='20000000-0000-0000-0000-000000000001'),0,'B cannot see A audit');
reset role;
select throws_ok($$insert into public.audit_document_versions(organization_id,audit_id,version_id) values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002')$$,'23503',null,'Composite FK rejects foreign tenant version even for trusted writer');
select throws_ok($$insert into public.finding_evidence(organization_id,audit_id,finding_id,version_id,locator,quoted_span) values ('20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','70000000-0000-0000-0000-000000000001','60000000-0000-0000-0000-000000000002','{}','spoof')$$,'23503',null,'Finding evidence cannot reference a foreign tenant version');
select throws_ok($$update public.credit_ledger set delta=100 where id='80000000-0000-0000-0000-000000000001'$$,'55000','Credit ledger is append-only','Ledger cannot be mutated');
select throws_ok($$insert into public.credit_ledger(organization_id,operation,delta,idempotency_key) values ('20000000-0000-0000-0000-000000000001','grant',1,'sql-test-grant')$$,'23505',null,'Idempotency keys prevent duplicate ledger records');
select is((select public from storage.buckets where id='tender-documents'),false,'Document bucket is private');
set local role anon;
select throws_ok($$select * from public.audits$$,'42501',null,'Anonymous role cannot query audits');
reset role;
select * from finish();
rollback;
