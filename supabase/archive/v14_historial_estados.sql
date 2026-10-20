-- 1. Add the JSONB column for tracking status timestamps
ALTER TABLE public.proyectos 
ADD COLUMN IF NOT EXISTS historial_estados JSONB DEFAULT '{}'::jsonb;

-- 2. Backfill existing projects with their current updated_at for their current state
UPDATE public.proyectos
SET historial_estados = jsonb_build_object(estado, to_char(updated_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
WHERE historial_estados = '{}'::jsonb OR historial_estados IS NULL;

-- 3. Create the trigger function
CREATE OR REPLACE FUNCTION public.track_estado_history()
RETURNS TRIGGER AS $$
BEGIN
  -- If it's an INSERT, just initialize the history with the starting state
  IF TG_OP = 'INSERT' THEN
    NEW.historial_estados = jsonb_build_object(NEW.estado, to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
    RETURN NEW;
  END IF;

  -- If it's an UPDATE and the estado has changed, append the new state and timestamp
  IF TG_OP = 'UPDATE' AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    NEW.historial_estados = COALESCE(OLD.historial_estados, '{}'::jsonb) || jsonb_build_object(NEW.estado, to_char(NOW(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 4. Attach the trigger to the proyectos table
DROP TRIGGER IF EXISTS tr_track_estado_history ON public.proyectos;
CREATE TRIGGER tr_track_estado_history
  BEFORE INSERT OR UPDATE ON public.proyectos
  FOR EACH ROW
  EXECUTE FUNCTION public.track_estado_history();
