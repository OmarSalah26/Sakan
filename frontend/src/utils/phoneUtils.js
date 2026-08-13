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

export function formatCommissionDisplay(config) {
  if (!config) return null;
  const isRange = config.commission_type === 'range' || (config.commission_min != null && config.commission_max != null);
  const price = Number(config.price_per_person) || 0;

  if (isRange) {
    let minVal = config.commission_min !== null && config.commission_min !== undefined ? config.commission_min : (config.commission_min_pct ?? 30);
    let maxVal = config.commission_max !== null && config.commission_max !== undefined ? config.commission_max : (config.commission_max_pct ?? 100);

    if (typeof minVal === 'number' && minVal > 100 && price > 0) {
      minVal = Math.round((minVal / price) * 100);
    }
    if (typeof maxVal === 'number' && maxVal > 100 && price > 0) {
      maxVal = Math.round((maxVal / price) * 100);
    }

    const minStr = String(minVal).replace(/[^0-9.]/g, '');
    const maxStr = String(maxVal).replace(/[^0-9.]/g, '');
    return `${minStr}%-${maxStr}%`;
  }

  let val = config.commission_pct !== null && config.commission_pct !== undefined ? config.commission_pct : config.commission;
  if (val !== null && val !== undefined && val !== '') {
    if (typeof val === 'number' && val > 100 && price > 0) {
      val = Math.round((val / price) * 100);
    }
    const valStr = String(val).replace(/[^0-9.]/g, '');
    return `${valStr}%`;
  }

  return null;
}


