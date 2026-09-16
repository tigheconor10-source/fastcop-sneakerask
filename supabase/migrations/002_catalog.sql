-- =========================================================
-- FASE A: Tabla "catalog" + datos iniciales
-- Pégalo en Supabase SQL Editor y pulsa "Run"
-- =========================================================

create table if not exists public.catalog (
  id uuid primary key default gen_random_uuid(),
  sku text not null unique,
  name text not null,
  brand text not null,
  image_url text not null,
  created_at timestamptz not null default now()
);

alter table public.catalog enable row level security;

create policy "catalog: cualquier usuario logueado puede ver"
  on public.catalog for select
  using (auth.role() = 'authenticated');

-- ---------------------------------------------------------
-- Datos iniciales: sneakers reales de fastcopstore.com
-- ---------------------------------------------------------
insert into public.catalog (sku, name, brand, image_url) values
('S70739-42', 'Saucony ProGrid Omni 9 Grey Silver Black', 'Saucony', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Disenosintitulo_1_f11838be-017f-4ca8-a492-b9932e05a364.png'),
('HQ9233', 'adidas BW Army Dark Green Carbon', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Shoe_template_d8b6cec8-a79e-433f-bd79-0b57f03d797f.webp'),
('IQ7604-100', 'Air Jordan 1 Retro Low OG SP Travis Scott Shy Pink', 'Jordan', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NikeAirJordan1RetroLowOGSPTravisScottShyPink.webp'),
('KH8707', 'Adidas Superstar II Molly-Mae Latte', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/AdidasSuperstarIIMolly-MaeLatte.webp'),
('HQ4309-610', 'Nike Mind 001 Slide Pearl Pink (Women''s)', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NikeMind001Slide.webp'),
('HQ6448', 'Yeezy Slide Onyx', 'Yeezy', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/yeezy-slide-onyx-449987_85c9116d-f75c-40f1-a065-e4bc2dc0e0b2.webp'),
('AQ9129-170', 'Jordan 4 Retro Metallic Gold', 'Jordan', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/air-jordan-4-sail-metallic-gold3.webp'),
('HV8547-002', 'Nike Moon Shoe SP Jacquemus Soft Pearl', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NikeMoonShoeSPJacquemusSoftPearl.webp'),
('JS1588', 'Adidas Vento XLG Deluxe Sail Grey', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/adidas-xlg-bone-01_47eef22b-86c5-44ea-91cb-bc0da66200ac.webp'),
('CZ7931-100', 'Nike Air Max Plus Pink Fade', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Nike_Air_Max_Plus_Pink_Fade_Women_s_1.webp'),
('JI2654', 'adidas Handball Spezial Lucid Pink White', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Gemini_Generated_Image_2fxcib2fxcib2fxc_46b1c189-72bc-46c6-9243-62b2fecad88d.webp'),
('JI3185', 'adidas Samba OG Cream White Cardboard', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/adidas_Samba_OG_Cream_White_Cardboard_1.webp'),
('DV3050-300', 'Nike Air Max 1 PRM Dirty Denim', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/New_Balance_1906R_Black_Grey_13_622c4744-2438-4576-8b6c-224bc840b547.webp'),
('II7055-800', 'Nike Air Max 1 Patta Waves Hyper Crimson Pure Platinum', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NikeAirMax1PattaWavesHyperCrimsonPurePlatinum.webp'),
('DZ4494-100', 'Nike Air Max 1 Sail Ironstone', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Shoe_template_11_94fc57dd-047e-4afb-95b2-edff606813e7.webp'),
('FV5029-200', 'Jordan 4 Retro Cave Stone', 'Jordan', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Jordan4RetroCaveStone.webp'),
('FV5029-010', 'Jordan 4 Retro Black Cat (2025)', 'Jordan', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Jordan4RetroBlackCat_2025.webp'),
('KH9044', 'adidas Handball Spezial Valentine''s Day (2026)', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/adidasHandballSpezialValentine_sDay_2026.webp'),
('U9060493', 'New Balance 9060 Mono Cortado', 'New Balance', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NewBalance9060MonoCortado.webp'),
('JQ6739', 'adidas ZX 8000 Consortium Blue Glow Unity Purple', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/adidasZX8000ConsortiumBlueGlowUnityPurple.webp'),
('IM3906-100', 'Nike Air Max 1 ''87 Stranger Things Steve Harrington', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/NikeAirMax1_87StrangerThingsSteveHarrington.webp'),
('ID1435', 'adidas Campus 00s Wonder White Gum', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/UweDUI2v6KT9Xu9C9fxm6WQ3GpptwUA7Gbhn4eU6.webp'),
('JP5329', 'adidas Samba OG Wonder White Black Pony', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Shoe_template_15.webp'),
('1203A537-111', 'ASICS Gel-Kayano 14 White Ivory', 'ASICS', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Diseno_sin_titulo_15.webp'),
('3ME10101430', 'On Running Cloudtilt Black Ivory', 'On Running', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/OnRunningCloudtiltBlackIvory.webp'),
('JH7835', 'Adidas BW Army Lux Black Gum', 'adidas', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/adidasBWArmyLuxBlackGum.webp'),
('HF7723-001', 'Nike Zoom Vomero 5 Metallic Gold', 'Nike', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/Nike_Zoom_Vomero_5_Metallic_Gold_Women_s.webp'),
('M2002RSI', 'New Balance 2002R Driftwood Sandstone', 'New Balance', 'https://cdn.shopify.com/s/files/1/0934/0030/1911/files/New_Balance_1906R_Black_Grey_5.webp')
on conflict (sku) do nothing;
