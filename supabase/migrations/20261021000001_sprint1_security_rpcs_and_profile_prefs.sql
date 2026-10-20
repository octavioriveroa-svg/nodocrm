-- ============================================================================
-- MIGRATION: 20261021000001_sprint1_security_rpcs_and_profile_prefs.sql
-- Covers: SEC-01, SEC-02, SEC-04, SEC-06, R1-Defect-4, DATA-01, DATA-02, DATA-03
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. PROFILE PREFERENCE & COMPANY COLUMNS (R1-Defect-4)
-- ----------------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rfc TEXT,
  ADD COLUMN IF NOT EXISTS industria TEXT,
  ADD COLUMN IF NOT EXISTS ubicacion_estado TEXT,
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS moneda_preferida TEXT NOT NULL DEFAULT 'MXN' CHECK (moneda_preferida IN ('MXN', 'USD')),
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/Mexico_City',
  ADD COLUMN IF NOT EXISTS notif_nuevo_proyecto BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_cambio_estado BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notif_comentarios BOOLEAN NOT NULL DEFAULT FALSE;

-- ----------------------------------------------------------------------------
-- 2. PREVENT SELF-ROLE ESCALATION ON public.profiles (SEC-01)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_rol TEXT;
BEGIN
  IF NEW.rol IS DISTINCT FROM OLD.rol THEN
    -- Allow service_role / postgres / supabase_admin (where auth.uid() IS NULL)
    IF auth.uid() IS NOT NULL THEN
      SELECT p.rol INTO v_caller_rol
      FROM public.profiles p
      WHERE p.id = auth.uid();

      IF COALESCE(v_caller_rol, '') <> 'nodo_admin' THEN
        RAISE EXCEPTION 'Operación no permitida: solo un administrador (nodo_admin) puede modificar el rol de un perfil.';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_role ON public.profiles;
CREATE TRIGGER trg_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

DROP POLICY IF EXISTS "Actualizar propio perfil" ON public.profiles;
CREATE POLICY "Actualizar propio perfil"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND rol = (SELECT p.rol FROM public.profiles p WHERE p.id = auth.uid())
  );

-- ----------------------------------------------------------------------------
-- 3. LOCK DOWN SIGNUP TRIGGER TO ALWAYS ASSIGN 'pendiente' (SEC-02, SEC-04)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, nombre, empresa, rol)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nombre', ''),
    COALESCE(NEW.raw_user_meta_data->>'empresa', ''),
    'pendiente'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 4. HARDEN ALL SECURITY DEFINER FUNCTIONS WITH search_path = public (SEC-04)
