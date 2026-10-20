-- v21: Fix handle_new_user trigger to default to 'pendiente' instead of 'epc'
-- New registrations will now require admin approval before accessing any portal.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, empresa, rol)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'nombre', ''),
    coalesce(new.raw_user_meta_data->>'empresa', ''),
    coalesce(new.raw_user_meta_data->>'rol', 'pendiente')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
