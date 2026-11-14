-- Migration: 20261112000004_fk_indexes.sql
-- Description: Adds B-Tree indexes on high-traffic foreign keys to accelerate joins and RLS evaluations.

-- 1. Project Role Foreign Keys (Core RBAC & Directory Filters)
CREATE INDEX IF NOT EXISTS idx_proyectos_cliente_id
  ON public.proyectos(cliente_id)
  WHERE cliente_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_epcista_id
  ON public.proyectos(epcista_id)
  WHERE epcista_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_financiero_id
  ON public.proyectos(financiero_id)
  WHERE financiero_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_finder_id
  ON public.proyectos(finder_id)
  WHERE finder_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_proyectos_responsable_nodo_id
  ON public.proyectos(responsable_nodo_id)
  WHERE responsable_nodo_id IS NOT NULL;

-- 2. Physical Site Associations
CREATE INDEX IF NOT EXISTS idx_sitios_cliente_id
  ON public.sitios(cliente_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_proyecto_id
  ON public.proyecto_sitios(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_proyecto_sitios_sitio_id
  ON public.proyecto_sitios(sitio_id);

-- 3. Technical Configurations & Financial Options Junctions
CREATE INDEX IF NOT EXISTS idx_configuraciones_tecnicas_proyecto_id
  ON public.configuraciones_tecnicas(proyecto_id);

CREATE INDEX IF NOT EXISTS idx_opciones_financiamiento_proyecto_id
  ON public.opciones_financiamiento(proyecto_id);
