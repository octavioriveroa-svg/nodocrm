-- 0. Add relations to proyectos if they don't exist
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS cliente_id UUID REFERENCES public.profiles(id);
ALTER TABLE public.proyectos ADD COLUMN IF NOT EXISTS financiero_id UUID REFERENCES public.profiles(id);

-- 1. Create Telemetria Table
CREATE TABLE IF NOT EXISTS public.telemetria_egauge (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  proyecto_id UUID NOT NULL REFERENCES public.proyectos(id) ON DELETE CASCADE,
  timestamp TIMESTAMPTZ NOT NULL,
  solar_produccion_kwh NUMERIC NOT NULL DEFAULT 0,
  consumo_red_kwh NUMERIC NOT NULL DEFAULT 0,
  bateria_porcentaje NUMERIC NOT NULL DEFAULT 0,
  bateria_descarga_kwh NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Create index for faster time-series queries
CREATE INDEX IF NOT EXISTS telemetria_egauge_proyecto_id_timestamp_idx ON public.telemetria_egauge (proyecto_id, timestamp DESC);

-- 3. Enable RLS
ALTER TABLE public.telemetria_egauge ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
DROP POLICY IF EXISTS "Clientes ven telemetria de sus proyectos" ON public.telemetria_egauge;
CREATE POLICY "Clientes ven telemetria de sus proyectos" ON public.telemetria_egauge FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.cliente_id = auth.uid())
    OR
    EXISTS (SELECT 1 FROM public.proyectos p WHERE p.id = proyecto_id AND p.financiero_id = auth.uid())
    OR 
    EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id = auth.uid() AND pr.rol IN ('nodo_admin', 'nodo_analista', 'epc'))
  );

-- 5. Seed Script for Mock Data (Run safely in SQL Editor)
DO $$
DECLARE
  v_cliente_id UUID;
  v_financiero_id UUID;
  v_proyecto_id UUID;
  v_time TIMESTAMPTZ;
  v_solar NUMERIC;
  v_grid NUMERIC;
  v_battery NUMERIC;
  v_discharge NUMERIC;
  i INT;
BEGIN
  -- Get the test users
  SELECT id INTO v_cliente_id FROM public.profiles WHERE rol = 'cliente_final' LIMIT 1;
  SELECT id INTO v_financiero_id FROM public.profiles WHERE rol = 'financiero' LIMIT 1;

  IF v_cliente_id IS NOT NULL AND v_financiero_id IS NOT NULL THEN
    -- Assign all existing projects to these test users so they have data
    UPDATE public.proyectos SET cliente_id = v_cliente_id, financiero_id = v_financiero_id;

    -- Loop over all projects to seed 1 day of telemetry data
    FOR v_proyecto_id IN SELECT id FROM public.proyectos LOOP
      v_battery := 40.0;
      
      FOR i IN 0..23 LOOP
        v_time := date_trunc('day', NOW()) + (i || ' hours')::interval;
        
        -- Simulate solar
        IF i >= 7 AND i <= 18 THEN
          v_solar := GREATEST(0.0, 15.0 - ABS(13 - i) * 2.5) + (random() * 2);
        ELSE
          v_solar := 0.0;
        END IF;

        -- Simulate grid
        v_grid := 2.0 + (random() * 3);
        IF i >= 18 AND i <= 22 THEN v_grid := v_grid + 5.0; END IF;
        IF i >= 6 AND i <= 9 THEN v_grid := v_grid + 3.0; END IF;

        -- Simulate battery
        v_discharge := 0.0;
        IF v_solar > v_grid THEN
          v_battery := LEAST(100.0, v_battery + (v_solar - v_grid) * 2);
          v_grid := 0.0;
        ELSIF v_battery > 20.0 THEN
          v_discharge := LEAST(v_grid - v_solar, 5.0);
          v_battery := v_battery - (v_discharge * 2);
          v_grid := v_grid - v_discharge;
        END IF;

        INSERT INTO public.telemetria_egauge (
          proyecto_id, timestamp, solar_produccion_kwh, consumo_red_kwh, bateria_porcentaje, bateria_descarga_kwh
        ) VALUES (
          v_proyecto_id, v_time, round(v_solar::numeric, 2), round(GREATEST(0.0, v_grid)::numeric, 2), round(v_battery::numeric, 1), round(v_discharge::numeric, 2)
        );
      END LOOP;
    END LOOP;
  END IF;
END $$;
