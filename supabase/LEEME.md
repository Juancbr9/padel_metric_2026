# Sincronizar Padel Metric entre móviles (Supabase)

La base de datos de Padel Metric ya está creada y configurada (proyecto `padel-metric` en Supabase, región París). La app la usa por defecto, así que **no hay que configurar nada**:

1. Una persona abre el menú → **Sincronizar entre móviles**, escribe el nombre del club y pulsa **Crear club con los datos de este móvil**.
2. Pulsa **Enviar invitación** y la manda por WhatsApp al grupo.
3. Cada amigo abre el enlace en su móvil y acepta unirse.

## Usar otro proyecto de Supabase (opcional)

Si algún día prefieres una base de datos propia: crea un proyecto en [supabase.com](https://supabase.com), abre **SQL Editor**, pega [`setup.sql`](setup.sql) y pulsa **Run**. Después, en la app, despliega **Usar otro proyecto de Supabase** y pega la **Project URL** y la clave **publishable** (`sb_publishable_...`) de **Project Settings → API Keys**.

## Cómo funciona

- Cada móvil guarda sus datos y funciona **sin conexión**. Cuando hay internet, se sincroniza solo al guardar, al abrir la app, al volver a ella y, con la app abierta, cada minuto comprueba si hay novedades (una consulta de pocos bytes; solo descarga los datos cuando algo ha cambiado).
- Al sincronizar se **mezclan** los datos: los partidos, torneos y americanos nuevos de cada móvil se suman, y si dos móviles cambian lo mismo gana el cambio más reciente. Lo que se borra en un móvil se borra en todos.
- El partido que se está jugando en directo no se comparte hasta que termina y se guarda en el historial.
- **Seguridad:** la tabla no es accesible directamente; solo se puede leer o escribir un club conociendo su código secreto, que va dentro del enlace de invitación. Compártelo solo con tu grupo.
- **Salir del club** en un móvil deja allí sus datos y deja de sincronizar. **Restaurar de fábrica** también lo saca del club.
