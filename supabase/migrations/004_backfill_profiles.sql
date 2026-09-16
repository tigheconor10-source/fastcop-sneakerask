-- Si alguien inició sesión con Discord ANTES de que existiera el trigger
-- "on_auth_user_created", no se le creó fila en "profiles". Esto la crea
-- ahora para cualquier usuario que le falte (no afecta a los que ya tienen).
insert into public.profiles (id, discord_id, discord_username, discord_avatar, email)
select
  u.id,
  u.raw_user_meta_data ->> 'provider_id',
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  u.raw_user_meta_data ->> 'avatar_url',
  u.email
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
