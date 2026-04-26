-- Insert profile for Cliente Final
INSERT INTO public.profiles (id, rol, nombre, empresa, created_at, updated_at)
VALUES (
  '44ee6448-3548-404c-bbe5-19e7ac93a158',
  'cliente_final',
  'Cliente Test',
  'Empresa Cliente SA',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET rol = 'cliente_final';

-- Insert profile for Financiero
INSERT INTO public.profiles (id, rol, nombre, empresa, created_at, updated_at)
VALUES (
  'c2653ac8-ade9-4709-877b-e12ba032b102',
  'financiero',
  'Financiero Test',
  'Fondo de Inversión',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET rol = 'financiero';

-- Insert profile for Suministrador
INSERT INTO public.profiles (id, rol, nombre, empresa, created_at, updated_at)
VALUES (
  '4e6857e7-8447-42d2-a3e8-fcce8b23d5ce',
  'suministrador',
  'Suministrador Test',
  'Suministro Eléctrico',
  now(),
  now()
) ON CONFLICT (id) DO UPDATE SET rol = 'suministrador';
