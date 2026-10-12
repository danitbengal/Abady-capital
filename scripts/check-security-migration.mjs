import { readFileSync } from 'node:fs'

const sql = readFileSync(new URL('../supabase/migrations/20261011193000_secure_core.sql', import.meta.url), 'utf8')
const tables = ['offices', 'profiles', 'office_members', 'clients', 'client_access', 'capital_cases', 'documents', 'work_sessions', 'audit_events']

for (const table of tables) {
  if (!sql.includes(`alter table public.${table} enable row level security;`)) {
    throw new Error(`RLS is missing for public.${table}`)
  }
}

if (!sql.includes("values ('capital-documents', 'capital-documents', false")) throw new Error('Document bucket must be private')
if (!sql.includes('file_size_limit') || !sql.includes('20971520')) throw new Error('Document bucket must enforce the 20MB limit')
if (/service_role/i.test(sql)) throw new Error('A service-role credential reference must not appear in browser-facing migration logic')
if (/create policy\s+\S+\s+on public\.audit_events\s+for (update|delete)/i.test(sql)) throw new Error('Audit events must not have update or delete policies')
if (!sql.includes("comment on column public.documents.internal_note is 'Office workpaper only.")) throw new Error('Internal-note export restriction is missing')
if (!sql.includes("member.role = 'administrator'")) throw new Error('Administrator portfolio access is missing')
if (!sql.includes("member.role in ('accountant', 'office_staff', 'auditor')")) throw new Error('Assigned-client access rule is missing')

console.log(`Security migration checks passed (${tables.length} RLS tables, private storage, append-only audit).`)