--    AND SYNC auth.users METADATA ON ROLE UPDATES (SEC-06)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_update_role(target_id UUID, new_rol TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_rol TEXT;
BEGIN
  SELECT p.rol INTO v_caller_rol
  FROM public.profiles p
  WHERE p.id = auth.uid();

  IF COALESCE(v_caller_rol, '') NOT IN ('nodo_admin', 'nodo_analista') THEN
    RAISE EXCEPTION 'Solo administradores o analistas autorizados pueden cambiar roles';
  END IF;

  IF v_caller_rol = 'nodo_analista' AND new_rol = 'nodo_admin' THEN
    RAISE EXCEPTION 'Un analista no puede asignar el rol de administrador (nodo_admin)';
  END IF;

  IF new_rol NOT IN ('epc', 'nodo_analista', 'nodo_admin', 'cliente_final', 'financiero', 'suministrador', 'pendiente', 'finder') THEN
    RAISE EXCEPTION 'Rol no válido: %', new_rol;
  END IF;

  UPDATE public.profiles
  SET rol = new_rol
  WHERE id = target_id;

  UPDATE auth.users
  SET raw_user_meta_data = COALESCE(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('rol', new_rol),
      raw_app_meta_data  = COALESCE(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', new_rol)
  WHERE id = target_id;
END;
$$;

-- Sync existing auth.users metadata with authoritative public.profiles.rol
UPDATE auth.users u
SET raw_user_meta_data = COALESCE(u.raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('rol', p.rol),
    raw_app_meta_data  = COALESCE(u.raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('user_role', p.rol)
FROM public.profiles p
WHERE u.id = p.id;

CREATE OR REPLACE FUNCTION public.is_project_epc(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proyectos WHERE id = p_proyecto_id AND epcista_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_nodo_user()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND rol IN ('nodo_admin', 'nodo_analista')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_financiero(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proyectos WHERE id = p_proyecto_id AND financiero_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION public.is_project_cliente(p_proyecto_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.proyectos p
    JOIN public.profiles pr ON pr.id = auth.uid()
    WHERE p.id = p_proyecto_id
      AND pr.rol = 'cliente_final'
      AND p.cliente_id = pr.cliente_crm_id
  );
$$;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  claims jsonb;
  user_role text;
BEGIN
  SELECT rol INTO user_role
  FROM public.profiles
  WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_role IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_role));
  ELSE
    claims := jsonb_set(claims, '{user_role}', '"pendiente"');
  END IF;

  event := jsonb_set(event, '{claims}', claims);
  RETURN event;
END;
$$;

-- ----------------------------------------------------------------------------
-- 5. TRANSACTIONAL RPC: crear_proyecto_completo (DATA-01)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.crear_proyecto_completo(p_payload JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_proyecto_id UUID;
  v_proj JSONB := p_payload->'proyecto';
  v_sitio_id TEXT;
  v_cfg JSONB;
  v_cfg_id UUID;
  v_cfg_map JSONB := '{}'::jsonb;
  v_opt JSONB;
  v_opt_id UUID;
  v_opt_map JSONB := '{}'::jsonb;
  v_link JSONB;
  v_prod JSONB;
BEGIN
  IF v_proj IS NULL OR COALESCE(TRIM(v_proj->>'nombre_proyecto'), '') = '' THEN
    RAISE EXCEPTION 'El nombre del proyecto es obligatorio.';
  END IF;

  -- 1. Insert into proyectos
  INSERT INTO public.proyectos (
    epcista_id,
    responsable_nodo_id,
    finder_id,
    cliente_id,
    tipo,
    nombre_proyecto,
    estado,
    tipo_instalacion,
    incluye_mem,
    demanda_kw,
    cliente_final_nombre,
    cliente_final_empresa,
    cliente_final_contacto,
    capex_estimado,
    moneda,
    ubicacion_estado,
    modalidad_financiamiento,
    notas_adicionales,
    capacidad_mwh,
    capacidad_mw,
    tecnologia_bateria,
    duracion_descarga_hrs,
    punto_interconexion,
    tipo_participacion_mem,
    volumen_energia_mwh_anual
  ) VALUES (
    NULLIF(v_proj->>'epcista_id', '')::UUID,
    NULLIF(v_proj->>'responsable_nodo_id', '')::UUID,
    NULLIF(v_proj->>'finder_id', '')::UUID,
    NULLIF(v_proj->>'cliente_id', '')::UUID,
    v_proj->>'tipo',
    v_proj->>'nombre_proyecto',
    COALESCE(v_proj->>'estado', 'recibido'),
    NULLIF(v_proj->>'tipo_instalacion', ''),
    COALESCE((v_proj->>'incluye_mem')::BOOLEAN, FALSE),
    NULLIF(v_proj->>'demanda_kw', '')::NUMERIC,
    COALESCE(v_proj->>'cliente_final_nombre', ''),
    COALESCE(v_proj->>'cliente_final_empresa', ''),
    COALESCE(v_proj->>'cliente_final_contacto', ''),
    NULLIF(v_proj->>'capex_estimado', '')::NUMERIC,
    COALESCE(v_proj->>'moneda', 'MXN'),
    COALESCE(v_proj->>'ubicacion_estado', ''),
    ARRAY(SELECT jsonb_array_elements_text(COALESCE(v_proj->'modalidad_financiamiento', '[]'::jsonb))),
    NULLIF(v_proj->>'notas_adicionales', ''),
    NULLIF(v_proj->>'capacidad_mwh', '')::NUMERIC,
    NULLIF(v_proj->>'capacidad_mw', '')::NUMERIC,
    NULLIF(v_proj->>'tecnologia_bateria', ''),
    NULLIF(v_proj->>'duracion_descarga_hrs', '')::NUMERIC,
    NULLIF(v_proj->>'punto_interconexion', ''),
    NULLIF(v_proj->>'tipo_participacion_mem', ''),
    NULLIF(v_proj->>'volumen_energia_mwh_anual', '')::NUMERIC
  )
  RETURNING id INTO v_proyecto_id;

  -- 2. Insert into proyecto_sitios
  FOR v_sitio_id IN
    SELECT jsonb_array_elements_text(COALESCE(p_payload->'sitios_ids', '[]'::jsonb))
  LOOP
    INSERT INTO public.proyecto_sitios (proyecto_id, sitio_id)
    VALUES (v_proyecto_id, v_sitio_id::UUID)
    ON CONFLICT (proyecto_id, sitio_id) DO NOTHING;
  END LOOP;

  -- 3. Insert into configuraciones_tecnicas and map tempId -> UUID
  FOR v_cfg IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'configuraciones', '[]'::jsonb))
  LOOP
    INSERT INTO public.configuraciones_tecnicas (
      proyecto_id,
      nombre,
      descripcion,
      inversion_total,
      moneda,
      ahorro_estimado_anual,
      ahorro_estimado_mensual,
      ahorro_moneda,
      seleccionada
    ) VALUES (
      v_proyecto_id,
      v_cfg->>'nombre',
      NULLIF(v_cfg->>'descripcion', ''),
      NULLIF(v_cfg->>'inversion_total', '')::NUMERIC,
      COALESCE(v_cfg->>'moneda', 'MXN'),
      NULLIF(v_cfg->>'ahorro_estimado_anual', '')::NUMERIC,
      NULLIF(v_cfg->>'ahorro_estimado_mensual', '')::NUMERIC,
      COALESCE(v_cfg->>'ahorro_moneda', 'MXN'),
      COALESCE((v_cfg->>'seleccionada')::BOOLEAN, FALSE)
    )
    RETURNING id INTO v_cfg_id;

    v_cfg_map := v_cfg_map || jsonb_build_object(COALESCE(v_cfg->>'temp_id', v_cfg->>'nombre'), v_cfg_id::TEXT);
  END LOOP;

  -- 4. Insert into opciones_financiamiento and map tempId -> UUID
  FOR v_opt IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'opciones_financiamiento', '[]'::jsonb))
  LOOP
    INSERT INTO public.opciones_financiamiento (
      proyecto_id,
      nombre,
      vehiculo_inversion,
      ahorro_estimado_anual,
      ahorro_estimado_mensual,
      moneda,
      plazo_meses,
      notas,
      seleccionada
    ) VALUES (
      v_proyecto_id,
      v_opt->>'nombre',
      v_opt->>'vehiculo_inversion',
      NULLIF(v_opt->>'ahorro_estimado_anual', '')::NUMERIC,
      NULLIF(v_opt->>'ahorro_estimado_mensual', '')::NUMERIC,
      COALESCE(v_opt->>'moneda', 'MXN'),
      NULLIF(v_opt->>'plazo_meses', '')::INTEGER,
      NULLIF(v_opt->>'notas', ''),
      COALESCE((v_opt->>'seleccionada')::BOOLEAN, FALSE)
    )
    RETURNING id INTO v_opt_id;

    v_opt_map := v_opt_map || jsonb_build_object(COALESCE(v_opt->>'temp_id', v_opt->>'nombre'), v_opt_id::TEXT);
  END LOOP;

  -- 5. Insert into config_financiamiento
  FOR v_link IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'config_financiamiento_links', '[]'::jsonb))
  LOOP
    v_cfg_id := NULLIF(v_cfg_map->>(v_link->>'config_temp_id'), '')::UUID;
    v_opt_id := NULLIF(v_opt_map->>(v_link->>'opcion_temp_id'), '')::UUID;

    IF v_cfg_id IS NOT NULL AND v_opt_id IS NOT NULL THEN
      INSERT INTO public.config_financiamiento (configuracion_id, opcion_financiamiento_id)
      VALUES (v_cfg_id, v_opt_id)
      ON CONFLICT (configuracion_id, opcion_financiamiento_id) DO NOTHING;
    END IF;
  END LOOP;

  -- 6. Insert into proyecto_sitio_productos
  FOR v_prod IN
    SELECT * FROM jsonb_array_elements(COALESCE(p_payload->'productos', '[]'::jsonb))
  LOOP
    v_cfg_id := NULLIF(v_cfg_map->>(v_prod->>'config_temp_id'), '')::UUID;

    INSERT INTO public.proyecto_sitio_productos (
      proyecto_id,
      configuracion_id,
      sitio_id,
      tipo,
      datos
    ) VALUES (
      v_proyecto_id,
      v_cfg_id,
      (v_prod->>'sitio_id')::UUID,
      v_prod->>'tipo',
      COALESCE(v_prod->'datos', '{}'::jsonb)
    );
  END LOOP;

  RETURN v_proyecto_id;
