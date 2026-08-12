/**
 * Direction-safe phone number formatter for Egypt numbers.
 * Rules:
 * 1. Preserve exact source phone number and its digits.
 * 2. Structure: +20XXXXXXXXXX
 * 3. Example: 01065045858 -> +201065045858
 * 4. If source already contains +20 10 65045858 -> +201065045858
 * 5. Returns string suitable for display in dir="ltr".
 */
export function formatPhoneInternational(phone) {
  if (!phone) return '';
  const str = String(phone).trim();
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';

  if (digits.startsWith('20') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('01') && digits.length === 11) {
    return `+20${digits.substring(1)}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `+20${digits}`;
  }

  return str.startsWith('+') ? str : `+${digits}`;
}

export function formatPhoneWaDigits(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) {
    return `20${digits.substring(1)}`;
  }
  if (digits.startsWith('1') && digits.length === 10) {
    return `20${digits}`;
  }
  return digits;
}

export function cleanCommissionText(comm) {
  if (!comm) return '50-100% (حسب التفاوض)';
  const s = String(comm).trim();
  if (s.includes('50%') && (s.includes('تقريب') || s.includes('تقريباً'))) {
    return '50-100% (حسب التفاوض)';
  }
  return s;
}
