// auth.ts - Judge authentication system for USA Domino Federation

import { User } from "firebase/auth";

// List of judge emails (hardcoded for simplicity)
// In a production environment, this should be stored in a secure database
export const JUDGE_EMAILS = ["ulvenforst@gmail.com"];

// User roles
export type UserRole = "player" | "judge" | "admin";

/**
 * Determines if a user is a judge based on their email
 * @param user Firebase user object or email string
 * @returns boolean indicating if the user is a judge
 */
export const isJudge = (user: User | string | null): boolean => {
  if (!user) return false;

  const email = typeof user === "string" ? user : user.email;
  if (!email) return false;

  return JUDGE_EMAILS.includes(email.toLowerCase());
};

/**
 * Gets user role based on their email
 * @param user Firebase user object or email string
 * @returns The user's role
 */
export const getUserRole = (user: User | string | null): UserRole => {
  if (isJudge(user)) {
    return "judge";
  }
  return "player";
};

/**
 * Check if user has permission to create leagues
 * @param user Firebase user object
 * @returns boolean indicating if user can create leagues
 */
export const canCreateLeague = (user: User | null): boolean => {
  return isJudge(user);
};

/**
 * Check if user has permission to manage a specific league
 * @param user Firebase user object
 * @param leagueCreatorId The user ID of the league creator
 * @returns boolean indicating if user can manage the league
 */
export const canManageLeague = (
  user: User | null,
  leagueCreatorId: string,
): boolean => {
  if (!user) return false;
  return isJudge(user) || user.uid === leagueCreatorId;
};
