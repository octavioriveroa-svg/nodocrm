-- =============================================
-- MIGRATION: V13 — Fix legacy admin roles
-- =============================================

-- Re-assign any users that have 'admin' directly stored in the database 
-- to the correct and typed 'nodo_admin' role.

UPDATE public.profiles
SET rol = 'nodo_admin'
WHERE rol = 'admin';
