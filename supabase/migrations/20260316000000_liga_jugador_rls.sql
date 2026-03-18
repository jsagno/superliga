-- =============================================================================
-- Liga Jugador: Row Level Security policies
-- Sections 11.1–11.5 of the liga-jugador implementation plan
--
-- Strategy:
--   • ADMIN-role users (liga-admin app) → full access on all restricted tables
--   • PLAYER-role users (liga-jugador portal) → scoped to their own data only
--   • service_role bypasses RLS by default (cron jobs, migrations)
--
-- Helper functions are SECURITY DEFINER so they can read app_user regardless
-- of the caller's RLS context.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper functions
-- ---------------------------------------------------------------------------

-- Returns the current authenticated user's internal role ('ADMIN' | 'PLAYER')
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT role
  FROM public.app_user
  WHERE auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- Returns the player_id linked to the current authenticated user
CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT aup.player_id
  FROM public.app_user_player aup
  JOIN public.app_user au ON au.app_user_id = aup.app_user_id
  WHERE au.auth_user_id = auth.uid()
  LIMIT 1;
$$;

-- ---------------------------------------------------------------------------
-- 2. app_user  — user can only read their own account row
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_user ENABLE ROW LEVEL SECURITY;

-- SELECT: own row only
CREATE POLICY app_user_select_own ON public.app_user
  FOR SELECT
  TO authenticated
  USING (auth_user_id = auth.uid());

-- Admin full access
CREATE POLICY app_user_admin_all ON public.app_user
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- Service-role access (cron / migrations); redundant since service_role bypasses
-- RLS but kept explicit for documentation purposes.
CREATE POLICY app_user_service_all ON public.app_user
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3. app_user_player  — user can only read their own player link
-- ---------------------------------------------------------------------------

ALTER TABLE public.app_user_player ENABLE ROW LEVEL SECURITY;

CREATE POLICY aup_select_own ON public.app_user_player
  FOR SELECT
  TO authenticated
  USING (
    app_user_id = (
      SELECT app_user_id FROM public.app_user WHERE auth_user_id = auth.uid() LIMIT 1
    )
  );

CREATE POLICY aup_admin_all ON public.app_user_player
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

CREATE POLICY aup_service_all ON public.app_user_player
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4. player  — own player + rivals in shared matches (so rival names show up)
-- ---------------------------------------------------------------------------

ALTER TABLE public.player ENABLE ROW LEVEL SECURITY;

CREATE POLICY player_select_own_and_rivals ON public.player
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR player_id = public.current_player_id()
    OR player_id IN (
      -- rivals: the "other" player in any scheduled_match the current player is in
      SELECT CASE
        WHEN sm.player_a_id = public.current_player_id() THEN sm.player_b_id
        ELSE sm.player_a_id
      END
      FROM public.scheduled_match sm
      WHERE sm.player_a_id = public.current_player_id()
         OR sm.player_b_id = public.current_player_id()
    )
  );

CREATE POLICY player_admin_all ON public.player
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

CREATE POLICY player_service_all ON public.player
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5. scheduled_match  — read where player participates; update towards LINKED
-- ---------------------------------------------------------------------------

ALTER TABLE public.scheduled_match ENABLE ROW LEVEL SECURITY;

-- SELECT: admin sees all; player sees own matches
CREATE POLICY sm_select ON public.scheduled_match
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR player_a_id = public.current_player_id()
    OR player_b_id = public.current_player_id()
  );

-- UPDATE: player can update their own matches (status transition handled in app code)
CREATE POLICY sm_update ON public.scheduled_match
  FOR UPDATE
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR player_a_id = public.current_player_id()
    OR player_b_id = public.current_player_id()
  )
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR player_a_id = public.current_player_id()
    OR player_b_id = public.current_player_id()
  );

-- INSERT/DELETE: admin and service_role only
CREATE POLICY sm_insert_admin ON public.scheduled_match
  FOR INSERT
  TO authenticated
  WITH CHECK (public.current_user_role() = 'ADMIN');

CREATE POLICY sm_delete_admin ON public.scheduled_match
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'ADMIN');

CREATE POLICY sm_service_all ON public.scheduled_match
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6. scheduled_match_battle_link  — read if match is own; insert if match is own
-- ---------------------------------------------------------------------------

ALTER TABLE public.scheduled_match_battle_link ENABLE ROW LEVEL SECURITY;

-- Helper: true if current player participates in the given scheduled_match
CREATE OR REPLACE FUNCTION public.player_participates_in_match(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.scheduled_match
    WHERE scheduled_match_id = p_match_id
      AND (player_a_id = public.current_player_id() OR player_b_id = public.current_player_id())
  );
