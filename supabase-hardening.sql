-- Employee Ledger Supabase hardening
-- Run in the Supabase SQL editor for project jqokhqybxjkcantxsjfm.
-- This app now signs users in with Supabase Auth, so public anon access should
-- not be granted to application tables.

alter table public.employees enable row level security;
alter table public.yukyu_records enable row level security;
alter table public.yukyu_grants enable row level security;
alter table public.departments enable row level security;
alter table public.visa_types enable row level security;
alter table public.company_info enable row level security;
alter table public.certificates enable row level security;
alter table public.dispatch_contracts enable row level security;
alter table public.employment_contracts enable row level security;
alter table public.work_patterns enable row level security;

drop policy if exists "authenticated_select_employees" on public.employees;
drop policy if exists "authenticated_insert_employees" on public.employees;
drop policy if exists "authenticated_update_employees" on public.employees;
create policy "authenticated_select_employees" on public.employees for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_employees" on public.employees for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_employees" on public.employees for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_yukyu_records" on public.yukyu_records;
drop policy if exists "authenticated_insert_yukyu_records" on public.yukyu_records;
drop policy if exists "authenticated_update_yukyu_records" on public.yukyu_records;
create policy "authenticated_select_yukyu_records" on public.yukyu_records for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_yukyu_records" on public.yukyu_records for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_yukyu_records" on public.yukyu_records for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_yukyu_grants" on public.yukyu_grants;
drop policy if exists "authenticated_insert_yukyu_grants" on public.yukyu_grants;
drop policy if exists "authenticated_update_yukyu_grants" on public.yukyu_grants;
create policy "authenticated_select_yukyu_grants" on public.yukyu_grants for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_yukyu_grants" on public.yukyu_grants for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_yukyu_grants" on public.yukyu_grants for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_departments" on public.departments;
drop policy if exists "authenticated_insert_departments" on public.departments;
drop policy if exists "authenticated_update_departments" on public.departments;
create policy "authenticated_select_departments" on public.departments for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_departments" on public.departments for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_departments" on public.departments for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_visa_types" on public.visa_types;
drop policy if exists "authenticated_insert_visa_types" on public.visa_types;
drop policy if exists "authenticated_update_visa_types" on public.visa_types;
create policy "authenticated_select_visa_types" on public.visa_types for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_visa_types" on public.visa_types for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_visa_types" on public.visa_types for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_company_info" on public.company_info;
drop policy if exists "authenticated_insert_company_info" on public.company_info;
drop policy if exists "authenticated_update_company_info" on public.company_info;
create policy "authenticated_select_company_info" on public.company_info for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_company_info" on public.company_info for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_company_info" on public.company_info for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_certificates" on public.certificates;
drop policy if exists "authenticated_insert_certificates" on public.certificates;
drop policy if exists "authenticated_update_certificates" on public.certificates;
create policy "authenticated_select_certificates" on public.certificates for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_certificates" on public.certificates for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_certificates" on public.certificates for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_dispatch_contracts" on public.dispatch_contracts;
drop policy if exists "authenticated_insert_dispatch_contracts" on public.dispatch_contracts;
drop policy if exists "authenticated_update_dispatch_contracts" on public.dispatch_contracts;
create policy "authenticated_select_dispatch_contracts" on public.dispatch_contracts for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_dispatch_contracts" on public.dispatch_contracts for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_dispatch_contracts" on public.dispatch_contracts for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_employment_contracts" on public.employment_contracts;
drop policy if exists "authenticated_insert_employment_contracts" on public.employment_contracts;
drop policy if exists "authenticated_update_employment_contracts" on public.employment_contracts;
create policy "authenticated_select_employment_contracts" on public.employment_contracts for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_employment_contracts" on public.employment_contracts for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_employment_contracts" on public.employment_contracts for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

drop policy if exists "authenticated_select_work_patterns" on public.work_patterns;
drop policy if exists "authenticated_insert_work_patterns" on public.work_patterns;
drop policy if exists "authenticated_update_work_patterns" on public.work_patterns;
create policy "authenticated_select_work_patterns" on public.work_patterns for select to authenticated using ((select auth.role()) = 'authenticated');
create policy "authenticated_insert_work_patterns" on public.work_patterns for insert to authenticated with check ((select auth.role()) = 'authenticated');
create policy "authenticated_update_work_patterns" on public.work_patterns for update to authenticated using ((select auth.role()) = 'authenticated') with check ((select auth.role()) = 'authenticated');

-- Confirm there are no anon policies left before publishing:
select schemaname, tablename, policyname, roles, cmd
from pg_policies
where schemaname = 'public'
order by tablename, policyname;
