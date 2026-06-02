/**
 * Hand-written database types matching the Supabase schema.
 * Replace with auto-generated types once Supabase CLI is configured:
 *   supabase gen types typescript --local > src/lib/types/database.ts
 */

// ─── Profile ─────────────────────────────────────────────────────────────────

export interface Profile {
  id: string;
  username: string;
  created_at: string;
}

export type ProfileInsert = Omit<Profile, "created_at">;

// ─── Room status + win rule ────────────────────────────────────────────────────

export type RoomStatus =
  | "lobby"
  | "drawn"
  | "group_stage"
  | "knockout"
  | "finished";

export type WinRule = "strict" | "last_standing";

export type KnockoutStage =
  | "r16"
  | "qf"
  | "sf"
  | "final"
  | "champion"
  | "out";

export type MatchStage = "r16" | "qf" | "sf" | "final";

// ─── Row types (what you get back from SELECT) ───────────────────────────────

export interface Country {
  code: string;
  name: string;
  flag_emoji: string;
  external_team_id: number | null;
}

export interface Room {
  id: string;
  code: string;
  host_user_id: string;
  host_name: string;
  host_secret: string | null; // only returned to service-role callers
  status: RoomStatus;
  win_rule: WinRule;
  stake_amount: number | null;
  external_competition_id: number | null;
  external_season_id: number | null;
  winner_player_id: string | null;
  created_at: string;
}

/** Room without the secret field — safe to return to any client */
export type RoomPublic = Omit<Room, "host_secret">;

export interface Player {
  id: string;
  room_id: string;
  user_id: string | null;
  name: string;
  avatar_emoji: string | null;
  assigned_country: string | null;
  is_eliminated: boolean;
  joined_at: string;
}

export interface RoomCountry {
  id: string;
  room_id: string;
  country_code: string;
  qualified: boolean | null;
}

export interface RoomTeam {
  id: string;
  room_id: string;
  country_code: string;
  player_id: string | null;
  bracket_position: number;
  current_stage: KnockoutStage;
  is_eliminated: boolean;
}

export interface Match {
  id: string;
  room_id: string;
  external_match_id: number | null;
  stage: MatchStage;
  team_a_code: string | null;
  team_b_code: string | null;
  winner_code: string | null;
  bracket_position: number | null;
  match_order: number | null;
}

// ─── Insert types (subset of fields required for INSERT) ────────────────────

export type CountryInsert = Omit<Country, "external_team_id"> & {
  external_team_id?: number | null;
};

export type RoomInsert = Omit<
  Room,
  "id" | "created_at" | "winner_player_id" | "host_secret"
>;

export type PlayerInsert = Omit<Player, "id" | "joined_at">;

export type RoomCountryInsert = Omit<RoomCountry, "id">;

export type RoomTeamInsert = Omit<RoomTeam, "id">;

export type MatchInsert = Omit<Match, "id">;

// ─── Supabase Database generic (used by createClient<Database>) ─────────────

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<Profile>;
        Relationships: never[];
      };
      countries: {
        Row: Country;
        Insert: CountryInsert;
        Update: Partial<Country>;
        Relationships: never[];
      };
      rooms: {
        Row: Room;
        Insert: RoomInsert;
        Update: Partial<Room>;
        Relationships: never[];
      };
      players: {
        Row: Player;
        Insert: PlayerInsert;
        Update: Partial<Player>;
        Relationships: never[];
      };
      room_countries: {
        Row: RoomCountry;
        Insert: RoomCountryInsert;
        Update: Partial<RoomCountry>;
        Relationships: never[];
      };
      room_teams: {
        Row: RoomTeam;
        Insert: RoomTeamInsert;
        Update: Partial<RoomTeam>;
        Relationships: never[];
      };
      matches: {
        Row: Match;
        Insert: MatchInsert;
        Update: Partial<Match>;
        Relationships: never[];
      };
    };
    Views: Record<string, never>;
    Functions: {
      lookup_email_by_username: {
        Args: { p_username: string };
        Returns: string | null;
      };
    };
    Enums: Record<string, never>;
  };
}
