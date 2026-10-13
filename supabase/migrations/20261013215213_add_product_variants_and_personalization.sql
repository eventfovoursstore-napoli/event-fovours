alter table public.products
  add column if not exists product_options jsonb not null default '{
    "variants":[
      {"name":"Colore nastro","values":["Avorio","Bianco","Rosa cipria","Azzurro","Verde salvia","Bordeaux"]},
      {"name":"Confetti","values":["Confetti classici","Cioccolato","Mandorla","Senza confetti"]}
    ],
    "allow_custom_text":true,
    "customization_prompt":"Scrivi nomi, data o dedica per il bigliettino."
  }'::jsonb;
