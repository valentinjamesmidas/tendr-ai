-- Synthetic public metadata only. No production tenant, user, payment or entitlement.
insert into public.tenders(id,reference,title,public_metadata,synthetic) values
 ('60000000-0000-0000-0000-000000000001','N006/26/V00018665','DEMO — rekonstrukce školní budovy','{"notice":"Synthetic fixture, not a verified real tender"}',true),
 ('60000000-0000-0000-0000-000000000002','N006/26/V00028666','DEMO — dodávka informačního systému','{"notice":"Synthetic fixture, not a verified real tender"}',true)
on conflict(reference) do nothing;
