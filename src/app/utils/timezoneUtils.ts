// src/app/utils/timezoneUtils.ts

/**
 * Common timezones grouped by region
 * Format: IANA Time Zone Database format
 */
export const TIMEZONES = [
  // UTC
  { value: "UTC", label: "UTC (Coordinated Universal Time)", offset: "+00:00" },

  // North America
  { value: "America/New_York", label: "Eastern Time (US & Canada)", offset: "-05:00" },
  { value: "America/Chicago", label: "Central Time (US & Canada)", offset: "-06:00" },
  { value: "America/Denver", label: "Mountain Time (US & Canada)", offset: "-07:00" },
  { value: "America/Los_Angeles", label: "Pacific Time (US & Canada)", offset: "-08:00" },
  { value: "America/Anchorage", label: "Alaska", offset: "-09:00" },
  { value: "Pacific/Honolulu", label: "Hawaii", offset: "-10:00" },
  { value: "America/Toronto", label: "Toronto", offset: "-05:00" },
  { value: "America/Vancouver", label: "Vancouver", offset: "-08:00" },
  { value: "America/Mexico_City", label: "Mexico City", offset: "-06:00" },

  // Europe
  { value: "Europe/London", label: "London", offset: "+00:00" },
  { value: "Europe/Paris", label: "Paris", offset: "+01:00" },
  { value: "Europe/Berlin", label: "Berlin", offset: "+01:00" },
  { value: "Europe/Rome", label: "Rome", offset: "+01:00" },
  { value: "Europe/Madrid", label: "Madrid", offset: "+01:00" },
  { value: "Europe/Amsterdam", label: "Amsterdam", offset: "+01:00" },
  { value: "Europe/Brussels", label: "Brussels", offset: "+01:00" },
  { value: "Europe/Vienna", label: "Vienna", offset: "+01:00" },
  { value: "Europe/Stockholm", label: "Stockholm", offset: "+01:00" },
  { value: "Europe/Warsaw", label: "Warsaw", offset: "+01:00" },
  { value: "Europe/Athens", label: "Athens", offset: "+02:00" },
  { value: "Europe/Helsinki", label: "Helsinki", offset: "+02:00" },
  { value: "Europe/Moscow", label: "Moscow", offset: "+03:00" },
  { value: "Europe/Istanbul", label: "Istanbul", offset: "+03:00" },

  // Asia
  { value: "Asia/Dubai", label: "Dubai", offset: "+04:00" },
  { value: "Asia/Kolkata", label: "India Standard Time", offset: "+05:30" },
  { value: "Asia/Bangkok", label: "Bangkok", offset: "+07:00" },
  { value: "Asia/Singapore", label: "Singapore", offset: "+08:00" },
  { value: "Asia/Hong_Kong", label: "Hong Kong", offset: "+08:00" },
  { value: "Asia/Shanghai", label: "Shanghai", offset: "+08:00" },
  { value: "Asia/Tokyo", label: "Tokyo", offset: "+09:00" },
  { value: "Asia/Seoul", label: "Seoul", offset: "+09:00" },

  // Australia & Pacific
  { value: "Australia/Perth", label: "Perth", offset: "+08:00" },
  { value: "Australia/Adelaide", label: "Adelaide", offset: "+09:30" },
  { value: "Australia/Brisbane", label: "Brisbane", offset: "+10:00" },
  { value: "Australia/Sydney", label: "Sydney", offset: "+10:00" },
  { value: "Australia/Melbourne", label: "Melbourne", offset: "+10:00" },
  { value: "Pacific/Auckland", label: "Auckland", offset: "+12:00" },

  // South America
  { value: "America/Sao_Paulo", label: "São Paulo", offset: "-03:00" },
  { value: "America/Buenos_Aires", label: "Buenos Aires", offset: "-03:00" },
  { value: "America/Santiago", label: "Santiago", offset: "-04:00" },

  // Africa
  { value: "Africa/Cairo", label: "Cairo", offset: "+02:00" },
  { value: "Africa/Johannesburg", label: "Johannesburg", offset: "+02:00" },
  { value: "Africa/Lagos", label: "Lagos", offset: "+01:00" },
  { value: "Africa/Nairobi", label: "Nairobi", offset: "+03:00" },
];

/**
 * Format a date string or Date object in the user's timezone
 * @param date - Date string (ISO format) or Date object
 * @param timezone - IANA timezone string (e.g., "America/New_York")
 * @param options - Intl.DateTimeFormatOptions for formatting
 * @returns Formatted date string
 */
export function formatInTimezone(
  date: string | Date,
  timezone: string = "UTC",
  options?: Intl.DateTimeFormatOptions
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const defaultOptions: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  };

  const formatOptions = options || defaultOptions;

  return new Intl.DateTimeFormat("en-US", {
    ...formatOptions,
    timeZone: timezone,
  }).format(dateObj);
}

/**
 * Format a date for display (e.g., "Jan 15, 2025 at 3:45 PM")
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @returns Formatted date string
 */
export function formatDateTime(
  date: string | Date,
  timezone: string = "UTC"
): string {
  return formatInTimezone(date, timezone, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a date for display (short format, e.g., "Jan 15, 2025")
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @returns Formatted date string
 */
export function formatDate(
  date: string | Date,
  timezone: string = "UTC"
): string {
  return formatInTimezone(date, timezone, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format time only (e.g., "3:45 PM")
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @returns Formatted time string
 */
export function formatTime(
  date: string | Date,
  timezone: string = "UTC"
): string {
  return formatInTimezone(date, timezone, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format relative time (e.g., "5 minutes ago", "2 hours ago")
 * This is timezone-agnostic since it shows relative time
 * @param date - Date string or Date object
 * @returns Relative time string
 */
export function formatRelativeTime(date: string | Date): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;
  const now = new Date();
  const seconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)}w ago`;

  // For older dates, return formatted date
  return dateObj.toLocaleDateString();
}

/**
 * Get the user's browser timezone
 * @returns IANA timezone string
 */
export function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Get timezone offset display (e.g., "UTC-05:00")
 * @param timezone - IANA timezone string
 * @returns Offset display string
 */
export function getTimezoneOffset(timezone: string): string {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: timezone,
    timeZoneName: "longOffset",
  };

  const formatted = new Intl.DateTimeFormat("en-US", options).format(now);
  const match = formatted.match(/GMT([+-]\d{1,2}):?(\d{2})?/);

  if (match) {
    const hours = match[1];
    const minutes = match[2] || "00";
    return `UTC${hours}:${minutes}`;
  }

  return "UTC+00:00";
}

/**
 * Format a full datetime with timezone abbreviation (e.g., "Jan 15, 2025 at 3:45 PM EST")
 * @param date - Date string or Date object
 * @param timezone - User's timezone
 * @returns Formatted datetime with timezone
 */
export function formatDateTimeWithTz(
  date: string | Date,
  timezone: string = "UTC"
): string {
  const dateObj = typeof date === "string" ? new Date(date) : date;

  const formatted = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: timezone,
    timeZoneName: "short",
  }).format(dateObj);

  return formatted;
}
