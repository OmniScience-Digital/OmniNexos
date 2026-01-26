import { DateTime } from 'luxon';

export function getJhbTimestamp(): string {
  return DateTime.now().setZone('Africa/Johannesburg').toFormat('yyyy-MM-dd HH:mm:ss');
}

export function normalize(str: any): string {
  if (typeof str !== 'string') return String(str);
  return str.trim().replace(/^"+|"+$/g, '');
}

  export const formatDateForAmplify = (dateValue: string | null | undefined): string | null => {
    if (!dateValue || dateValue.trim() === "") return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return dateValue;
    if (dateValue.includes('T')) return dateValue.split('T')[0];
    try {
      const date = new Date(dateValue);
      if (isNaN(date.getTime())) return null;
      return date.toISOString().split('T')[0];
    } catch {
      return null;
    }
  };