$$;

CREATE POLICY smbl_select ON public.scheduled_match_battle_link
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR public.player_participates_in_match(scheduled_match_id)
  );

CREATE POLICY smbl_insert ON public.scheduled_match_battle_link
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.current_user_role() = 'ADMIN'
    OR public.player_participates_in_match(scheduled_match_id)
  );

CREATE POLICY smbl_delete_admin ON public.scheduled_match_battle_link
  FOR DELETE
  TO authenticated
  USING (public.current_user_role() = 'ADMIN');

CREATE POLICY smbl_service_all ON public.scheduled_match_battle_link
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 7. scheduled_match_result  — read if match is own
-- ---------------------------------------------------------------------------

ALTER TABLE public.scheduled_match_result ENABLE ROW LEVEL SECURITY;

CREATE POLICY smr_select ON public.scheduled_match_result
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR public.player_participates_in_match(scheduled_match_id)
  );

CREATE POLICY smr_write_admin ON public.scheduled_match_result
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

CREATE POLICY smr_service_all ON public.scheduled_match_result
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 8. battle  — read battles linked to player's matches
-- ---------------------------------------------------------------------------

ALTER TABLE public.battle ENABLE ROW LEVEL SECURITY;

CREATE POLICY battle_select ON public.battle
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR battle_id IN (
      SELECT smbl.battle_id
      FROM public.scheduled_match_battle_link smbl
      JOIN public.scheduled_match sm ON sm.scheduled_match_id = smbl.scheduled_match_id
      WHERE sm.player_a_id = public.current_player_id()
         OR sm.player_b_id = public.current_player_id()
    )
  );

CREATE POLICY battle_write_service ON public.battle
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY battle_write_admin ON public.battle
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 9. battle_round  — same as battle
-- ---------------------------------------------------------------------------

ALTER TABLE public.battle_round ENABLE ROW LEVEL SECURITY;

CREATE POLICY battle_round_select ON public.battle_round
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR battle_id IN (
      SELECT smbl.battle_id
      FROM public.scheduled_match_battle_link smbl
      JOIN public.scheduled_match sm ON sm.scheduled_match_id = smbl.scheduled_match_id
      WHERE sm.player_a_id = public.current_player_id()
         OR sm.player_b_id = public.current_player_id()
    )
  );

CREATE POLICY battle_round_write_service ON public.battle_round
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY battle_round_write_admin ON public.battle_round
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 10. battle_round_player  — same as battle_round
-- ---------------------------------------------------------------------------

ALTER TABLE public.battle_round_player ENABLE ROW LEVEL SECURITY;

CREATE POLICY brp_select ON public.battle_round_player
  FOR SELECT
  TO authenticated
  USING (
    public.current_user_role() = 'ADMIN'
    OR battle_id IN (
      SELECT smbl.battle_id
      FROM public.scheduled_match_battle_link smbl
      JOIN public.scheduled_match sm ON sm.scheduled_match_id = smbl.scheduled_match_id
      WHERE sm.player_a_id = public.current_player_id()
         OR sm.player_b_id = public.current_player_id()
    )
  );

CREATE POLICY brp_write_service ON public.battle_round_player
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY brp_write_admin ON public.battle_round_player
  FOR ALL
  TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');

-- ---------------------------------------------------------------------------
-- 11. Public lookup tables: season, competition, card  — all authenticated can read
--     (needed by both liga-admin and liga-jugador; no sensitive data)
-- ---------------------------------------------------------------------------

-- season
ALTER TABLE public.season ENABLE ROW LEVEL SECURITY;
CREATE POLICY season_read_authenticated ON public.season
  FOR SELECT TO authenticated USING (true);
CREATE POLICY season_write_admin ON public.season
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');
CREATE POLICY season_service_all ON public.season
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- competition
ALTER TABLE public.competition ENABLE ROW LEVEL SECURITY;
CREATE POLICY competition_read_authenticated ON public.competition
  FOR SELECT TO authenticated USING (true);
CREATE POLICY competition_write_admin ON public.competition
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');
CREATE POLICY competition_service_all ON public.competition
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- card
ALTER TABLE public.card ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_read_authenticated ON public.card
  FOR SELECT TO authenticated USING (true);
CREATE POLICY card_write_admin ON public.card
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'ADMIN')
  WITH CHECK (public.current_user_role() = 'ADMIN');
CREATE POLICY card_service_all ON public.card
  FOR ALL TO service_role USING (true) WITH CHECK (true);
