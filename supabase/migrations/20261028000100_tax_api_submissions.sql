-- Apply AFTER 20261011193000_secure_core.sql, only to the isolated capital project.
create table public.tax_api_submissions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.capital_cases(id) on delete restrict,
  environment text not null check (environment in ('sandbox','production')),
  api_version text not null default '1.0 / 05.2025',
  payload jsonb not null check (jsonb_typeof(payload)='object'),
  payload_hash text not null check (payload_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'draft' check (status in ('draft','approved','sending','succeeded','rejected','unknown')),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  http_status integer,
  authority_error_id text,
  authority_error_code text,
  unique(case_id, environment, payload_hash)
);
alter table public.tax_api_submissions enable row level security;
revoke all on public.tax_api_submissions from anon,authenticated;
grant select on public.tax_api_submissions to authenticated;
create policy tax_api_read on public.tax_api_submissions for select to authenticated
  using (public.has_case_role(case_id,array['administrator','accountant']::public.office_role[]));

-- No client INSERT/UPDATE/DELETE permissions: state transitions occur only through RPCs.
create function public.tax_api_prepare(target_case uuid, target_environment text, request_payload jsonb, request_hash text)
returns uuid language plpgsql security definer set search_path='' as $$
declare result_id uuid; expected_date text; expected_tik text;
begin
  if not public.has_case_role(target_case,array['administrator','accountant']::public.office_role[]) then
    raise exception 'Not authorized';
  end if;
  select to_char(capital_case.declaration_date,'YYYY-MM-DD')||'T00:00:00Z',client.tax_identifier
  into expected_date, expected_tik from public.capital_cases capital_case
  join public.clients client on client.id=capital_case.client_id where capital_case.id=target_case;
  if request_payload#>>'{details,dochToDayDate}' is distinct from expected_date
     or ltrim(request_payload#>>'{details,tikNumber}','0') is distinct from ltrim(expected_tik,'0') then
    raise exception 'Declaration date or taxpayer does not match case';
  end if;
  insert into public.tax_api_submissions(case_id,environment,payload,payload_hash,created_by)
    values(target_case,target_environment,request_payload,request_hash,auth.uid())
    on conflict(case_id,environment,payload_hash) do nothing returning id into result_id;
  if result_id is null then
    select id into result_id from public.tax_api_submissions
      where case_id=target_case and environment=target_environment and payload_hash=request_hash;
  end if;
  return result_id;
end;
$$;

create function public.tax_api_approve(job_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare job public.tax_api_submissions;
begin
  select * into job from public.tax_api_submissions where id=job_id for update;
  if not found or not public.has_case_role(job.case_id,array['administrator','accountant']::public.office_role[]) then
    raise exception 'Not authorized';
  end if;
  if job.status <> 'draft' then raise exception 'Submission is not a draft'; end if;
  update public.tax_api_submissions set status='approved',approved_by=auth.uid(),approved_at=now() where id=job_id;
end;
$$;

create function public.tax_api_claim(job_id uuid, actor_id uuid)
returns setof public.tax_api_submissions language plpgsql security definer set search_path='' as $$
declare job public.tax_api_submissions; allowed boolean; expected_date text; expected_tik text;
begin
  select * into job from public.tax_api_submissions where id=job_id for update;
  if not found or job.status<>'approved' then raise exception 'Submission is not approved or was already attempted'; end if;
  select exists(
    select 1 from public.capital_cases capital_case
    join public.clients client on client.id=capital_case.client_id
    join public.office_members member on member.office_id=client.office_id
    where capital_case.id=job.case_id and member.user_id=actor_id and member.active
      and member.role in ('administrator','accountant') and
      (member.role='administrator' or client.assigned_to=actor_id or exists(select 1 from public.client_access grant_row where grant_row.client_id=client.id and grant_row.user_id=actor_id))
  ) into allowed;
  if not allowed then raise exception 'Not authorized'; end if;
  select to_char(capital_case.declaration_date,'YYYY-MM-DD')||'T00:00:00Z',client.tax_identifier
    into expected_date,expected_tik from public.capital_cases capital_case
    join public.clients client on client.id=capital_case.client_id where capital_case.id=job.case_id;
  if job.payload#>>'{details,dochToDayDate}' is distinct from expected_date
    or ltrim(job.payload#>>'{details,tikNumber}','0') is distinct from ltrim(expected_tik,'0') then
    raise exception 'Case changed after approval';
  end if;
  return query update public.tax_api_submissions set status='sending',started_at=now() where id=job_id returning *;
end;
$$;

create function public.tax_api_complete(job_id uuid, outcome text, response_status integer, error_id text, error_code text)
returns void language plpgsql security definer set search_path='' as $$
begin
  if outcome not in ('succeeded','rejected','unknown') then raise exception 'Invalid outcome'; end if;
  update public.tax_api_submissions set status=outcome,http_status=response_status,
    authority_error_id=left(error_id,200),authority_error_code=left(error_code,100),completed_at=now()
    where id=job_id and status='sending';
  if not found then raise exception 'Submission is not sending'; end if;
end;
$$;

revoke all on function public.tax_api_prepare(uuid,text,jsonb,text), public.tax_api_approve(uuid),
  public.tax_api_claim(uuid,uuid), public.tax_api_complete(uuid,text,integer,text,text) from public,anon,authenticated;
grant execute on function public.tax_api_prepare(uuid,text,jsonb,text),public.tax_api_approve(uuid) to authenticated;
grant execute on function public.tax_api_claim(uuid,uuid),public.tax_api_complete(uuid,text,integer,text,text) to service_role;

create function public.audit_tax_api_change()
returns trigger language plpgsql security definer set search_path='' as $$
declare office uuid;
begin
  select client.office_id into office from public.capital_cases capital_case
  join public.clients client on client.id=capital_case.client_id where capital_case.id=new.case_id;
  insert into public.audit_events(office_id,case_id,actor_id,action,entity_type,entity_id,metadata)
  values(office,new.case_id,coalesce(auth.uid(),new.approved_by,new.created_by),
    'tax_api.'||new.status,'tax_api_submission',new.id::text,
    jsonb_build_object('environment',new.environment,'payload_hash',new.payload_hash));
  return new;
end;
$$;
create trigger tax_api_audit after insert or update on public.tax_api_submissions
  for each row execute function public.audit_tax_api_change();