END;
$$;

-- ----------------------------------------------------------------------------
-- 6. TRANSACTIONAL RPCs FOR SELECTION & MODAL EDITS (DATA-02, DATA-03)
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.seleccionar_configuracion_tecnica(
  p_proyecto_id UUID,
  p_config_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_inv NUMERIC;
  v_mon TEXT;
BEGIN
  UPDATE public.configuraciones_tecnicas
  SET seleccionada = (id = p_config_id),
      updated_at = NOW()
  WHERE proyecto_id = p_proyecto_id;

  SELECT inversion_total, COALESCE(moneda, 'MXN')
  INTO v_inv, v_mon
  FROM public.configuraciones_tecnicas
  WHERE id = p_config_id AND proyecto_id = p_proyecto_id;

  UPDATE public.proyectos
  SET capex_estimado = v_inv,
      moneda = v_mon,
      updated_at = NOW()
  WHERE id = p_proyecto_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.seleccionar_opcion_financiamiento(
  p_proyecto_id UUID,
  p_opcion_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_vehiculo TEXT;
BEGIN
  UPDATE public.opciones_financiamiento
  SET seleccionada = (id = p_opcion_id),
      updated_at = NOW()
  WHERE proyecto_id = p_proyecto_id;

  SELECT vehiculo_inversion
  INTO v_vehiculo
  FROM public.opciones_financiamiento
  WHERE id = p_opcion_id AND proyecto_id = p_proyecto_id;

  IF v_vehiculo IS NOT NULL THEN
    UPDATE public.proyectos
    SET modalidad_financiamiento = ARRAY[v_vehiculo],
        updated_at = NOW()
    WHERE id = p_proyecto_id;
  END IF;
END;
$$;
