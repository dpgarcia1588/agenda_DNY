# DNY Party Decoration — Agenda de eventos

App web con base de datos en la nube (Supabase) para que todo tu equipo
vea y registre eventos desde cualquier dispositivo.

## Paso 1 — Crear la tabla en Supabase (5 min)

1. Entra a https://supabase.com y abre tu proyecto (o crea uno nuevo, plan gratis).
2. En el menú izquierdo ve a **SQL Editor** → **New query**.
3. Abre el archivo `supabase-setup.sql` de esta carpeta, copia TODO su contenido,
   pégalo en el editor y presiona **Run**.
4. Debe decir "Success". Con eso ya existe la tabla `eventos` con sincronización
   en tiempo real activada.

## Paso 2 — Conectar la app con tu Supabase (2 min)

1. En Supabase ve a **Settings → API** (Configuración → API).
2. Copia dos cosas:
   - **Project URL** (algo como `https://abcdefgh.supabase.co`)
   - **anon public** key (una clave larga)
3. Abre el archivo `src/config.js` de esta carpeta y pega ambos valores
   donde dice `PEGA_AQUI_...`. Guarda el archivo.

## Paso 3 — Subir a Vercel (10 min)

Opción fácil (sin instalar nada):

1. Entra a https://vercel.com e inicia sesión.
2. Haz clic en **Add New → Project**.
3. Vercel pide un repositorio de GitHub. Si no usas GitHub, usa la opción
   de abajo con la terminal. Si sí usas GitHub:
   - Sube esta carpeta a un repositorio nuevo en github.com
   - En Vercel selecciona ese repositorio → **Import**
   - Vercel detecta Vite automáticamente → clic en **Deploy**
4. En 1-2 minutos tendrás tu enlace, por ejemplo:
   `https://dny-agenda.vercel.app`

Opción con terminal (si tienes Node.js instalado):

```
cd dny-agenda
npm install
npm install -g vercel
vercel
```
Sigue las preguntas (acepta los valores por defecto) y al final te da el enlace.

## Paso 4 — Compartir con tu equipo

Envía el enlace de Vercel a las personas de tu equipo. Todos verán la misma
agenda: si alguien registra un evento, a los demás les aparece al instante
sin recargar la página.

En el celular pueden abrir el enlace y usar "Agregar a pantalla de inicio"
para tenerla como si fuera una app instalada.

## Nota importante sobre seguridad

Con esta configuración, cualquier persona que tenga el enlace puede ver y
editar la agenda. Para un equipo pequeño y de confianza está bien. Si más
adelante quieres que cada persona entre con usuario y contraseña, se puede
agregar el login de Supabase — pídele a Claude esa mejora cuando la necesites.

## ¿Problemas?

- "Falta configurar Supabase" en pantalla → revisa el Paso 2 y vuelve a
  hacer deploy.
- No guarda eventos → verifica que corriste el SQL completo del Paso 1.
