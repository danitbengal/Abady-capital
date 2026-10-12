-- Abady Capital: secure production foundation.
-- Apply only to the separate capital-declaration Supabase project, never to the CRM project.

-- gen_random_uuid() is built into supported PostgreSQL versions.

create type public.office_role as enum ('administrator', 'accountant', 'office_staff', 'bookkeeper', 'auditor');
create type public.case_status as enum ('draft', 'collecting', 'reviewing', 'office_review', 'signature', 'completed', 'archived');
create type public.document_status as enum ('uploaded', 'processing', 'proposed', 'approved', 'rejected');
create type public.document_source as enum ('office', 'client_portal', 'email', 'whatsapp', 'tax_authority');

create table public.offices (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 160),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.office_members (
  office_id uuid not null references public.offices(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.office_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (office_id, user_id)
);

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  office_id uuid not null references public.offices(id) on delete cascade,
  display_name text not null check (char_length(trim(display_name)) between 2 and 200),
  tax_identifier text not null default '',
  email text,
  phone text,
  assigned_to uuid references auth.users(id) on delete set null,
  archived_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.client_access (
  client_id uuid not null references public.clients(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  granted_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

create table public.capital_cases (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  previous_declaration_date date,
  declaration_date date not null,
  filing_due_date date,
  status public.case_status not null default 'draft',
  form_version text not null default '1219-2024-12',
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (previous_declaration_date is null or previous_declaration_date < declaration_date)
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.capital_cases(id) on delete cascade,
  storage_path text not null unique,
  original_name text not null,
  mime_type text not null,
  byte_size bigint not null check (byte_size between 1 and 20971520),
  source public.document_source not null,
  status public.document_status not null default 'uploaded',
  proposed_destination_kind text check (proposed_destination_kind in ('form_1219', 'comparison_source', 'comparison_use')),
  proposed_destination_ref text,
  proposed_amount numeric(16,2) check (proposed_amount is null or proposed_amount >= 0),
  confidence numeric(5,4) check (confidence is null or confidence between 0 and 1),
  internal_note text not null default '',
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((approved_at is null and approved_by is null) or (approved_at is not null and approved_by is not null)),
  check ((proposed_destination_kind is null) = (proposed_destination_ref is null))
);

create table public.work_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.capital_cases(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  seconds_worked integer check (seconds_worked is null or seconds_worked >= 0),
  note text not null default '',
  check (ended_at is null or ended_at >= started_at)
);

create table public.audit_events (
  id bigint generated always as identity primary key,
  office_id uuid not null references public.offices(id) on delete restrict,
  case_id uuid references public.capital_cases(id) on delete restrict,
  actor_id uuid not null default auth.uid() references auth.users(id) on delete restrict,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);

create index clients_office_idx on public.clients(office_id) where archived_at is null;
create index clients_assigned_idx on public.clients(assigned_to) where archived_at is null;
create unique index clients_tax_identifier_unique on public.clients(office_id, tax_identifier) where tax_identifier <> '';
create index cases_client_idx on public.capital_cases(client_id, declaration_date desc);
create index documents_case_idx on public.documents(case_id, created_at desc);
create index work_sessions_case_idx on public.work_sessions(case_id, started_at desc);
create index audit_events_case_idx on public.audit_events(case_id, occurred_at desc);
create index audit_events_office_idx on public.audit_events(office_id, occurred_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger offices_set_updated_at before update on public.offices for each row execute function public.set_updated_at();
create trigger profiles_set_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger clients_set_updated_at before update on public.clients for each row execute function public.set_updated_at();
create trigger cases_set_updated_at before update on public.capital_cases for each row execute function public.set_updated_at();
create trigger documents_set_updated_at before update on public.documents for each row execute function public.set_updated_at();

create or replace function public.enforce_document_approval()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.status = 'approved' or new.approved_by is not null or new.approved_at is not null then
      raise exception 'New documents must await review';
    end if;
    return new;
  end if;
  if old.status = 'approved' and (
    new.proposed_destination_kind is distinct from old.proposed_destination_kind
    or new.proposed_destination_ref is distinct from old.proposed_destination_ref
    or new.proposed_amount is distinct from old.proposed_amount
  ) then
    new.status := 'proposed';
    new.approved_by := null;
    new.approved_at := null;
  elsif new.status = 'approved' and old.status <> 'approved' then
    new.approved_by := auth.uid();
    new.approved_at := now();
  elsif new.status <> 'approved' then
    new.approved_by := null;
    new.approved_at := null;
  else
    new.approved_by := old.approved_by;
    new.approved_at := old.approved_at;
  end if;
  return new;
end;
$$;

create trigger documents_enforce_approval before insert or update on public.documents for each row execute function public.enforce_document_approval();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

create or replace function public.is_office_member(target_office uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members member
    where member.office_id = target_office and member.user_id = auth.uid() and member.active
  );
$$;

create or replace function public.has_office_role(target_office uuid, allowed_roles public.office_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.office_members member
    where member.office_id = target_office and member.user_id = auth.uid()
      and member.active and member.role = any(allowed_roles)
  );
$$;

create or replace function public.has_client_access(target_client uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.clients client
    join public.office_members member on member.office_id = client.office_id
    where client.id = target_client and member.user_id = auth.uid() and member.active
      and (
        member.role = 'administrator'
        or exists (select 1 from public.client_access grant_row where grant_row.client_id = client.id and grant_row.user_id = auth.uid())
        or (member.role in ('accountant', 'office_staff', 'auditor') and client.assigned_to = auth.uid())
      )
  );
$$;

create or replace function public.has_case_access(target_case uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.capital_cases capital_case
    where capital_case.id = target_case and public.has_client_access(capital_case.client_id)
  );
$$;

create or replace function public.has_client_role(target_client uuid, allowed_roles public.office_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select public.has_client_access(target_client) and exists (
    select 1 from public.clients client
    join public.office_members member on member.office_id = client.office_id
    where client.id = target_client and member.user_id = auth.uid()
      and member.active and member.role = any(allowed_roles)
  );
$$;

create or replace function public.has_case_role(target_case uuid, allowed_roles public.office_role[])
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.capital_cases capital_case
    where capital_case.id = target_case
      and public.has_client_role(capital_case.client_id, allowed_roles)
  );
$$;

create or replace function public.bootstrap_office(office_name text, member_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  new_office uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  perform 1 from auth.users where id = auth.uid() for update;
  if exists (select 1 from public.office_members where user_id = auth.uid()) then
    raise exception 'User already belongs to an office';
  end if;
  insert into public.offices(name) values (trim(office_name)) returning id into new_office;
  insert into public.profiles(id, full_name) values (auth.uid(), trim(member_name))
    on conflict (id) do update set full_name = excluded.full_name;
  insert into public.office_members(office_id, user_id, role) values (new_office, auth.uid(), 'administrator');
  insert into public.audit_events(office_id, action, entity_type, entity_id)
    values (new_office, 'office.bootstrap', 'office', new_office::text);
  return new_office;
end;
$$;

revoke all on function public.bootstrap_office(text, text) from public;
grant execute on function public.bootstrap_office(text, text) to authenticated;

-- RLS protects rows. This trigger also prevents moving a row between tenants,
-- forging ownership, or changing client assignments without administrator rights.
create or replace function public.guard_core_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.id is distinct from old.id then raise exception 'Record identity is immutable'; end if;
  if tg_table_name = 'clients' then
    if new.office_id is distinct from old.office_id or new.created_by is distinct from old.created_by then
      raise exception 'Client office and creator are immutable';
    end if;
    if new.assigned_to is distinct from old.assigned_to and not public.has_office_role(old.office_id, array['administrator']::public.office_role[]) then
      raise exception 'Only administrators may change assignments';
    end if;
  elsif tg_table_name = 'capital_cases' then
    if new.client_id is distinct from old.client_id or new.created_by is distinct from old.created_by then
      raise exception 'Case client and creator are immutable';
    end if;
  elsif tg_table_name = 'documents' then
    if new.case_id is distinct from old.case_id or new.storage_path is distinct from old.storage_path or new.uploaded_by is distinct from old.uploaded_by then
      raise exception 'Document case, path and uploader are immutable';
    end if;
  elsif tg_table_name = 'work_sessions' then
    if new.case_id is distinct from old.case_id or new.user_id is distinct from old.user_id then
      raise exception 'Work-session case and user are immutable';
    end if;
  end if;
  return new;
end;
$$;
create trigger clients_guard_identity before update on public.clients for each row execute function public.guard_core_identity();
create trigger cases_guard_identity before update on public.capital_cases for each row execute function public.guard_core_identity();
create trigger documents_guard_identity before update on public.documents for each row execute function public.guard_core_identity();
create trigger sessions_guard_identity before update on public.work_sessions for each row execute function public.guard_core_identity();

alter table public.offices enable row level security;
alter table public.profiles enable row level security;
alter table public.office_members enable row level security;
alter table public.clients enable row level security;
alter table public.client_access enable row level security;
alter table public.capital_cases enable row level security;
alter table public.documents enable row level security;
alter table public.work_sessions enable row level security;
alter table public.audit_events enable row level security;

create policy offices_select on public.offices for select to authenticated using (public.is_office_member(id));
create policy offices_update on public.offices for update to authenticated using (public.has_office_role(id, array['administrator']::public.office_role[])) with check (public.has_office_role(id, array['administrator']::public.office_role[]));

create policy profiles_self_select on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy members_select on public.office_members for select to authenticated using (public.is_office_member(office_id));
create policy members_insert on public.office_members for insert to authenticated with check (public.has_office_role(office_id, array['administrator']::public.office_role[]));
create policy members_update on public.office_members for update to authenticated using (public.has_office_role(office_id, array['administrator']::public.office_role[])) with check (public.has_office_role(office_id, array['administrator']::public.office_role[]));
create policy members_delete on public.office_members for delete to authenticated using (public.has_office_role(office_id, array['administrator']::public.office_role[]));

create policy clients_select on public.clients for select to authenticated using (public.has_client_access(id));
create policy clients_insert on public.clients for insert to authenticated with check (created_by = auth.uid() and public.has_office_role(office_id, array['administrator','accountant','office_staff']::public.office_role[]) and (public.has_office_role(office_id, array['administrator']::public.office_role[]) or assigned_to = auth.uid()));
create policy clients_update on public.clients for update to authenticated using (public.has_client_role(id, array['administrator','accountant','office_staff']::public.office_role[])) with check (public.has_client_role(id, array['administrator','accountant','office_staff']::public.office_role[]));
create policy clients_delete on public.clients for delete to authenticated using (public.has_office_role(office_id, array['administrator']::public.office_role[]));

create policy client_access_select on public.client_access for select to authenticated using (user_id = auth.uid() or public.has_client_access(client_id));
create policy client_access_insert on public.client_access for insert to authenticated with check (exists (select 1 from public.clients client where client.id = client_id and public.has_office_role(client.office_id, array['administrator']::public.office_role[])));
create policy client_access_delete on public.client_access for delete to authenticated using (exists (select 1 from public.clients client where client.id = client_id and public.has_office_role(client.office_id, array['administrator']::public.office_role[])));

create policy cases_select on public.capital_cases for select to authenticated using (public.has_client_access(client_id));
create policy cases_insert on public.capital_cases for insert to authenticated with check (created_by = auth.uid() and public.has_client_role(client_id, array['administrator','accountant','office_staff']::public.office_role[]));
create policy cases_update on public.capital_cases for update to authenticated using (public.has_client_role(client_id, array['administrator','accountant','office_staff']::public.office_role[])) with check (public.has_client_role(client_id, array['administrator','accountant','office_staff']::public.office_role[]));
create policy cases_delete on public.capital_cases for delete to authenticated using (exists (select 1 from public.clients client where client.id = client_id and public.has_office_role(client.office_id, array['administrator']::public.office_role[])));

create policy documents_select on public.documents for select to authenticated using (public.has_case_access(case_id));
create policy documents_insert on public.documents for insert to authenticated with check (uploaded_by = auth.uid() and split_part(storage_path, '/', 2) = case_id::text and public.has_case_role(case_id, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[]));
create policy documents_update on public.documents for update to authenticated using (public.has_case_role(case_id, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[])) with check (public.has_case_role(case_id, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[]) and (status <> 'approved' or public.has_case_role(case_id, array['administrator','accountant','office_staff']::public.office_role[])));
create policy documents_delete on public.documents for delete to authenticated using (public.has_case_role(case_id, array['administrator','accountant']::public.office_role[]));

create policy work_sessions_select on public.work_sessions for select to authenticated using (public.has_case_access(case_id));
create policy work_sessions_insert on public.work_sessions for insert to authenticated with check (user_id = auth.uid() and public.has_case_access(case_id));
create policy work_sessions_update on public.work_sessions for update to authenticated using (user_id = auth.uid() and public.has_case_access(case_id)) with check (user_id = auth.uid() and public.has_case_access(case_id));

create policy audit_select on public.audit_events for select to authenticated using (public.has_office_role(office_id, array['administrator','accountant','auditor']::public.office_role[]) and (case_id is null or public.has_case_access(case_id)));
create policy audit_insert on public.audit_events for insert to authenticated with check (actor_id = auth.uid() and public.is_office_member(office_id) and (case_id is null or exists (select 1 from public.capital_cases capital_case join public.clients client on client.id = capital_case.client_id where capital_case.id = case_id and client.office_id = audit_events.office_id and public.has_case_access(capital_case.id))));

create or replace function public.audit_document_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  changed_case uuid;
  changed_office uuid;
  changed_document uuid;
  changed_status public.document_status;
  audit_action text;
begin
  changed_case := coalesce(new.case_id, old.case_id);
  changed_document := coalesce(new.id, old.id);
  changed_status := coalesce(new.status, old.status);
  select client.office_id into changed_office
  from public.capital_cases capital_case
  join public.clients client on client.id = capital_case.client_id
  where capital_case.id = changed_case;

  audit_action := case tg_op
    when 'INSERT' then 'document.created'
    when 'DELETE' then 'document.deleted'
    else 'document.updated'
  end;
  insert into public.audit_events(office_id, case_id, actor_id, action, entity_type, entity_id, metadata)
  values (changed_office, changed_case, auth.uid(), audit_action, 'document', changed_document::text, jsonb_build_object('status', changed_status));
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

create trigger documents_audit after insert or update or delete on public.documents for each row execute function public.audit_document_change();

insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('capital-documents', 'capital-documents', false, 20971520, array['application/pdf','image/png','image/jpeg','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict (id) do nothing;

create or replace function public.can_access_document_path(object_name text)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  folders text[];
  path_office uuid;
  path_case uuid;
begin
  folders := storage.foldername(object_name);
  if coalesce(array_length(folders, 1), 0) < 2 then return false; end if;
  begin
    path_office := folders[1]::uuid;
    path_case := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.has_case_access(path_case) and exists (
    select 1 from public.capital_cases capital_case
    join public.clients client on client.id = capital_case.client_id
    where capital_case.id = path_case and client.office_id = path_office
  );
end;
$$;

create or replace function public.can_manage_document_path(object_name text, allowed_roles public.office_role[])
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  folders text[];
  path_office uuid;
  path_case uuid;
begin
  folders := storage.foldername(object_name);
  if coalesce(array_length(folders, 1), 0) < 2 then return false; end if;
  begin
    path_office := folders[1]::uuid;
    path_case := folders[2]::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return public.has_case_role(path_case, allowed_roles) and exists (
    select 1 from public.capital_cases capital_case
    join public.clients client on client.id = capital_case.client_id
    where capital_case.id = path_case and client.office_id = path_office
  );
end;
$$;

create policy capital_documents_select on storage.objects for select to authenticated using (bucket_id = 'capital-documents' and public.can_access_document_path(name));
create policy capital_documents_insert on storage.objects for insert to authenticated with check (bucket_id = 'capital-documents' and public.can_manage_document_path(name, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[]));
create policy capital_documents_update on storage.objects for update to authenticated using (bucket_id = 'capital-documents' and public.can_manage_document_path(name, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[])) with check (bucket_id = 'capital-documents' and public.can_manage_document_path(name, array['administrator','accountant','office_staff','bookkeeper']::public.office_role[]));
create policy capital_documents_delete on storage.objects for delete to authenticated using (bucket_id = 'capital-documents' and public.can_manage_document_path(name, array['administrator','accountant']::public.office_role[]));

comment on column public.documents.internal_note is 'Office workpaper only. Must never be included in client, signature, Form 1219, or Tax Authority exports.';
comment on table public.audit_events is 'Append-only through RLS: authenticated clients can insert/select under policy but cannot update or delete.';

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.offices, public.profiles, public.office_members,
  public.clients, public.client_access, public.capital_cases, public.documents, public.work_sessions to authenticated;
grant select, insert on public.audit_events to authenticated;
grant usage on sequence public.audit_events_id_seq to authenticated;
