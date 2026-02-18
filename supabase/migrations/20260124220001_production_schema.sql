


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date" DEFAULT CURRENT_DATE) RETURNS TABLE("active_count" integer, "exceeds_limit" boolean, "players" "jsonb")
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INT as active_count,
    COUNT(*) > 8 as exceeds_limit,
    jsonb_agg(
      jsonb_build_object(
        'player_id', sztp.player_id,
        'player_nick', p.nick,
        'player_name', p.name,
        'jersey_no', sztp.jersey_no,
        'start_date', sztp.start_date,
        'end_date', sztp.end_date
      )
    ) as players
  FROM season_zone_team_player sztp
  JOIN player p ON sztp.player_id = p.player_id
  WHERE sztp.team_id = p_team_id
    AND sztp.zone_id = p_zone_id
    AND (sztp.start_date IS NULL OR sztp.start_date <= p_check_date)
    AND (sztp.end_date IS NULL OR sztp.end_date >= p_check_date)
  GROUP BY sztp.team_id, sztp.zone_id;
END;
$$;


ALTER FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date") OWNER TO "postgres";


COMMENT ON FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date") IS 'Returns the count of active players for a team at a given date and whether it exceeds 8';



CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end $$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."tg_set_last_edited_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.last_edited_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."tg_set_last_edited_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_extreme_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_extreme_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."player" (
    "player_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "nick" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_internal" boolean DEFAULT false NOT NULL,
    "last_seen_at" timestamp with time zone
);


ALTER TABLE "public"."player" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season" (
    "season_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "era_id" "uuid" NOT NULL,
    "description" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "duel_start_date" "date",
    "ladder_start_date" "date",
    "season_start_at" timestamp with time zone,
    "season_end_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "season_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."season" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_extreme_participant" (
    "season_extreme_participant_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "participant_type" character varying(20) NOT NULL,
    "start_date" "date" NOT NULL,
    "end_date" "date",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "season_extreme_participant_participant_type_check" CHECK ((("participant_type")::"text" = ANY ((ARRAY['EXTREMER'::character varying, 'RISKY'::character varying])::"text"[]))),
    CONSTRAINT "valid_date_range" CHECK ((("end_date" IS NULL) OR ("end_date" >= "start_date")))
);


ALTER TABLE "public"."season_extreme_participant" OWNER TO "postgres";


COMMENT ON TABLE "public"."season_extreme_participant" IS 'Participantes Extremer (1 por equipo) y Risky (hasta 2 por equipo) por temporada';



COMMENT ON COLUMN "public"."season_extreme_participant"."participant_type" IS 'EXTREMER: debe usar el mazo en 2-3 rondas. RISKY: mazo menos restrictivo en 1-2 rondas';



COMMENT ON COLUMN "public"."season_extreme_participant"."start_date" IS 'Fecha desde la cual el participante está activo';



COMMENT ON COLUMN "public"."season_extreme_participant"."end_date" IS 'Fecha hasta la cual el participante está activo (NULL = indefinido)';



