// src/app/utils/adminUtils.ts

import type { User } from "@supabase/supabase-js";

/**
 * List of admin emails
 * TODO: Move this to environment variables or database
 */
const ADMIN_EMAILS = [
  // Add admin emails here
  "admin@dynastycube.com",
    "amonteallen@gmail.com",
  // Add your email here for testing
];

/**
 * Check if a user is an admin based on their email
 */
export const isAdmin = (user: User | null): boolean => {
  if (!user || !user.email) return false;
  return ADMIN_EMAILS.includes(user.email.toLowerCase());
};

/**
 * Check if a user has admin role from metadata
 * This can be used if you store admin role in user metadata
 */
export const hasAdminRole = (user: User | null): boolean => {
  if (!user) return false;
  return user.user_metadata?.role === "admin" || user.app_metadata?.role === "admin";
};

/**
 * Combined admin check - checks both email list and metadata
 */
export const checkIsAdmin = (user: User | null): boolean => {
  return isAdmin(user) || hasAdminRole(user);
};
