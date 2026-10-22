# Sincronizar Padel Metric entre móviles (Supabase)

Solo lo hace **una persona** (quien crea el club). Los demás se unen con el enlace de invitación.

## 1. Crear el proyecto (gratis)

1. Entra en [supabase.com](https://supabase.com) y crea una cuenta (puedes entrar con GitHub).
2. Pulsa **New project**. Pon un nombre (por ejemplo `padel-metric`), una contraseña para la base de datos (guárdala, aunque la app no la necesita) y la región más cercana (por ejemplo *West EU*).
3. Espera un par de minutos a que el proyecto esté listo.

## 2. Preparar la base de datos

1. En el menú de la izquierda abre **SQL Editor** → **New query**.
2. Copia todo el contenido de [`setup.sql`](setup.sql), pégalo y pulsa **Run**. Debe decir *Success*.

## 3. Crear el club en la app

1. En Supabase ve a **Project Settings → API** (o **Data API**) y copia:
   - **Project URL** (algo como `https://abcdxyz.supabase.co`)
   - La clave **anon public**
2. En Padel Metric: menú → **Sincronizar entre móviles** → pega la URL, la clave y el nombre del club → **Crear club con los datos de este móvil**.
3. Pulsa **Enviar invitación** y mándala por WhatsApp a tu grupo. Al abrir el enlace en su móvil, la app les pregunta si quieren unirse.

## Cómo funciona

- Cada móvil guarda sus datos y funciona **sin conexión**. Cuando hay internet, se sincroniza solo al guardar, al abrir la app y al volver a ella.
- Al sincronizar se **mezclan** los datos: los partidos, torneos y americanos nuevos de cada móvil se suman, y si dos móviles cambian lo mismo gana el cambio más reciente. Lo que se borra en un móvil se borra en todos.
- El partido que se está jugando en directo no se comparte hasta que termina y se guarda en el historial.
- **Seguridad:** la tabla no es accesible directamente; solo se puede leer o escribir un club conociendo su código secreto, que va dentro del enlace de invitación. Compártelo solo con tu grupo.
- **Salir del club** en un móvil deja allí sus datos y deja de sincronizar. **Restaurar de fábrica** también lo saca del club.
