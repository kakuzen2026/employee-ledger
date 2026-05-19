-- KAKUZEN integrated Supabase hardening
-- Target project: wkzbsdfgslidubqpifwa
-- Purpose: keep the single integrated app on authenticated-only RLS policies.
--
-- Apply only after confirming a Supabase backup exists.
-- This changes policies only; it does not delete data.

do $$
declare
  table_name text;
  table_names text[] := array[
    'settings',
    'clients',
    'sites',
    'assignments',
    'billing',
    'contracts',
    'doc_templates',
    'work_patterns',
    'contract_employees',
    'employee_records',
    'departments',
    'visa_types',
    'emp_work_patterns',
    'company_info',
    'employees',
    'yukyu_records',
    'yukyu_grants',
    'certificates',
    'employment_contracts',
    'dispatch_contracts'
  ];
begin
  foreach table_name in array table_names loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists auth_all on public.%I', table_name);
    execute format('drop policy if exists auth_only on public.%I', table_name);
    execute format('drop policy if exists %I on public.%I', 'authenticated_all_' || table_name, table_name);
    execute format(
      'create policy %I on public.%I for all to authenticated using ((select auth.role()) = ''authenticated'') with check ((select auth.role()) = ''authenticated'')',
      'authenticated_all_' || table_name,
      table_name
    );
  end loop;
end $$;

-- Confirmation query:
select schemaname, tablename, policyname, roles, cmd, qual, with_check
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
