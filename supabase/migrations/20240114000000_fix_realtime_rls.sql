-- ─────────────────────────────────────────────────────────────────────────────
-- WinCup — Migration: Fix Realtime RLS Policy Recursion
--
-- Replaces recursive RLS policies with a centralized, high-performance
-- SECURITY DEFINER function to evaluate room membership. This breaks the
-- infinite recursion in players table checks, allowing Supabase Realtime
-- to broadcast events to subscribed clients without silent drops.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Create a security definer helper function to check membership safely
CREATE OR REPLACE FUNCTION public.check_room_membership(room_id_param uuid, user_id_param uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.players
    WHERE room_id = room_id_param
      AND user_id = user_id_param
  ) OR EXISTS (
    SELECT 1
    FROM public.rooms
    WHERE id = room_id_param
      AND host_user_id = user_id_param
  );
END;
$$;

-- Revoke default execution privilege from PUBLIC (Security Best Practice)
REVOKE EXECUTE ON FUNCTION public.check_room_membership(uuid, uuid) FROM PUBLIC;

-- Explicitly grant execute privileges to the authenticated and service_role roles
GRANT EXECUTE ON FUNCTION public.check_room_membership(uuid, uuid) TO authenticated, service_role;

-- 2. Drop and recreate the players read policy
DROP POLICY IF EXISTS "players_read_room_members" ON public.players;
CREATE POLICY "players_read_room_members" ON public.players
  FOR SELECT
  TO authenticated
  USING (
    public.check_room_membership(room_id, auth.uid())
  );

-- 3. Drop and recreate the room_messages read policy
DROP POLICY IF EXISTS "room_messages_read_members" ON public.room_messages;
CREATE POLICY "room_messages_read_members" ON public.room_messages
  FOR SELECT
  TO authenticated
  USING (
    public.check_room_membership(room_id, auth.uid())
  );

-- 4. Recreate policies for other tables checking room membership to prevent secondary recursion issues
DROP POLICY IF EXISTS "room_countries_read_members" ON public.room_countries;
CREATE POLICY "room_countries_read_members" ON public.room_countries
  FOR SELECT
  TO authenticated
  USING (
    public.check_room_membership(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "room_teams_read_members" ON public.room_teams;
CREATE POLICY "room_teams_read_members" ON public.room_teams
  FOR SELECT
  TO authenticated
  USING (
    public.check_room_membership(room_id, auth.uid())
  );

DROP POLICY IF EXISTS "matches_read_members" ON public.matches;
CREATE POLICY "matches_read_members" ON public.matches
  FOR SELECT
  TO authenticated
  USING (
    public.check_room_membership(room_id, auth.uid())
  );
