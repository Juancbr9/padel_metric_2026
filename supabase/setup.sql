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
language sql security definer set search_path = '' as $$
  select c.name, c.data, c.version, c.updated_at from public.pm_clubs c where c.code = p_code;
$$;

create or replace function public.pm_create_club(p_code text, p_name text, p_data jsonb)
returns bigint
language plpgsql security definer set search_path = '' as $$
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
language plpgsql security definer set search_path = '' as $$
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

-- Consulta ligera: solo el número de versión, para saber si hay cambios sin descargar todo
create or replace function public.pm_club_version(p_code text)
returns bigint
language sql security definer set search_path = '' as $$
  select c.version from public.pm_clubs c where c.code = p_code;
$$;

revoke all on function public.pm_club_version(text) from public;
grant execute on function public.pm_club_version(text) to anon, authenticated;
revoke all on function public.pm_get_club(text) from public;
revoke all on function public.pm_create_club(text, text, jsonb) from public;
revoke all on function public.pm_save_club(text, jsonb, bigint) from public;
grant execute on function public.pm_get_club(text) to anon, authenticated;
grant execute on function public.pm_create_club(text, text, jsonb) to anon, authenticated;
grant execute on function public.pm_save_club(text, jsonb, bigint) to anon, authenticated;

-- ==========================================================
-- DIRECTO PARA ESPECTADORES
-- El móvil que anota publica el marcador con su clave secreta; quien tenga el código (en el enlace o el QR)
-- solo puede leerlo. Los directos de más de 3 días se borran solos al publicar otro.
-- ==========================================================
create table if not exists public.pm_live (
  code text primary key,
  secret text not null,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.pm_live enable row level security;
revoke all on public.pm_live from anon, authenticated;
create index if not exists pm_live_updated_at_idx on public.pm_live (updated_at);

create or replace function public.pm_live_publish(p_code text, p_secret text, p_data jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  n integer;
begin
  if length(p_code) < 8 or length(p_secret) < 20 then
    raise exception 'Código o clave del directo demasiado cortos';
  end if;
  if octet_length(p_data::text) > 65536 then
    raise exception 'Datos del directo demasiado grandes';
  end if;
  delete from public.pm_live where updated_at < now() - interval '3 days';
  insert into public.pm_live as l (code, secret, data, updated_at)
  values (p_code, p_secret, p_data, now())
  on conflict (code) do update set data = excluded.data, updated_at = now()
  where l.secret = excluded.secret;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

create or replace function public.pm_live_get(p_code text)
returns table (data jsonb, updated_at timestamptz, server_now timestamptz)
language sql stable security definer set search_path = '' as $$
  select l.data, l.updated_at, now() from public.pm_live l where l.code = p_code;
$$;

revoke all on function public.pm_live_publish(text, text, jsonb) from public;
revoke all on function public.pm_live_get(text) from public;
grant execute on function public.pm_live_publish(text, text, jsonb) to anon, authenticated;
grant execute on function public.pm_live_get(text) to anon, authenticated;
