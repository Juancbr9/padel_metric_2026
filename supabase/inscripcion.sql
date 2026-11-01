-- ==========================================================
-- PADEL METRIC · INSCRIPCIÓN CON QR (solo hay que ejecutarlo una vez)
-- Supabase → SQL Editor → New query → pega todo este archivo → Run.
-- Ya está incluido al final de setup.sql; este archivo es para proyectos que ya tenían el resto.
--
-- El organizador publica en pm_live una inscripción abierta (data.kind = 'signup', data.open = true) con su
-- clave secreta. Quien tenga el código (enlace o QR) puede apuntarse con su nombre mientras siga abierta.
-- Cada persona guarda en su móvil una clave propia (p_player) con la que puede cambiar su nombre o borrarse.
-- La lista se puede leer sin las claves. Las inscripciones de más de 3 días se borran solas.
-- ==========================================================
create table if not exists public.pm_live_join (
  code text not null,
  player text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (code, player)
);
alter table public.pm_live_join enable row level security;
revoke all on public.pm_live_join from anon, authenticated;
create index if not exists pm_live_join_updated_at_idx on public.pm_live_join (updated_at);

create or replace function public.pm_live_join(p_code text, p_player text, p_data jsonb)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  lobby jsonb;
  n integer;
begin
  if p_code !~ '^[a-z0-9]{8,40}$' or p_player !~ '^[a-z0-9]{16,64}$' then
    return false;
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' or octet_length(p_data::text) > 600 then
    return false;
  end if;
  select l.data into lobby from public.pm_live l where l.code = p_code;
  if lobby is null or coalesce(lobby->>'kind', '') <> 'signup' or coalesce(lobby->>'open', 'false') <> 'true' then
    return false;
  end if;
  select count(*) into n from public.pm_live_join j where j.code = p_code and j.player <> p_player;
  if n >= 64 then
    return false;
  end if;
  delete from public.pm_live_join where updated_at < now() - interval '3 days';
  insert into public.pm_live_join as j (code, player, data, created_at, updated_at)
  values (p_code, p_player, p_data, now(), now())
  on conflict (code, player) do update set data = excluded.data, updated_at = now();
  return true;
end;
$$;

create or replace function public.pm_live_joins(p_code text)
returns table (id text, data jsonb, updated_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select left(md5(j.player), 12), j.data, j.updated_at
  from public.pm_live_join j
  where j.code = p_code
  order by j.created_at;
$$;

revoke all on function public.pm_live_join(text, text, jsonb) from public;
revoke all on function public.pm_live_joins(text) from public;
grant execute on function public.pm_live_join(text, text, jsonb) to anon, authenticated;
grant execute on function public.pm_live_joins(text) to anon, authenticated;
