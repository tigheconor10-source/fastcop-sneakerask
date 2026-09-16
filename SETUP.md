# Fastcop Consignment — Setup completo

## 1. Supabase

1. Ve a [supabase.com](https://supabase.com) → New Project → llámalo `fastcop-consignment`
2. Espera que se cree (~2 min)
3. Settings → API → copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`
4. SQL Editor → New query → pega todo el contenido de `supabase/schema.sql` → Run

## 2. Activar login con Discord en Supabase

1. Supabase Dashboard → Authentication → Providers → Discord → **Enable**
2. Necesitas crear una app en Discord para obtener Client ID y Secret:

### Crear app en Discord Developer Portal

1. Ve a [discord.com/developers/applications](https://discord.com/developers/applications) → **New Application**
2. Nómbrala `Fastcop Consignment`
3. Pestaña **OAuth2**:
   - Copia `Client ID` y `Client Secret`
   - En **Redirects** añade: `https://xxxx.supabase.co/auth/v1/callback`
     (la URL exacta la encuentras en Supabase → Auth → Providers → Discord)
4. Pega el Client ID y Client Secret en Supabase → Auth → Providers → Discord → Save

### Crear el bot (para DMs de ventas)

1. En la misma app de Discord → pestaña **Bot** → **Add Bot**
2. Copia el **Token** → es tu `DISCORD_BOT_TOKEN`
3. En **Privileged Gateway Intents** activa: `SERVER MEMBERS INTENT` (necesario para DMs)
4. Ve a OAuth2 → URL Generator → marca `bot` + `Send Messages` → copia la URL de invitación
5. Abre esa URL para añadir el bot a tu servidor de Discord de Fastcop

## 3. Variables de entorno

Crea un archivo `.env.local` en la raíz (copia de `.env.local.example`) y rellena todos los valores.

## 4. Correr en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000 → te redirigirá a `/login` → botón "Continuar con Discord".

## 5. Desplegar en Vercel

1. Sube el proyecto a GitHub
2. [vercel.com](https://vercel.com) → Import Repository
3. En **Environment Variables** añade todas las del `.env.local`
4. Deploy

⚠️ Después del deploy, actualiza la URL de redirect en Discord Developer Portal:
`https://tu-proyecto.vercel.app/auth/callback`

## 6. Hacer admin a tu propio usuario

Después de hacer login por primera vez con tu cuenta de Discord:
```sql
-- En Supabase SQL Editor
update profiles set is_admin = true where email = 'tu@email.com';
```

## 7. Aprobar consignadores

Por defecto, `is_approved = false`. Cuando un consignador se registre:
```sql
update profiles set is_approved = true where discord_id = 'su_discord_id';
```
(Más adelante añadiremos un panel de admin para hacerlo desde la UI)
