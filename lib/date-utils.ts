/**
 * Date formatting utilities for PST timezone
 */

/**
 * Format a date to PST timezone with "PST" suffix
 * @param date - ISO string or Date object
 * @param includeTime - Whether to include time (default: false)
 * @returns Formatted date string with PST indicator
 */
export function formatDatePST(date: string | Date | undefined | null, includeTime: boolean = false): string {
  if (!date) return 'N/A';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    if (includeTime) {
      // Format: "Jan 5, 2025, 3:45 PM PST"
      return dateObj.toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }) + ' PST';
    } else {
      // Format: "Jan 5, 2025 PST"
      return dateObj.toLocaleDateString('en-US', {
        timeZone: 'America/Los_Angeles',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }) + ' PST';
    }
  } catch (error) {
    console.error('Error formatting date:', error);
    return 'Invalid Date';
  }
}

/**
 * Format a date to PST timezone for tooltips (full date and time)
 * @param date - ISO string or Date object
 * @returns Full formatted date string with PST indicator
 */
export function formatDateTimePST(date: string | Date | undefined | null): string {
  if (!date) return 'Unknown';

  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;

    // Format: "January 5, 2025 at 3:45:30 PM PST"
    return dateObj.toLocaleString('en-US', {
      timeZone: 'America/Los_Angeles',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
    }) + ' PST';
  } catch (error) {
    console.error('Error formatting date/time:', error);
    return 'Invalid Date';
  }
}
