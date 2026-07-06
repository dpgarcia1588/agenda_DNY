-- ============================================
-- DNY Party Decoration — Tabla de eventos
-- Pega esto en Supabase: SQL Editor → New query → Run
-- ============================================

create table if not exists public.eventos (
  id uuid primary key default gen_random_uuid(),
  fecha date not null,
  cliente text not null,
  tipo text not null default 'Decoración + Catering',
  hora text,
  lugar text,
  invitados integer,
  notas text,
  estado text not null default 'Pendiente',
  created_at timestamptz default now()
);

create index if not exists eventos_fecha_idx on public.eventos (fecha);

-- Seguridad: permite leer y escribir con la clave pública (anon)
alter table public.eventos enable row level security;

create policy "acceso equipo lectura" on public.eventos for select using (true);
create policy "acceso equipo insertar" on public.eventos for insert with check (true);
create policy "acceso equipo actualizar" on public.eventos for update using (true);
create policy "acceso equipo eliminar" on public.eventos for delete using (true);

-- Habilitar sincronización en tiempo real
alter publication supabase_realtime add table public.eventos;
