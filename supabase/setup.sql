-- ==========================================================
-- PADEL METRIC · Sincronización entre móviles (Supabase)
-- Pega este archivo completo en Supabase → SQL Editor → Run.
-- Se puede ejecutar varias veces sin problema.
-- ==========================================================

create table if not exists public.pm_clubs (
  code text primary key,
  name text not null default 'Mi club',
  data jsonb not null default '{}'::jsonb,
  version bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- Nadie puede leer ni escribir la tabla directamente: solo a través de las funciones de abajo,
-- y siempre sabiendo el código secreto del club (va dentro del enlace de invitación).
alter table public.pm_clubs enable row level security;
revoke all on public.pm_clubs from anon, authenticated;

create or replace function public.pm_get_club(p_code text)
returns table (name text, data jsonb, version bigint, updated_at timestamptz)
language sql security definer set search_path = public as $$
  select c.name, c.data, c.version, c.updated_at from public.pm_clubs c where c.code = p_code;
$$;

create or replace function public.pm_create_club(p_code text, p_name text, p_data jsonb)
returns bigint
language plpgsql security definer set search_path = public as $$
begin
  if length(p_code) < 20 then
    raise exception 'El código del club es demasiado corto';
  end if;
  insert into public.pm_clubs (code, name, data, version) values (p_code, coalesce(nullif(p_name, ''), 'Mi club'), p_data, 1);
  return 1;
end;
$$;

-- Guarda solo si nadie ha guardado entre medias (versión). Si otro móvil se adelantó devuelve -1
-- y la app vuelve a descargar, mezcla y reintenta.
create or replace function public.pm_save_club(p_code text, p_data jsonb, p_base_version bigint)
returns bigint
language plpgsql security definer set search_path = public as $$
declare
  v bigint;
begin
  update public.pm_clubs
     set data = p_data, version = version + 1, updated_at = now()
   where code = p_code and version = p_base_version
  returning version into v;
  if v is null then
    if not exists (select 1 from public.pm_clubs where code = p_code) then
      raise exception 'El club no existe';
    end if;
    return -1;
  end if;
  return v;
end;
$$;

revoke all on function public.pm_get_club(text) from public;
revoke all on function public.pm_create_club(text, text, jsonb) from public;
revoke all on function public.pm_save_club(text, jsonb, bigint) from public;
grant execute on function public.pm_get_club(text) to anon, authenticated;
grant execute on function public.pm_create_club(text, text, jsonb) to anon, authenticated;
grant execute on function public.pm_save_club(text, jsonb, bigint) to anon, authenticated;
