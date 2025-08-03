// League data model for USA Domino Federation
import { Timestamp } from "firebase/firestore";

// Game modes
export type GameMode = "single" | "double";

// League status
export type LeagueStatus = "active" | "completed" | "upcoming" | "canceled";

// League membership status
export type MembershipStatus = "active" | "inactive" | "pending" | "banned";

// League member role
export type LeagueMemberRole = "player" | "admin" | "judge" | "owner";

// Types of tournaments/events
export type TournamentFormat = "round-robin" | "elimination" | "swiss" | "custom";

// Season status
export type SeasonStatus = "active" | "completed" | "upcoming" | "archived";

// Season interface
export interface Season {
  id: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate: Timestamp;
  status: SeasonStatus;
  isDefault: boolean; // Only one season can be default at a time
  createdAt: Timestamp;
  updatedAt: Timestamp;
  leagueId?: string; // If null, it's a global season
  
  // Season-specific settings
  settings?: {
    resetRankings: boolean; // Whether to reset rankings at season start
    carryOverStats: boolean; // Whether to carry over stats from previous season
  };
  
  // Season statistics
  stats?: {
    totalGames: number;
    totalPlayers: number;
    completedGames: number;
  };
}

// Basic league interface
export interface League {
  id: string;
  name: string;
  description: string;
  createdBy: string; // User ID of creator
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: LeagueStatus;
  isPublic: boolean;
  photoURL?: string;
  
  // League settings
  settings: LeagueSettings;
  
  // Statistics
  stats: LeagueStats;
}

// League settings configuration
export interface LeagueSettings {
  gameMode: GameMode;
  pointsToWin: number;
  maxPlayers: number;
  allowJoinRequests: boolean;
  requireConfirmation: boolean;
  
  // Game rules - unified ruleset system
  ruleset?: string; // New dynamic ruleset system
  useBoricuaRules?: boolean; // Legacy support - will be migrated to ruleset
  
  // Scoring settings
  scoringSystem: {
    pointsPerWin: number;
    pointsPerDraw?: number;
    pointsPerLoss?: number;
    usePointDifferential: boolean;
  };
  
  // Tournament settings
  tournamentFormat: TournamentFormat;
  numberOfRounds?: number;
  playoffsEnabled: boolean;
  playoffTeams?: number;
  
  // Rules and penalties
  timeLimit?: number; // in minutes
  penaltiesEnabled: boolean;
}

// League statistics
export interface LeagueStats {
  totalMembers: number;
  totalMatches: number;
  totalMatchesCompleted: number;
  activeMatches: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
}

// League member
export interface LeagueMember {
  id?: string;
  userId: string;
  leagueId: string;
  joinedAt: Timestamp;
  status: MembershipStatus;
  role: LeagueMemberRole;
  
  // Player statistics within this league
  stats: LeagueMemberStats;
}

// League member statistics
export interface LeagueMemberStats {
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  rank?: number;
  winRate: number;
  
  // Tracking streak stats
  currentStreak: number;
  longestWinStreak: number;
  
  // Team-specific stats (for team mode)
  partnerIds?: string[];
}

// League season or tournament
export interface LeagueTournament {
  id: string;
  leagueId: string;
  name: string;
  description?: string;
  startDate: Timestamp;
  endDate?: Timestamp;
  format: TournamentFormat;
  rounds: LeagueRound[];
  status: "upcoming" | "active" | "completed";
  
  // Results
  standings?: LeagueStanding[];
  winner?: string; // User ID or team ID
}

// Round in a tournament
export interface LeagueRound {
  id: string;
  tournamentId: string;
  roundNumber: number;
  startDate?: Timestamp;
  endDate?: Timestamp;
  matches: LeagueMatch[];
}

// Match in a league
export interface LeagueMatch {
  id: string;
  roundId: string;
  homeId: string; // User ID or team ID
  awayId: string; // User ID or team ID
  scheduledTime?: Timestamp;
  location?: string;
  status: "scheduled" | "in_progress" | "completed" | "canceled";
  
  // Scores
  homeScore?: number;
  awayScore?: number;
  
  // Confirmation
  confirmedBy?: string[];
  winner?: string; // User ID or team ID
}

// Team for team-based leagues
export interface LeagueTeam {
  id: string;
  leagueId: string;
  name: string;
  members: string[]; // User IDs
  captain: string; // User ID
  stats: LeagueTeamStats;
}

// Team statistics
export interface LeagueTeamStats {
  gamesPlayed: number;
  gamesWon: number;
  totalPoints: number;
  rank?: number;
  winRate: number;
}

// League standings entry
export interface LeagueStanding {
  id: string; // User ID or team ID
  rank: number;
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesTied?: number;
  points: number; // League points (not game points)
  pointDifferential: number;
}

// League invitation
export interface LeagueInvitation {
  id: string;
  leagueId: string;
  invitedBy: string; // User ID
  invitedUserId: string;
  invitedAt: Timestamp;
  status: "pending" | "accepted" | "declined";
  role: LeagueMemberRole;
  expiresAt?: Timestamp;
}

// Join request for public leagues
export interface LeagueJoinRequest {
  id: string;
  leagueId: string;
  userId: string;
  requestedAt: Timestamp;
  status: "pending" | "approved" | "rejected";
  message?: string;
}

// For league-specific game records
export interface LeagueGame {
  id: string;
  leagueId: string;
  tournamentId?: string;
  roundId?: string;
  matchId?: string;
  createdBy: string;
  opponent: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  status: "invited" | "accepted" | "rejected" | "in_progress" | "waiting_confirmation" | "completed";
  scores?: {
    creator: number;
    opponent: number;
  };
  winner?: string;
}

// League-Season Association
export interface LeagueSeason {
  id: string;
  leagueId: string;
  seasonId: string;
  joinedAt: Timestamp;
  status: "active" | "completed" | "archived";
}