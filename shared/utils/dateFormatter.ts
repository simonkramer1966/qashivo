/**
 * Universal date formatter for international users
 * Returns dates in format: "15 Sep 2024" - unambiguous worldwide
 */
export function formatDate(date: string | Date): string {
  const dateObj = new Date(date);
  
  // Check for invalid date
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  return dateObj.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Format date for display with ordinal suffix (e.g., "15th Sep 2024")
 */
export function formatDateWithOrdinal(date: string | Date): string {
  const dateObj = new Date(date);
  
  if (isNaN(dateObj.getTime())) {
    return 'Invalid Date';
  }
  
  const day = dateObj.getDate();
  const ordinalSuffix = getOrdinalSuffix(day);
  
  return dateObj.toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric'
  }).replace(/^\d+/, `${day}${ordinalSuffix}`);
}

function getOrdinalSuffix(day: number): string {
  if (day > 3 && day < 21) return 'th';
  switch (day % 10) {
    case 1: return 'st';
    case 2: return 'nd';
    case 3: return 'rd';
    default: return 'th';
  }
}