CREATE TABLE IF NOT EXISTS "public"."team" (
    "team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "logo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."active_extreme_participants" AS
 SELECT "sep"."season_extreme_participant_id",
    "sep"."season_id",
    "sep"."team_id",
    "sep"."player_id",
    "sep"."participant_type",
    "sep"."start_date",
    "sep"."end_date",
    "sep"."created_at",
    "sep"."updated_at",
    "s"."description" AS "season_name",
    "t"."name" AS "team_name",
    "p"."nick" AS "player_nick",
    "p"."name" AS "player_name"
   FROM ((("public"."season_extreme_participant" "sep"
     JOIN "public"."season" "s" ON (("sep"."season_id" = "s"."season_id")))
     JOIN "public"."team" "t" ON (("sep"."team_id" = "t"."team_id")))
     JOIN "public"."player" "p" ON (("sep"."player_id" = "p"."player_id")))
  WHERE (("sep"."start_date" <= CURRENT_DATE) AND (("sep"."end_date" IS NULL) OR ("sep"."end_date" >= CURRENT_DATE)));


ALTER VIEW "public"."active_extreme_participants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_user" (
    "id" "uuid" NOT NULL,
    "email" "text",
    "full_name" "text",
    "role" "text" DEFAULT 'PLAYER'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_user_role_check" CHECK (("role" = ANY (ARRAY['PLAYER'::"text", 'ADMIN'::"text"])))
);


ALTER TABLE "public"."app_user" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."app_user_player" (
    "user_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."app_user_player" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battle" (
    "battle_id" "uuid" NOT NULL,
    "battle_time" timestamp with time zone NOT NULL,
    "api_battle_type" "text" NOT NULL,
    "api_game_mode" "text",
    "team_size" integer DEFAULT 1 NOT NULL,
    "round_count" integer DEFAULT 1 NOT NULL,
    "sync_status" "text" DEFAULT 'OK'::"text" NOT NULL,
    "needs_refresh" boolean DEFAULT false NOT NULL,
    "refresh_attempts" integer DEFAULT 0 NOT NULL,
    "last_refresh_at" timestamp with time zone,
    "data_quality" "jsonb",
    "raw_payload" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "battle_sync_status_check" CHECK (("sync_status" = ANY (ARRAY['OK'::"text", 'INCOMPLETE'::"text", 'REPAIR_QUEUED'::"text", 'REPAIRED'::"text", 'GIVE_UP'::"text"])))
);


ALTER TABLE "public"."battle" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battle_round" (
    "battle_round_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "round_no" integer NOT NULL
);


ALTER TABLE "public"."battle_round" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."battle_round_player" (
    "battle_round_player_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "battle_round_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "side" "text" NOT NULL,
    "crowns" integer DEFAULT 0 NOT NULL,
    "deck_cards" "jsonb" NOT NULL,
    "elixir_avg" numeric(4,2),
    "opponent" "jsonb",
    "opponent_crowns" integer,
    CONSTRAINT "battle_round_player_side_check" CHECK (("side" = ANY (ARRAY['TEAM'::"text", 'OPPONENT'::"text"])))
);


ALTER TABLE "public"."battle_round_player" OWNER TO "postgres";


COMMENT ON COLUMN "public"."battle_round_player"."opponent_crowns" IS 'Crown count for unregistered opponents in this round';



CREATE TABLE IF NOT EXISTS "public"."card" (
    "card_id" bigint NOT NULL,
    "name" "text" NOT NULL,
    "raw_payload" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."card" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competition" (
    "competition_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    "logo" "text",
    CONSTRAINT "competition_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."competition" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competition_group" (
    "competition_group_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_stage_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "name" "text" NOT NULL
);


ALTER TABLE "public"."competition_group" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."competition_stage" (
    "competition_stage_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "stage_order" integer NOT NULL,
    "status" "text" DEFAULT 'DRAFT'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "closed_at" timestamp with time zone,
    CONSTRAINT "competition_stage_status_check" CHECK (("status" = ANY (ARRAY['DRAFT'::"text", 'ACTIVE'::"text", 'CLOSED'::"text"])))
);


ALTER TABLE "public"."competition_stage" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."era" (
    "era_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "description" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."era" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job_run" (
    "job_run_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "job_name" "text" NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "error_type" "text",
    "error_message" "text",
    "meta" "jsonb"
);


ALTER TABLE "public"."job_run" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_home_snapshot" (
    "season_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "data" "jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."player_home_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_identity" (
    "player_identity_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "player_id" "uuid" NOT NULL,
    "player_tag" "text" NOT NULL,
    "valid_from" timestamp with time zone DEFAULT "now"() NOT NULL,
    "valid_to" timestamp with time zone
);


ALTER TABLE "public"."player_identity" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."player_standings_snapshot" (
    "season_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "scope" "text" NOT NULL,
    "league" "text" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "points_total" integer NOT NULL,
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "ranking_seed" integer,
    "delta_position" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "player_standings_snapshot_scope_check" CHECK (("scope" = ANY (ARRAY['ZONE'::"text", 'LEAGUE'::"text"])))
);


ALTER TABLE "public"."player_standings_snapshot" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."points_ledger" (
    "points_ledger_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scope" "text" NOT NULL,
    "season_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "player_id" "uuid",
    "team_id" "uuid",
    "source_type" "text" NOT NULL,
    "source_id" "uuid" NOT NULL,
    "sub_key" "text" DEFAULT 'default'::"text" NOT NULL,
    "points" integer NOT NULL,
    "is_reversal" boolean DEFAULT false NOT NULL,
    "reversed_ledger_id" "uuid",
    "notes" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "generated_run_id" "uuid",
    "source_hash" "text",
    CONSTRAINT "chk_reversal_ref" CHECK (((("is_reversal" = false) AND ("reversed_ledger_id" IS NULL)) OR (("is_reversal" = true) AND ("reversed_ledger_id" IS NOT NULL)))),
    CONSTRAINT "chk_scope_entity" CHECK (((("scope" = 'PLAYER'::"text") AND ("player_id" IS NOT NULL) AND ("team_id" IS NULL)) OR (("scope" = 'TEAM'::"text") AND ("team_id" IS NOT NULL) AND ("player_id" IS NULL)))),
    CONSTRAINT "points_ledger_scope_check" CHECK (("scope" = ANY (ARRAY['PLAYER'::"text", 'TEAM'::"text"])))
);


ALTER TABLE "public"."points_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_match" (
    "scheduled_match_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "competition_id" "uuid",
    "competition_stage_id" "uuid",
    "competition_group_id" "uuid",
    "type" "text" NOT NULL,
    "stage" "text",
    "best_of" integer NOT NULL,
    "expected_team_size" integer DEFAULT 1 NOT NULL,
    "player_a_id" "uuid" NOT NULL,
    "player_b_id" "uuid",
    "day_no" integer,
    "scheduled_from" timestamp with time zone,
    "scheduled_to" timestamp with time zone,
    "deadline_at" timestamp with time zone,
    "status" "text" DEFAULT 'PENDING'::"text" NOT NULL,
    "score_a" integer,
    "score_b" integer,
    "result_overridden" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "scheduled_match_status_check" CHECK (("status" = ANY (ARRAY['PENDING'::"text", 'LINKED'::"text", 'CONFIRMED'::"text", 'OVERRIDDEN'::"text"])))
);


ALTER TABLE "public"."scheduled_match" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_match_battle_link" (
    "scheduled_match_battle_link_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "scheduled_match_id" "uuid" NOT NULL,
    "battle_id" "uuid" NOT NULL,
    "linked_by_player" "uuid",
    "linked_by_admin" "uuid",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."scheduled_match_battle_link" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."scheduled_match_result" (
    "scheduled_match_id" "uuid" NOT NULL,
    "final_score_a" integer NOT NULL,
    "final_score_b" integer NOT NULL,
    "decided_by" "text" NOT NULL,
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "points_a" integer,
    "points_b" integer,
    CONSTRAINT "scheduled_match_result_decided_by_check" CHECK (("decided_by" = ANY (ARRAY['AUTO'::"text", 'ADMIN'::"text"])))
);


ALTER TABLE "public"."scheduled_match_result" OWNER TO "postgres";


COMMENT ON COLUMN "public"."scheduled_match_result"."points_a" IS 'Puntos ganados por jugador A según points_schema de la configuración';



COMMENT ON COLUMN "public"."scheduled_match_result"."points_b" IS 'Puntos ganados por jugador B según points_schema de la configuración';



CREATE TABLE IF NOT EXISTS "public"."season_competition_config" (
    "season_competition_config_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "competition_id" "uuid" NOT NULL,
    "stage" "text" NOT NULL,
    "api_battle_type" "text" NOT NULL,
    "api_game_mode" "text" NOT NULL,
    "best_of" integer NOT NULL,
    "points_schema" "jsonb" DEFAULT "jsonb_build_object"('2-0', 4, '2-1', 3, '1-2', 1, '0-2', 0) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "season_competition_config_best_of_check" CHECK (("best_of" = ANY (ARRAY[3, 5]))),
    CONSTRAINT "season_competition_config_stage_check" CHECK (("stage" = ANY (ARRAY['CUP_QUALY'::"text", 'CUP_GROUP'::"text", 'CUP_SEMI'::"text", 'CUP_FINAL'::"text"])))
);


ALTER TABLE "public"."season_competition_config" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_competition_group_member" (
    "competition_group_member_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "competition_group_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "season_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL
);


ALTER TABLE "public"."season_competition_group_member" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_extreme_config" (
    "season_extreme_config_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "extreme_deck_cards" "jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."season_extreme_config" OWNER TO "postgres";


COMMENT ON TABLE "public"."season_extreme_config" IS 'Configuración del mazo extreme (8 cartas) por temporada';



COMMENT ON COLUMN "public"."season_extreme_config"."extreme_deck_cards" IS 'Array JSON de 8 card_ids que conforman el mazo extreme';



CREATE TABLE IF NOT EXISTS "public"."season_zone" (
    "zone_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "season_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "zone_order" integer DEFAULT 1 NOT NULL,
    "is_dirty_points" boolean DEFAULT false NOT NULL,
    "is_dirty_standings" boolean DEFAULT false NOT NULL,
    "last_snapshot_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."season_zone" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_zone_team" (
    "season_zone_team_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "team_order" integer DEFAULT 1 NOT NULL
);


ALTER TABLE "public"."season_zone_team" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."season_zone_team_player" (
    "season_zone_team_player_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "player_id" "uuid" NOT NULL,
    "jersey_no" integer NOT NULL,
    "is_captain" boolean DEFAULT false NOT NULL,
    "league" "text" NOT NULL,
    "ranking_seed" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "start_date" "date",
    "end_date" "date",
    CONSTRAINT "check_start_end_dates" CHECK ((("end_date" IS NULL) OR ("start_date" IS NULL) OR ("end_date" >= "start_date"))),
    CONSTRAINT "season_zone_team_player_jersey_no_check" CHECK ((("jersey_no" >= 1) AND ("jersey_no" <= 8))),
    CONSTRAINT "season_zone_team_player_league_check" CHECK (("league" = ANY (ARRAY['A'::"text", 'B'::"text"]))),
    CONSTRAINT "season_zone_team_player_ranking_seed_check" CHECK (("ranking_seed" >= 1))
);


ALTER TABLE "public"."season_zone_team_player" OWNER TO "postgres";


COMMENT ON COLUMN "public"."season_zone_team_player"."start_date" IS 'Fecha de inicio del jugador en el equipo para esta temporada';



COMMENT ON COLUMN "public"."season_zone_team_player"."end_date" IS 'Fecha de fin del jugador en el equipo (NULL = activo)';



CREATE TABLE IF NOT EXISTS "public"."team_standings_snapshot" (
    "season_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "team_id" "uuid" NOT NULL,
    "position" integer NOT NULL,
    "points_total" integer NOT NULL,
    "wins" integer DEFAULT 0 NOT NULL,
    "losses" integer DEFAULT 0 NOT NULL,
    "delta_position" integer DEFAULT 0 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."team_standings_snapshot" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_active_team_players" AS
 SELECT "sztp"."season_zone_team_player_id",
    "sztp"."zone_id",
    "sztp"."team_id",
    "sztp"."player_id",
    "sztp"."jersey_no",
    "sztp"."is_captain",
    "sztp"."league",
    "sztp"."ranking_seed",
    "sztp"."created_at",
    "sztp"."start_date",
    "sztp"."end_date",
    "p"."name" AS "player_name",
    "p"."nick" AS "player_nick",
    "t"."name" AS "team_name"
   FROM (("public"."season_zone_team_player" "sztp"
     JOIN "public"."player" "p" ON (("sztp"."player_id" = "p"."player_id")))
     JOIN "public"."team" "t" ON (("sztp"."team_id" = "t"."team_id")))
  WHERE ((("sztp"."start_date" IS NULL) OR ("sztp"."start_date" <= CURRENT_DATE)) AND (("sztp"."end_date" IS NULL) OR ("sztp"."end_date" >= CURRENT_DATE)));


ALTER VIEW "public"."v_active_team_players" OWNER TO "postgres";


COMMENT ON VIEW "public"."v_active_team_players" IS 'Shows currently active players in teams (based on start_date and end_date)';



CREATE OR REPLACE VIEW "public"."v_player_current_tag" AS
 SELECT DISTINCT ON ("player_id") "player_id",
    "player_tag",
    "valid_from"
   FROM "public"."player_identity" "pi"
  WHERE ("valid_to" IS NULL)
  ORDER BY "player_id", "valid_from" DESC;


ALTER VIEW "public"."v_player_current_tag" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_player_points" AS
 SELECT "season_id",
    "zone_id",
    "player_id",
    ("sum"("points"))::integer AS "points_total"
   FROM "public"."points_ledger"
  WHERE ("scope" = 'PLAYER'::"text")
  GROUP BY "season_id", "zone_id", "player_id";


ALTER VIEW "public"."v_player_points" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_player_wl" AS
 SELECT "season_id",
    "zone_id",
    "player_id",
    ("sum"(
        CASE
            WHEN "is_win" THEN 1
            ELSE 0
        END))::integer AS "wins",
    ("sum"(
        CASE
            WHEN "is_loss" THEN 1
            ELSE 0
        END))::integer AS "losses"
   FROM ( SELECT "sm"."season_id",
            "sm"."zone_id",
            "sm"."player_a_id" AS "player_id",
            ("smr"."final_score_a" > "smr"."final_score_b") AS "is_win",
            ("smr"."final_score_a" < "smr"."final_score_b") AS "is_loss"
           FROM ("public"."scheduled_match" "sm"
             JOIN "public"."scheduled_match_result" "smr" ON (("smr"."scheduled_match_id" = "sm"."scheduled_match_id")))
          WHERE ("sm"."status" = ANY (ARRAY['CONFIRMED'::"text", 'OVERRIDDEN'::"text"]))
        UNION ALL
         SELECT "sm"."season_id",
            "sm"."zone_id",
            "sm"."player_b_id" AS "player_id",
            ("smr"."final_score_b" > "smr"."final_score_a") AS "is_win",
            ("smr"."final_score_b" < "smr"."final_score_a") AS "is_loss"
           FROM ("public"."scheduled_match" "sm"
             JOIN "public"."scheduled_match_result" "smr" ON (("smr"."scheduled_match_id" = "sm"."scheduled_match_id")))
          WHERE ("sm"."status" = ANY (ARRAY['CONFIRMED'::"text", 'OVERRIDDEN'::"text"]))) "x"
  GROUP BY "season_id", "zone_id", "player_id";


ALTER VIEW "public"."v_player_wl" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_season_zone_player" AS
 SELECT "sz"."season_id",
    "sz"."zone_id",
    "sztp"."player_id",
    "sztp"."team_id",
    "sztp"."league",
    "sztp"."is_captain",
    "sztp"."jersey_no",
    "sztp"."ranking_seed",
    "p"."nick",
    "p"."name",
    "t"."name" AS "team_name",
    "t"."logo" AS "team_logo"
   FROM ((("public"."season_zone" "sz"
     JOIN "public"."season_zone_team_player" "sztp" ON (("sztp"."zone_id" = "sz"."zone_id")))
     JOIN "public"."player" "p" ON (("p"."player_id" = "sztp"."player_id")))
     JOIN "public"."team" "t" ON (("t"."team_id" = "sztp"."team_id")));


ALTER VIEW "public"."v_season_zone_player" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_player_standings_source" AS
 SELECT "v"."season_id",
    "v"."zone_id",
    "v"."player_id",
    "v"."nick",
    "v"."name",
    "v"."team_id",
    "v"."team_name",
    "v"."team_logo",
    "v"."league",
    COALESCE("pp"."points_total", 0) AS "points_total",
    COALESCE("wl"."wins", 0) AS "wins",
    COALESCE("wl"."losses", 0) AS "losses",
    "v"."ranking_seed"
   FROM (("public"."v_season_zone_player" "v"
     LEFT JOIN "public"."v_player_points" "pp" ON ((("pp"."season_id" = "v"."season_id") AND ("pp"."zone_id" = "v"."zone_id") AND ("pp"."player_id" = "v"."player_id"))))
     LEFT JOIN "public"."v_player_wl" "wl" ON ((("wl"."season_id" = "v"."season_id") AND ("wl"."zone_id" = "v"."zone_id") AND ("wl"."player_id" = "v"."player_id"))));


ALTER VIEW "public"."v_player_standings_source" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."v_team_points" AS
 SELECT "season_id",
    "zone_id",
    "team_id",
    ("sum"("points"))::integer AS "points_total"
   FROM "public"."points_ledger"
  WHERE ("scope" = 'TEAM'::"text")
  GROUP BY "season_id", "zone_id", "team_id";


ALTER VIEW "public"."v_team_points" OWNER TO "postgres";


ALTER TABLE ONLY "public"."app_user"
    ADD CONSTRAINT "app_user_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."app_user_player"
    ADD CONSTRAINT "app_user_player_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."battle"
    ADD CONSTRAINT "battle_pkey" PRIMARY KEY ("battle_id");



ALTER TABLE ONLY "public"."battle_round"
    ADD CONSTRAINT "battle_round_battle_id_round_no_key" UNIQUE ("battle_id", "round_no");



ALTER TABLE ONLY "public"."battle_round"
    ADD CONSTRAINT "battle_round_pkey" PRIMARY KEY ("battle_round_id");



ALTER TABLE ONLY "public"."battle_round_player"
    ADD CONSTRAINT "battle_round_player_battle_round_id_player_id_key" UNIQUE ("battle_round_id", "player_id");



ALTER TABLE ONLY "public"."battle_round_player"
    ADD CONSTRAINT "battle_round_player_pkey" PRIMARY KEY ("battle_round_player_id");



ALTER TABLE ONLY "public"."card"
    ADD CONSTRAINT "card_pkey" PRIMARY KEY ("card_id");



ALTER TABLE ONLY "public"."competition_group"
    ADD CONSTRAINT "competition_group_competition_stage_id_code_key" UNIQUE ("competition_stage_id", "code");



ALTER TABLE ONLY "public"."season_competition_group_member"
    ADD CONSTRAINT "competition_group_member_competition_group_id_player_id_key" UNIQUE ("competition_group_id", "player_id");



ALTER TABLE ONLY "public"."season_competition_group_member"
    ADD CONSTRAINT "competition_group_member_pkey" PRIMARY KEY ("competition_group_member_id");



ALTER TABLE ONLY "public"."competition_group"
    ADD CONSTRAINT "competition_group_pkey" PRIMARY KEY ("competition_group_id");



ALTER TABLE ONLY "public"."competition"
    ADD CONSTRAINT "competition_pkey" PRIMARY KEY ("competition_id");



ALTER TABLE ONLY "public"."competition_stage"
    ADD CONSTRAINT "competition_stage_competition_id_stage_key" UNIQUE ("competition_id", "stage");



ALTER TABLE ONLY "public"."competition_stage"
    ADD CONSTRAINT "competition_stage_pkey" PRIMARY KEY ("competition_stage_id");



ALTER TABLE ONLY "public"."era"
    ADD CONSTRAINT "era_pkey" PRIMARY KEY ("era_id");



ALTER TABLE ONLY "public"."job_run"
    ADD CONSTRAINT "job_run_pkey" PRIMARY KEY ("job_run_id");



ALTER TABLE ONLY "public"."player_home_snapshot"
    ADD CONSTRAINT "player_home_snapshot_pkey" PRIMARY KEY ("season_id", "zone_id", "player_id");



ALTER TABLE ONLY "public"."player_identity"
    ADD CONSTRAINT "player_identity_pkey" PRIMARY KEY ("player_identity_id");



ALTER TABLE ONLY "public"."player_identity"
    ADD CONSTRAINT "player_identity_player_tag_valid_to_key" UNIQUE ("player_tag", "valid_to");



ALTER TABLE ONLY "public"."player"
    ADD CONSTRAINT "player_nick_key" UNIQUE ("nick");



ALTER TABLE ONLY "public"."player"
    ADD CONSTRAINT "player_pkey" PRIMARY KEY ("player_id");



ALTER TABLE ONLY "public"."player_standings_snapshot"
    ADD CONSTRAINT "player_standings_snapshot_pkey" PRIMARY KEY ("season_id", "zone_id", "scope", "league", "player_id");



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_pkey" PRIMARY KEY ("points_ledger_id");



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_pkey" PRIMARY KEY ("scheduled_match_battle_link_id");



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_scheduled_match_id_battle_id_key" UNIQUE ("scheduled_match_id", "battle_id");



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_pkey" PRIMARY KEY ("scheduled_match_id");



ALTER TABLE ONLY "public"."scheduled_match_result"
    ADD CONSTRAINT "scheduled_match_result_pkey" PRIMARY KEY ("scheduled_match_id");



ALTER TABLE ONLY "public"."season_competition_config"
    ADD CONSTRAINT "season_competition_config_pkey" PRIMARY KEY ("season_competition_config_id");



ALTER TABLE ONLY "public"."season_extreme_config"
    ADD CONSTRAINT "season_extreme_config_pkey" PRIMARY KEY ("season_extreme_config_id");



ALTER TABLE ONLY "public"."season_extreme_participant"
    ADD CONSTRAINT "season_extreme_participant_pkey" PRIMARY KEY ("season_extreme_participant_id");



ALTER TABLE ONLY "public"."season"
    ADD CONSTRAINT "season_pkey" PRIMARY KEY ("season_id");



ALTER TABLE ONLY "public"."season_zone"
    ADD CONSTRAINT "season_zone_pkey" PRIMARY KEY ("zone_id");



ALTER TABLE ONLY "public"."season_zone"
    ADD CONSTRAINT "season_zone_season_id_zone_order_key" UNIQUE ("season_id", "zone_order");



ALTER TABLE ONLY "public"."season_zone_team"
    ADD CONSTRAINT "season_zone_team_pkey" PRIMARY KEY ("season_zone_team_id");



ALTER TABLE ONLY "public"."season_zone_team_player"
    ADD CONSTRAINT "season_zone_team_player_pkey" PRIMARY KEY ("season_zone_team_player_id");



ALTER TABLE ONLY "public"."season_zone_team_player"
    ADD CONSTRAINT "season_zone_team_player_zone_id_player_id_key" UNIQUE ("zone_id", "player_id");



ALTER TABLE ONLY "public"."season_zone_team"
    ADD CONSTRAINT "season_zone_team_zone_id_team_id_key" UNIQUE ("zone_id", "team_id");



ALTER TABLE ONLY "public"."season_zone_team"
    ADD CONSTRAINT "season_zone_team_zone_id_team_order_key" UNIQUE ("zone_id", "team_order");



ALTER TABLE ONLY "public"."team"
    ADD CONSTRAINT "team_name_key" UNIQUE ("name");



ALTER TABLE ONLY "public"."team"
    ADD CONSTRAINT "team_pkey" PRIMARY KEY ("team_id");



ALTER TABLE ONLY "public"."team_standings_snapshot"
    ADD CONSTRAINT "team_standings_snapshot_pkey" PRIMARY KEY ("season_id", "zone_id", "team_id");



ALTER TABLE ONLY "public"."season_extreme_participant"
    ADD CONSTRAINT "unique_player_per_season" UNIQUE ("season_id", "player_id");



ALTER TABLE ONLY "public"."season_extreme_config"
    ADD CONSTRAINT "unique_season_extreme_config" UNIQUE ("season_id");



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "uq_battle_used_once" UNIQUE ("battle_id");



CREATE INDEX "idx_battle_refresh_queue" ON "public"."battle" USING "btree" ("needs_refresh", "last_refresh_at") WHERE ("needs_refresh" = true);



CREATE INDEX "idx_battle_round_battle" ON "public"."battle_round" USING "btree" ("battle_id", "round_no");



CREATE INDEX "idx_battle_time" ON "public"."battle" USING "btree" ("battle_time" DESC);



CREATE INDEX "idx_brp_player" ON "public"."battle_round_player" USING "btree" ("player_id");



CREATE INDEX "idx_brp_round" ON "public"."battle_round_player" USING "btree" ("battle_round_id");



CREATE INDEX "idx_card_name" ON "public"."card" USING "btree" ("name");



CREATE INDEX "idx_extreme_participant_dates" ON "public"."season_extreme_participant" USING "btree" ("start_date", "end_date");



CREATE INDEX "idx_extreme_participant_player" ON "public"."season_extreme_participant" USING "btree" ("player_id");



CREATE INDEX "idx_extreme_participant_season" ON "public"."season_extreme_participant" USING "btree" ("season_id");



CREATE INDEX "idx_extreme_participant_team" ON "public"."season_extreme_participant" USING "btree" ("team_id");



CREATE INDEX "idx_extreme_participant_type" ON "public"."season_extreme_participant" USING "btree" ("participant_type");



CREATE INDEX "idx_player_identity_active" ON "public"."player_identity" USING "btree" ("player_id") WHERE ("valid_to" IS NULL);



CREATE INDEX "idx_points_player" ON "public"."points_ledger" USING "btree" ("season_id", "zone_id", "player_id") WHERE ("scope" = 'PLAYER'::"text");



CREATE INDEX "idx_points_team" ON "public"."points_ledger" USING "btree" ("season_id", "zone_id", "team_id") WHERE ("scope" = 'TEAM'::"text");



CREATE INDEX "idx_season_status" ON "public"."season" USING "btree" ("status", "season_start_at");



CREATE INDEX "idx_sm_pending_a" ON "public"."scheduled_match" USING "btree" ("season_id", "zone_id", "status", "player_a_id");



CREATE INDEX "idx_sm_pending_b" ON "public"."scheduled_match" USING "btree" ("season_id", "zone_id", "status", "player_b_id");



CREATE INDEX "idx_smbl_battle" ON "public"."scheduled_match_battle_link" USING "btree" ("battle_id");



CREATE INDEX "idx_smbl_match" ON "public"."scheduled_match_battle_link" USING "btree" ("scheduled_match_id");



CREATE INDEX "idx_szt_zone" ON "public"."season_zone_team" USING "btree" ("zone_id", "team_order");



CREATE INDEX "idx_sztp_zone_league" ON "public"."season_zone_team_player" USING "btree" ("zone_id", "league");



CREATE INDEX "idx_sztp_zone_team" ON "public"."season_zone_team_player" USING "btree" ("zone_id", "team_id", "jersey_no");



CREATE INDEX "idx_zone_season" ON "public"."season_zone" USING "btree" ("season_id", "zone_order");



CREATE INDEX "ix_szmc_competition" ON "public"."season_competition_config" USING "btree" ("season_id", "competition_id");



CREATE INDEX "ix_szmc_zone" ON "public"."season_competition_config" USING "btree" ("season_competition_config_id");



CREATE UNIQUE INDEX "ux_one_captain_per_team_zone" ON "public"."season_zone_team_player" USING "btree" ("zone_id", "team_id") WHERE ("is_captain" = true);



CREATE UNIQUE INDEX "ux_points_ledger_idempotent" ON "public"."points_ledger" USING "btree" ("scope", "season_id", "zone_id", COALESCE("player_id", '00000000-0000-0000-0000-000000000000'::"uuid"), COALESCE("team_id", '00000000-0000-0000-0000-000000000000'::"uuid"), "source_type", "source_id", "sub_key") WHERE ("is_reversal" = false);



CREATE UNIQUE INDEX "ux_szmc_zone_comp_stage" ON "public"."season_competition_config" USING "btree" ("season_id", "competition_id", "stage");



CREATE OR REPLACE TRIGGER "card_set_updated_at" BEFORE UPDATE ON "public"."card" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "scheduled_match_set_updated_at" BEFORE UPDATE ON "public"."scheduled_match" FOR EACH ROW EXECUTE FUNCTION "public"."trg_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_set_last_edited_at" BEFORE UPDATE ON "public"."scheduled_match_battle_link" FOR EACH ROW EXECUTE FUNCTION "public"."tg_set_last_edited_at"();



CREATE OR REPLACE TRIGGER "trg_szmc_updated_at" BEFORE UPDATE ON "public"."season_competition_config" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_extreme_config_updated_at" BEFORE UPDATE ON "public"."season_extreme_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_extreme_updated_at"();



CREATE OR REPLACE TRIGGER "trigger_update_extreme_participant_updated_at" BEFORE UPDATE ON "public"."season_extreme_participant" FOR EACH ROW EXECUTE FUNCTION "public"."update_extreme_updated_at"();



ALTER TABLE ONLY "public"."app_user"
    ADD CONSTRAINT "app_user_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."app_user_player"
    ADD CONSTRAINT "app_user_player_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."app_user_player"
    ADD CONSTRAINT "app_user_player_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."app_user"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_round"
    ADD CONSTRAINT "battle_round_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("battle_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_round_player"
    ADD CONSTRAINT "battle_round_player_battle_round_id_fkey" FOREIGN KEY ("battle_round_id") REFERENCES "public"."battle_round"("battle_round_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."battle_round_player"
    ADD CONSTRAINT "battle_round_player_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."competition_group"
    ADD CONSTRAINT "competition_group_competition_stage_id_fkey" FOREIGN KEY ("competition_stage_id") REFERENCES "public"."competition_stage"("competition_stage_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_competition_group_member"
    ADD CONSTRAINT "competition_group_member_competition_group_id_fkey" FOREIGN KEY ("competition_group_id") REFERENCES "public"."competition_group"("competition_group_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_competition_group_member"
    ADD CONSTRAINT "competition_group_member_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."competition_stage"
    ADD CONSTRAINT "competition_stage_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("competition_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_home_snapshot"
    ADD CONSTRAINT "player_home_snapshot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_home_snapshot"
    ADD CONSTRAINT "player_home_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_home_snapshot"
    ADD CONSTRAINT "player_home_snapshot_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_identity"
    ADD CONSTRAINT "player_identity_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_standings_snapshot"
    ADD CONSTRAINT "player_standings_snapshot_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_standings_snapshot"
    ADD CONSTRAINT "player_standings_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."player_standings_snapshot"
    ADD CONSTRAINT "player_standings_snapshot_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."app_user"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_reversed_ledger_id_fkey" FOREIGN KEY ("reversed_ledger_id") REFERENCES "public"."points_ledger"("points_ledger_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."points_ledger"
    ADD CONSTRAINT "points_ledger_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_battle_id_fkey" FOREIGN KEY ("battle_id") REFERENCES "public"."battle"("battle_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_linked_by_admin_fkey" FOREIGN KEY ("linked_by_admin") REFERENCES "public"."app_user"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_linked_by_player_fkey" FOREIGN KEY ("linked_by_player") REFERENCES "public"."app_user"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_match_battle_link"
    ADD CONSTRAINT "scheduled_match_battle_link_scheduled_match_id_fkey" FOREIGN KEY ("scheduled_match_id") REFERENCES "public"."scheduled_match"("scheduled_match_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_competition_group_id_fkey" FOREIGN KEY ("competition_group_id") REFERENCES "public"."competition_group"("competition_group_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("competition_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_competition_stage_id_fkey" FOREIGN KEY ("competition_stage_id") REFERENCES "public"."competition_stage"("competition_stage_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_player_a_id_fkey" FOREIGN KEY ("player_a_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_player_b_id_fkey" FOREIGN KEY ("player_b_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."scheduled_match_result"
    ADD CONSTRAINT "scheduled_match_result_scheduled_match_id_fkey" FOREIGN KEY ("scheduled_match_id") REFERENCES "public"."scheduled_match"("scheduled_match_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."scheduled_match"
    ADD CONSTRAINT "scheduled_match_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_competition_config"
    ADD CONSTRAINT "season_competition_config_competition_id_fkey" FOREIGN KEY ("competition_id") REFERENCES "public"."competition"("competition_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_competition_config"
    ADD CONSTRAINT "season_competition_config_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_competition_group_member"
    ADD CONSTRAINT "season_competition_group_member_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season"
    ADD CONSTRAINT "season_era_id_fkey" FOREIGN KEY ("era_id") REFERENCES "public"."era"("era_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."season_extreme_config"
    ADD CONSTRAINT "season_extreme_config_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_extreme_participant"
    ADD CONSTRAINT "season_extreme_participant_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_extreme_participant"
    ADD CONSTRAINT "season_extreme_participant_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_extreme_participant"
    ADD CONSTRAINT "season_extreme_participant_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_zone"
    ADD CONSTRAINT "season_zone_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_zone_team_player"
    ADD CONSTRAINT "season_zone_team_player_player_id_fkey" FOREIGN KEY ("player_id") REFERENCES "public"."player"("player_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."season_zone_team_player"
    ADD CONSTRAINT "season_zone_team_player_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."season_zone_team_player"
    ADD CONSTRAINT "season_zone_team_player_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."season_zone_team"
    ADD CONSTRAINT "season_zone_team_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."season_zone_team"
    ADD CONSTRAINT "season_zone_team_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_standings_snapshot"
    ADD CONSTRAINT "team_standings_snapshot_season_id_fkey" FOREIGN KEY ("season_id") REFERENCES "public"."season"("season_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_standings_snapshot"
    ADD CONSTRAINT "team_standings_snapshot_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."team"("team_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."team_standings_snapshot"
    ADD CONSTRAINT "team_standings_snapshot_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."season_zone"("zone_id") ON DELETE CASCADE;



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_max_active_players"("p_team_id" "uuid", "p_zone_id" "uuid", "p_check_date" "date") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."tg_set_last_edited_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."tg_set_last_edited_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."tg_set_last_edited_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_extreme_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_extreme_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_extreme_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."player" TO "anon";
GRANT ALL ON TABLE "public"."player" TO "authenticated";
GRANT ALL ON TABLE "public"."player" TO "service_role";



GRANT ALL ON TABLE "public"."season" TO "anon";
GRANT ALL ON TABLE "public"."season" TO "authenticated";
GRANT ALL ON TABLE "public"."season" TO "service_role";



GRANT ALL ON TABLE "public"."season_extreme_participant" TO "anon";
GRANT ALL ON TABLE "public"."season_extreme_participant" TO "authenticated";
GRANT ALL ON TABLE "public"."season_extreme_participant" TO "service_role";



GRANT ALL ON TABLE "public"."team" TO "anon";
GRANT ALL ON TABLE "public"."team" TO "authenticated";
GRANT ALL ON TABLE "public"."team" TO "service_role";



GRANT ALL ON TABLE "public"."active_extreme_participants" TO "anon";
GRANT ALL ON TABLE "public"."active_extreme_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."active_extreme_participants" TO "service_role";



GRANT ALL ON TABLE "public"."app_user" TO "anon";
GRANT ALL ON TABLE "public"."app_user" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user" TO "service_role";



GRANT ALL ON TABLE "public"."app_user_player" TO "anon";
GRANT ALL ON TABLE "public"."app_user_player" TO "authenticated";
GRANT ALL ON TABLE "public"."app_user_player" TO "service_role";



GRANT ALL ON TABLE "public"."battle" TO "anon";
GRANT ALL ON TABLE "public"."battle" TO "authenticated";
GRANT ALL ON TABLE "public"."battle" TO "service_role";



GRANT ALL ON TABLE "public"."battle_round" TO "anon";
GRANT ALL ON TABLE "public"."battle_round" TO "authenticated";
GRANT ALL ON TABLE "public"."battle_round" TO "service_role";



GRANT ALL ON TABLE "public"."battle_round_player" TO "anon";
GRANT ALL ON TABLE "public"."battle_round_player" TO "authenticated";
GRANT ALL ON TABLE "public"."battle_round_player" TO "service_role";



GRANT ALL ON TABLE "public"."card" TO "anon";
GRANT ALL ON TABLE "public"."card" TO "authenticated";
GRANT ALL ON TABLE "public"."card" TO "service_role";



GRANT ALL ON TABLE "public"."competition" TO "anon";
GRANT ALL ON TABLE "public"."competition" TO "authenticated";
GRANT ALL ON TABLE "public"."competition" TO "service_role";



GRANT ALL ON TABLE "public"."competition_group" TO "anon";
GRANT ALL ON TABLE "public"."competition_group" TO "authenticated";
GRANT ALL ON TABLE "public"."competition_group" TO "service_role";



GRANT ALL ON TABLE "public"."competition_stage" TO "anon";
GRANT ALL ON TABLE "public"."competition_stage" TO "authenticated";
GRANT ALL ON TABLE "public"."competition_stage" TO "service_role";



GRANT ALL ON TABLE "public"."era" TO "anon";
GRANT ALL ON TABLE "public"."era" TO "authenticated";
GRANT ALL ON TABLE "public"."era" TO "service_role";



GRANT ALL ON TABLE "public"."job_run" TO "anon";
GRANT ALL ON TABLE "public"."job_run" TO "authenticated";
GRANT ALL ON TABLE "public"."job_run" TO "service_role";



GRANT ALL ON TABLE "public"."player_home_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."player_home_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."player_home_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."player_identity" TO "anon";
GRANT ALL ON TABLE "public"."player_identity" TO "authenticated";
GRANT ALL ON TABLE "public"."player_identity" TO "service_role";



GRANT ALL ON TABLE "public"."player_standings_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."player_standings_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."player_standings_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."points_ledger" TO "anon";
GRANT ALL ON TABLE "public"."points_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."points_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_match" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_match" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_match" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_match_battle_link" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_match_battle_link" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_match_battle_link" TO "service_role";



GRANT ALL ON TABLE "public"."scheduled_match_result" TO "anon";
GRANT ALL ON TABLE "public"."scheduled_match_result" TO "authenticated";
GRANT ALL ON TABLE "public"."scheduled_match_result" TO "service_role";



GRANT ALL ON TABLE "public"."season_competition_config" TO "anon";
GRANT ALL ON TABLE "public"."season_competition_config" TO "authenticated";
GRANT ALL ON TABLE "public"."season_competition_config" TO "service_role";



GRANT ALL ON TABLE "public"."season_competition_group_member" TO "anon";
GRANT ALL ON TABLE "public"."season_competition_group_member" TO "authenticated";
GRANT ALL ON TABLE "public"."season_competition_group_member" TO "service_role";



GRANT ALL ON TABLE "public"."season_extreme_config" TO "anon";
GRANT ALL ON TABLE "public"."season_extreme_config" TO "authenticated";
GRANT ALL ON TABLE "public"."season_extreme_config" TO "service_role";



GRANT ALL ON TABLE "public"."season_zone" TO "anon";
GRANT ALL ON TABLE "public"."season_zone" TO "authenticated";
GRANT ALL ON TABLE "public"."season_zone" TO "service_role";



GRANT ALL ON TABLE "public"."season_zone_team" TO "anon";
GRANT ALL ON TABLE "public"."season_zone_team" TO "authenticated";
GRANT ALL ON TABLE "public"."season_zone_team" TO "service_role";



GRANT ALL ON TABLE "public"."season_zone_team_player" TO "anon";
GRANT ALL ON TABLE "public"."season_zone_team_player" TO "authenticated";
GRANT ALL ON TABLE "public"."season_zone_team_player" TO "service_role";



GRANT ALL ON TABLE "public"."team_standings_snapshot" TO "anon";
GRANT ALL ON TABLE "public"."team_standings_snapshot" TO "authenticated";
GRANT ALL ON TABLE "public"."team_standings_snapshot" TO "service_role";



GRANT ALL ON TABLE "public"."v_active_team_players" TO "anon";
GRANT ALL ON TABLE "public"."v_active_team_players" TO "authenticated";
GRANT ALL ON TABLE "public"."v_active_team_players" TO "service_role";



GRANT ALL ON TABLE "public"."v_player_current_tag" TO "anon";
GRANT ALL ON TABLE "public"."v_player_current_tag" TO "authenticated";
GRANT ALL ON TABLE "public"."v_player_current_tag" TO "service_role";



GRANT ALL ON TABLE "public"."v_player_points" TO "anon";
GRANT ALL ON TABLE "public"."v_player_points" TO "authenticated";
GRANT ALL ON TABLE "public"."v_player_points" TO "service_role";



GRANT ALL ON TABLE "public"."v_player_wl" TO "anon";
GRANT ALL ON TABLE "public"."v_player_wl" TO "authenticated";
GRANT ALL ON TABLE "public"."v_player_wl" TO "service_role";



GRANT ALL ON TABLE "public"."v_season_zone_player" TO "anon";
GRANT ALL ON TABLE "public"."v_season_zone_player" TO "authenticated";
GRANT ALL ON TABLE "public"."v_season_zone_player" TO "service_role";



GRANT ALL ON TABLE "public"."v_player_standings_source" TO "anon";
GRANT ALL ON TABLE "public"."v_player_standings_source" TO "authenticated";
GRANT ALL ON TABLE "public"."v_player_standings_source" TO "service_role";



GRANT ALL ON TABLE "public"."v_team_points" TO "anon";
GRANT ALL ON TABLE "public"."v_team_points" TO "authenticated";
GRANT ALL ON TABLE "public"."v_team_points" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







