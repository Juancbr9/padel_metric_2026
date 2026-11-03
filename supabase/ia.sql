-- ==========================================================
-- PADEL METRIC · RESUMEN DEL PARTIDO CON IA (límites de uso)
-- Lo usa la función resumen-partido (supabase/functions/resumen-partido). La función reserva un uso antes de
-- llamar a la IA: como mucho p_limite_mes resúmenes al mes por dispositivo y p_tope_dia en total al día (para que
-- nadie pueda gastar de más). Si la IA falla, devuelve la reserva. Solo la función (service_role) puede usarlas.
-- ==========================================================
create table if not exists public.pm_ia_uso (
  device text not null,
  mes text not null,
  n integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (device, mes)
);
alter table public.pm_ia_uso enable row level security;
revoke all on public.pm_ia_uso from anon, authenticated;

create table if not exists public.pm_ia_dia (
  dia date primary key,
  n integer not null default 0
);
alter table public.pm_ia_dia enable row level security;
revoke all on public.pm_ia_dia from anon, authenticated;

-- Devuelve cuántos le quedan este mes tras reservar uno; -1 = sin usos este mes, -2 = tope diario, -3 = dispositivo no válido
create or replace function public.pm_ia_reservar(p_device text, p_limite_mes integer, p_tope_dia integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_mes text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
  v_dia date := (now() at time zone 'Europe/Madrid')::date;
  v_usados integer;
  v_total integer;
begin
  if p_device is null or p_device !~ '^[a-z0-9]{16,64}$' then
    return -3;
  end if;
  insert into public.pm_ia_dia (dia, n) values (v_dia, 0) on conflict (dia) do nothing;
  select d.n into v_total from public.pm_ia_dia d where d.dia = v_dia for update;
  if v_total >= p_tope_dia then
    return -2;
  end if;
  insert into public.pm_ia_uso (device, mes, n) values (p_device, v_mes, 0) on conflict (device, mes) do nothing;
  select u.n into v_usados from public.pm_ia_uso u where u.device = p_device and u.mes = v_mes for update;
  if v_usados >= p_limite_mes then
    return -1;
  end if;
  update public.pm_ia_uso set n = n + 1, updated_at = now() where device = p_device and mes = v_mes;
  update public.pm_ia_dia set n = n + 1 where dia = v_dia;
  delete from public.pm_ia_uso where updated_at < now() - interval '120 days';
  return p_limite_mes - v_usados - 1;
end;
$$;

create or replace function public.pm_ia_devolver(p_device text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_mes text := to_char(now() at time zone 'Europe/Madrid', 'YYYY-MM');
  v_dia date := (now() at time zone 'Europe/Madrid')::date;
begin
  update public.pm_ia_uso set n = greatest(0, n - 1) where device = p_device and mes = v_mes;
  update public.pm_ia_dia set n = greatest(0, n - 1) where dia = v_dia;
end;
$$;

revoke all on function public.pm_ia_reservar(text, integer, integer) from public, anon, authenticated;
revoke all on function public.pm_ia_devolver(text) from public, anon, authenticated;
grant execute on function public.pm_ia_reservar(text, integer, integer) to service_role;
grant execute on function public.pm_ia_devolver(text) to service_role;
