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


  export   const formatDate = (dateString?: string) => {
    if (!dateString) return "No expiry";
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

    const isExpired = (expiryDate: string) => {
    return new Date(expiryDate) < new Date();
  };

  const isExpiringSoon = (expiryDate: string, days = 30) => {
    const today = new Date();
    const expiry = new Date(expiryDate);
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= days && diffDays > 0;
  };

  export const getExpiryBadgeVariant = (expiryDate?: string) => {
    if (!expiryDate) return "secondary";
    if (isExpired(expiryDate)) return "destructive";
    if (isExpiringSoon(expiryDate)) return "default";
    return "secondary";
  };

   // Document status helper function
    export  const getDocumentStatus = (expiryDate: string | null) => {
          if (!expiryDate) return { variant: 'destructive' as const, label: 'No Date' };
          
          const today = new Date();
          const expiry = new Date(expiryDate);
          const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
          
          if (daysUntilExpiry < 0) return { variant: 'destructive' as const, label: 'Expired' };
          if (daysUntilExpiry <= 30) return { variant: 'destructive' as const, label: 'Due Soon' };
          if (daysUntilExpiry <= 90) return { variant: 'secondary' as const, label: 'Warning' };
          
          return { variant: 'default' as const, label: 'Valid' };
      };