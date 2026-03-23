// ============================================================
// MEUBABA — Tipos TypeScript (gerado do schema Supabase)
// ============================================================

export type MemberRole = 'admin' | 'player'
export type AttendanceStatus = 'confirmed' | 'maybe' | 'declined' | 'pending'
export type RoundStatus = 'scheduled' | 'ongoing' | 'finished' | 'cancelled'
export type SeasonStatus = 'active' | 'finished'
export type PollType = 'general' | 'craque' | 'bola_murcha' | 'best_of_year'
export type NotificationType = 'poll_open' | 'round_created' | 'round_reminder' | 'mention' | 'round_finished' | 'season_finished'
export type PlanType = 'free' | 'premium'
export type SubscriptionStatus = 'active' | 'inactive' | 'trial' | 'cancelled'
export type TeamFormationMode = 'manual' | 'balanced' | 'queue'
export type PlayerPosition = 'goleiro' | 'zagueiro' | 'lateral' | 'volante' | 'meia' | 'atacante'

// ------------------------------------------------------------
// PROFILE
// ------------------------------------------------------------
export interface Profile {
  id: string
  full_name: string
  username: string | null
  bio: string | null
  photo_url: string | null
  position_1: PlayerPosition | null
  position_2: PlayerPosition | null
  position_3: PlayerPosition | null
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// GROUP
// ------------------------------------------------------------
export interface Group {
  id: string
  name: string
  description: string | null
  city: string | null
  invite_code: string
  photo_url: string | null
  created_by: string
  subscription_id: string | null
  created_at: string
  updated_at: string
}

export interface GroupMember {
  id: string
  group_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  is_active: boolean
  // joins
  profile?: Profile
}

export interface GroupWithMeta extends Group {
  member_count?: number
  my_role?: MemberRole
  active_season?: Season | null
  next_round?: Round | null
}

// ------------------------------------------------------------
// SEASON
// ------------------------------------------------------------
export interface Season {
  id: string
  group_id: string
  name: string
  status: SeasonStatus
  started_at: string
  ended_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// ROUND
// ------------------------------------------------------------
export interface Round {
  id: string
  group_id: string
  season_id: string
  title: string | null
  scheduled_date: string
  start_time: string
  max_arrival_time: string | null
  status: RoundStatus
  formation_mode: TeamFormationMode
  players_per_team: number
  match_duration_minutes: number
  has_two_halves: boolean
  finished_at: string | null
  created_by: string
  created_at: string
  updated_at: string
}

export interface RoundAttendance {
  id: string
  round_id: string
  user_id: string
  status: AttendanceStatus
  arrival_order: number | null
  updated_at: string
  // joins
  profile?: Profile
}

// ------------------------------------------------------------
// TEAM
// ------------------------------------------------------------
export interface Team {
  id: string
  round_id: string
  name: string
  color: string | null
  photo_url: string | null
  created_at: string
  // joins
  players?: TeamPlayer[]
}

export interface TeamPlayer {
  id: string
  team_id: string
  user_id: string
  // joins
  profile?: Profile
}

// ------------------------------------------------------------
// MATCH
// ------------------------------------------------------------
export interface Match {
  id: string
  round_id: string
  home_team_id: string
  away_team_id: string
  home_score: number
  away_score: number
  match_order: number
  duration_minutes: number | null
  played_at: string | null
  created_at: string
  // joins
  home_team?: Team
  away_team?: Team
}

// ------------------------------------------------------------
// STATS
// ------------------------------------------------------------
export interface Goal {
  id: string
  match_id: string
  round_id: string
  season_id: string
  team_id: string
  scorer_id: string
  minute: number | null
  created_at: string
  // joins
  scorer?: Profile
}

export interface Assist {
  id: string
  match_id: string
  round_id: string
  season_id: string
  goal_id: string | null
  team_id: string
  assister_id: string
  created_at: string
  // joins
  assister?: Profile
}

export interface RedCard {
  id: string
  match_id: string
  round_id: string
  season_id: string
  player_id: string
  created_at: string
  // joins
  player?: Profile
}

// ------------------------------------------------------------
// POLL
// ------------------------------------------------------------
export interface Poll {
  id: string
  group_id: string
  round_id: string | null
  season_id: string
  type: PollType
  title: string
  description: string | null
  is_anonymous: boolean
  show_partial: boolean
  is_multiple_choice: boolean
  created_by: string
  opens_at: string
  closes_at: string
  is_closed: boolean
  created_at: string
  updated_at: string
  // joins
  options?: PollOption[]
  my_vote?: PollVote | null
  vote_count?: number
}

export interface PollOption {
  id: string
  poll_id: string
  user_id: string | null
  label: string
  created_at: string
  // joins
  profile?: Profile
  vote_count?: number
}

export interface PollVote {
  id: string
  poll_id: string
  option_id: string
  voter_id: string
  created_at: string
}

// ------------------------------------------------------------
// PLAYER RATING
// ------------------------------------------------------------
export interface PlayerRating {
  id: string
  round_id: string
  season_id: string
  rated_id: string
  rater_id: string
  rating: number
  created_at: string
}

export interface PlayerRatingStats {
  user_id: string
  full_name: string
  photo_url: string | null
  avg_rating: number
  rating_count: number
  // joins
  profile?: Profile
}

// ------------------------------------------------------------
// CHAT
// ------------------------------------------------------------
export interface ChatMessage {
  id: string
  group_id: string
  sender_id: string
  content: string | null
  audio_url: string | null
  photo_url: string | null
  reply_to_id: string | null
  mentions: string[] | null
  created_at: string
  is_deleted: boolean
  // joins
  sender?: Profile
  reply_to?: ChatMessage | null
}

// ------------------------------------------------------------
// NOTIFICATION
// ------------------------------------------------------------
export interface Notification {
  id: string
  user_id: string
  group_id: string | null
  type: NotificationType
  title: string
  body: string | null
  data: Record<string, unknown> | null
  is_read: boolean
  created_at: string
}

// ------------------------------------------------------------
// SUBSCRIPTION
// ------------------------------------------------------------
export interface Subscription {
  id: string
  group_id: string | null
  plan_type: PlanType
  subscription_status: SubscriptionStatus
  trial_ends_at: string | null
  current_period_start: string | null
  current_period_end: string | null
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// DASHBOARD / STATS AGGREGADOS
// ------------------------------------------------------------
export interface SeasonStats {
  season_id: string
  top_scorers: { profile: Profile; goals: number }[]
  top_assisters: { profile: Profile; assists: number }[]
  top_rated: PlayerRatingStats[]
  total_rounds: number
  total_goals: number
}

export interface RoundStats {
  round_id: string
  goals: Goal[]
  assists: Assist[]
  red_cards: RedCard[]
  ratings: PlayerRatingStats[]
  matches: Match[]
}

// ------------------------------------------------------------
// UTILS
// ------------------------------------------------------------
export interface ApiResponse<T> {
  data: T | null
  error: string | null
}

export const TEAM_COLORS = [
  { name: 'Time Azul', color: '#2563EB' },
  { name: 'Time Branco', color: '#F8FAFC' },
  { name: 'Time Preto', color: '#0F172A' },
  { name: 'Time Amarelo', color: '#EAB308' },
  { name: 'Time Vermelho', color: '#DC2626' },
  { name: 'Time Verde', color: '#16A34A' },
] as const

export const POSITIONS_LABELS: Record<PlayerPosition, string> = {
  goleiro: 'Goleiro',
  zagueiro: 'Zagueiro',
  lateral: 'Lateral',
  volante: 'Volante',
  meia: 'Meia',
  atacante: 'Atacante',
}
