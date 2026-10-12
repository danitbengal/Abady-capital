import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

// Supabase-managed auth/storage contracts are stubbed; application SQL is executed unchanged.
const db = new PGlite()
const id = number => `00000000-0000-0000-0000-${String(number).padStart(12, '0')}`
let checks = 0
async function asUser(user, sql) {
  await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub', '${id(user)}', false);`)
  try { return await db.query(sql) } finally { await db.exec('reset role') }
}
async function denied(user, sql) {
  await assert.rejects(() => asUser(user, sql))
  checks++
}
try {
  await db.exec(`
    create role authenticated;
    create schema auth; create schema storage;
    create table auth.users(id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
    create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(text) returns text[] language sql as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    grant usage on schema auth, storage to authenticated;
    grant select, insert, update, delete on storage.objects to authenticated;
  `)
  await db.exec(readFileSync(new URL('../supabase/migrations/20261011193000_secure_core.sql', import.meta.url), 'utf8'))
  await db.exec(`
    insert into auth.users(id) values ${[1,2,3,4].map(n=>`('${id(n)}')`).join(',')};
    insert into public.offices(id,name) values ('${id(10)}','משרד א'),('${id(11)}','משרד ב');
    insert into public.office_members(office_id,user_id,role) values
      ('${id(10)}','${id(1)}','administrator'),('${id(10)}','${id(2)}','office_staff'),
      ('${id(10)}','${id(3)}','bookkeeper'),('${id(11)}','${id(4)}','administrator');
    insert into public.clients(id,office_id,display_name,assigned_to,created_by) values
      ('${id(20)}','${id(10)}','לקוח ראשון','${id(2)}','${id(1)}'),
      ('${id(21)}','${id(10)}','לקוח שני','${id(1)}','${id(1)}'),
      ('${id(22)}','${id(11)}','לקוח משרד אחר','${id(4)}','${id(4)}');
    insert into public.capital_cases(id,client_id,declaration_date,created_by) values ('${id(30)}','${id(20)}','2025-12-31','${id(1)}');
  `)
  assert.equal((await asUser(1, 'select * from public.clients')).rows.length, 2); checks++
  assert.equal((await asUser(2, 'select * from public.clients')).rows.length, 1); checks++
  assert.equal((await asUser(3, 'select * from public.clients')).rows.length, 0); checks++
  assert.equal((await asUser(4, `select * from public.capital_cases where id='${id(30)}'`)).rows.length, 0); checks++
  await denied(2, `update public.clients set office_id='${id(11)}' where id='${id(20)}'`)
  await denied(2, `update public.clients set assigned_to='${id(3)}' where id='${id(20)}'`)
  await denied(2, `insert into public.client_access(client_id,user_id) values ('${id(21)}','${id(2)}')`)
  await asUser(1, `insert into public.client_access(client_id,user_id) values ('${id(20)}','${id(3)}')`)
  assert.equal((await asUser(3, 'select * from public.clients')).rows.length, 1); checks++
  const path = `${id(10)}/${id(30)}/evidence.pdf`
  await asUser(2, `insert into storage.objects(bucket_id,name) values ('capital-documents','${path}')`)
  assert.equal((await asUser(4, 'select * from storage.objects')).rows.length, 0); checks++
  await denied(4, `insert into storage.objects(bucket_id,name) values ('capital-documents','${path}-foreign')`)
  await denied(2, `insert into storage.objects(bucket_id,name) values ('capital-documents','${id(11)}/${id(30)}/wrong-office.pdf')`)
  await asUser(2, `insert into public.documents(id,case_id,storage_path,original_name,mime_type,byte_size,source) values ('${id(40)}','${id(30)}','${path}','evidence.pdf','application/pdf',100,'office')`)
  await denied(3, `update public.documents set status='approved' where id='${id(40)}'`)
  await asUser(2, `update public.documents set status='approved',proposed_amount=100 where id='${id(40)}'`)
  const approved=(await asUser(2, `select * from public.documents where id='${id(40)}'`)).rows[0]
  assert.equal(approved.approved_by,id(2)); assert.ok(approved.approved_at); checks++
  await asUser(2, `update public.documents set proposed_amount=200 where id='${id(40)}'`)
  const changed=(await asUser(2, `select * from public.documents where id='${id(40)}'`)).rows[0]
  assert.equal(changed.status,'proposed'); assert.equal(changed.approved_at,null); checks++
  await denied(2, `update public.audit_events set action='tampered'`)
  await denied(2, `delete from public.audit_events`)
  assert.ok((await asUser(1,'select * from public.audit_events')).rows.length>=3); checks++
  await asUser(2, `update public.capital_cases set filing_due_date='2027-01-01' where id='${id(30)}'`)
  assert.equal((await asUser(2,'select * from public.documents')).rows.length,1); checks++
  console.log(`Database migration executed; ${checks} authorization, storage, approval, audit and date-preservation checks passed.`)
} finally { await db.close() }
