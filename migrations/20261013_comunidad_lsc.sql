-- Ejecutar UNA VEZ en el SQL Editor del proyecto Supabase de pruebas.
-- Aditiva: no modifica objetos, administradores ni sus archivos.
begin;

create table if not exists public.comunidad_perfiles (
  id uuid primary key references auth.users(id) on delete cascade,
  alias text not null check (char_length(alias) between 2 and 40),
  creado_en timestamptz not null default now()
);

create table if not exists public.comunidad_senas (
  id uuid primary key default gen_random_uuid(),
  autor_id uuid not null references public.comunidad_perfiles(id),
  significado text not null check (char_length(significado) between 2 and 100),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  archivo text unique not null,
  mime text not null check (mime in ('video/mp4','video/webm','video/quicktime')),
  bytes bigint not null check (bytes between 1 and 26214400),
  estado text not null default 'borrador' check (estado in ('borrador','pendiente','aprobado','rechazado')),
  nota_revision text not null default '' check (char_length(nota_revision) <= 500),
  consentimiento_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  revisado_en timestamptz
);
create index if not exists comunidad_senas_estado_fecha on public.comunidad_senas(estado, creado_en desc);
create index if not exists comunidad_senas_autor on public.comunidad_senas(autor_id, creado_en desc);

create table if not exists public.lsc_interfaz (
  clave text primary key check (clave ~ '^[a-z0-9_.-]{1,100}$'),
  etiqueta text not null check (char_length(etiqueta) between 2 and 160),
  video_url text not null check (char_length(video_url) <= 2000 and video_url ~ '^https://'),
  activo boolean not null default true,
  actualizado_en timestamptz not null default now()
);

-- Solo el backend con service_role puede acceder. Nunca usar esa clave en HTML.
alter table public.comunidad_perfiles enable row level security;
alter table public.comunidad_senas enable row level security;
alter table public.lsc_interfaz enable row level security;
revoke all on public.comunidad_perfiles, public.comunidad_senas, public.lsc_interfaz from anon, authenticated;
grant all on public.comunidad_perfiles, public.comunidad_senas, public.lsc_interfaz to service_role;

-- Reserva atómica: evita que varias pestañas creen subidas ilimitadas.
create or replace function public.comunidad_reservar(
  p_autor uuid, p_significado text, p_descripcion text, p_mime text, p_bytes bigint
) returns public.comunidad_senas
language plpgsql security invoker set search_path = public as $$
declare v_id uuid := gen_random_uuid(); v_fila public.comunidad_senas;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_autor::text, 0));
  if (select count(*) from public.comunidad_senas where autor_id = p_autor and
      (estado = 'pendiente' or (estado = 'borrador' and creado_en > now() - interval '2 hours'))) >= 5 then
    raise exception 'MAX_PENDIENTES';
  end if;
  if (select count(*) from public.comunidad_senas where autor_id = p_autor and creado_en > now() - interval '1 day') >= 10 then
    raise exception 'MAX_DIARIO';
  end if;
  insert into public.comunidad_senas(id, autor_id, significado, descripcion, mime, bytes, archivo)
    values (v_id, p_autor, p_significado, p_descripcion, p_mime, p_bytes,
      p_autor::text || '/' || v_id::text || case p_mime when 'video/mp4' then '.mp4' when 'video/webm' then '.webm' else '.mov' end)
    returning * into v_fila;
  return v_fila;
end $$;

-- Se calcula sobre aportes aprobados: revisar dos veces no duplica puntos.
create or replace function public.comunidad_ranking()
returns table (autor_id uuid, alias text, aportes bigint)
language sql stable security invoker set search_path = public as $$
  select p.id, p.alias, count(*) from public.comunidad_perfiles p
  join public.comunidad_senas s on s.autor_id = p.id and s.estado = 'aprobado'
  group by p.id, p.alias order by count(*) desc, p.creado_en asc, p.id limit 100
$$;
revoke all on function public.comunidad_reservar(uuid,text,text,text,bigint), public.comunidad_ranking() from public, anon, authenticated;
grant execute on function public.comunidad_reservar(uuid,text,text,text,bigint), public.comunidad_ranking() to service_role;

create or replace function public.comunidad_descubrir()
returns setof public.comunidad_senas
language sql volatile security invoker set search_path = public as $$
  select * from public.comunidad_senas where estado = 'aprobado' order by random() limit 24
$$;
revoke all on function public.comunidad_descubrir() from public, anon, authenticated;
grant execute on function public.comunidad_descubrir() to service_role;

-- Sin políticas públicas de lectura/escritura. Acceso mediante URL firmada.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('ensenas-comunidad', 'ensenas-comunidad', false, 26214400, array['video/mp4','video/webm','video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
notify pgrst, 'reload schema';
commit;
