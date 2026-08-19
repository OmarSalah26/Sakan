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

    if (Number(minVal) === 0 && Number(maxVal) === 0) return null;

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
  if (val !== null && val !== undefined && val !== '' && Number(val) > 0) {
    if (typeof val === 'number' && val > 100 && price > 0) {
      val = Math.round((val / price) * 100);
    }
    const valStr = String(val).replace(/[^0-9.]/g, '');
    return `${valStr}%`;
  }

  return null;
}

export function calculateListingTotalPrice(item) {
  if (!item) return 0;
  const pricingMode = item.pricing_mode || 'room_based';
  const storedTotal = item.totalPrice !== undefined && item.totalPrice !== null 
    ? Number(item.totalPrice) 
    : (item.total_price !== undefined && item.total_price !== null ? Number(item.total_price) : null);

  if (pricingMode === 'total_based' && storedTotal !== null && !isNaN(storedTotal) && storedTotal > 0) {
    return storedTotal;
  }

  const configs = item.room_configurations || [];
  const validConfigs = configs.filter(c => Number(c.price_per_person) > 0);
  if (validConfigs.length > 0) {
    let totalFromRooms = 0;
    validConfigs.forEach(c => {
      const roomType = c.room_type || 'single';
      const bedsPerRoom = roomType === 'single' ? 1 : roomType === 'double' ? 2 : roomType === 'triple' ? 3 : 4;
      const roomCount = c.count || 1;
      const pricePerPerson = Number(c.price_per_person) || 0;
      totalFromRooms += (roomCount * bedsPerRoom * pricePerPerson);
    });
    return totalFromRooms;
  }

  if (storedTotal !== null && !isNaN(storedTotal) && storedTotal > 0) {
    return storedTotal;
  }

  if (item.price_per_person && item.available_beds) {
    return Number(item.price_per_person) * Number(item.available_beds);
  }

  return 0;
}

export function formatUnifiedShareText(listing) {
  if (!listing) return '';

  const title = (listing.title || 'سكن رائع').trim();
  const genderLine = listing.gender === 'female' 
    ? '👧 *سكن طالبات*' 
    : listing.gender === 'male' 
      ? '👨‍🦱 *سكن طلاب*' 
      : '👨‍🦱👧 *سكن طلاب / طالبات*';
  
  // Location: City only (without Governorates as requested)
  const city = (listing.city || '').trim();

  // Full Address
  const address = (listing.full_address || listing.address || listing.street || '').trim();

  // Room Configurations
  const configs = Array.isArray(listing.room_configurations)
    ? listing.room_configurations
    : typeof listing.room_configurations === 'string'
      ? (function() { try { return JSON.parse(listing.room_configurations || '[]'); } catch { return []; } })()
      : [];

  const isTotalBased = listing.pricing_mode === 'total_based';

  const roomLines = [];
  if (Array.isArray(configs) && configs.length > 0) {
    configs.forEach(c => {
      const roomType = c.room_type || 'single';
      const label = roomType === 'single' ? 'مفردة' : roomType === 'double' ? 'مزدوجة' : roomType === 'triple' ? 'ثلاثية' : 'رباعية';
      const count = Number(c.count) || 1;
      const countStr = count === 1 ? `غرفة ${label}` : `${count} غرف ${label}`;

      const multiplier = roomType === 'double' ? 2 : roomType === 'triple' ? 3 : roomType === 'quadruple' ? 4 : 1;
      const maxCap = multiplier * count;
      const availBeds = c.available_beds !== undefined && c.available_beds !== null && c.available_beds !== ''
        ? Number(c.available_beds)
        : maxCap;
      
      const bedLabel = availBeds === 1 ? '1 سرير متاح' : `${availBeds} أسرة متاحة`;
      const price = Number(c.price_per_person) || 0;

      if (!isTotalBased && price > 0) {
        roomLines.push(`• ${countStr} | ${price.toLocaleString()} جنيه/فرد | ${bedLabel}`);
      } else {
        roomLines.push(`• ${countStr} | ${bedLabel}`);
      }
    });
  }

  // Total Rent Price
  const totalRent = calculateListingTotalPrice(listing);
  const priceStr = totalRent ? `${totalRent.toLocaleString()} جنيه` : '';

  // Canonical Listing Link
  const listingId = listing.id || '';
  const shareUrl = listingId ? `https://sakan-egy.com/listings/${listingId}` : '';

  const lines = [
    `🏠 *سكن | ${title}*`,
    '',
    genderLine,
    city ? `📍 *الموقع:* ${city}` : null,
    address ? `📌 *العنوان:* ${address}` : null,
    '',
    '🛏️ *تكوين الغرف*',
    roomLines.length > 0 ? roomLines.join('\n') : '• بيانات الغرف متوفرة عند التواصل',
    '',
    priceStr ? `💰 *إجمالي سعر الإيجار:* ${priceStr}` : null,
    '',
    '✨ *شاهد الصور والفيديو وجميع تفاصيل السكن:*',
    shareUrl ? `🔗 ${shareUrl}` : null
  ].filter(line => line !== null);

  return lines.join('\n');
}

export function stripFloorFromAddress(addr) {
  if (!addr || typeof addr !== 'string') return '';
  return addr
    .replace(/(?:،|,)?\s*الدور\s+(?:الأرضي|الارضي|الأول|الاول|الثاني|الثالث|الرابع|الخامس|السادس|السابع|الثامن|التاسع|العاشر|\d+)/gi, '')
    .replace(/(?:،|,)?\s*دور\s+(?:أرضي|ارضي|أول|اول|ثاني|ثالث|رابع|خامس|سادس|سابع|ثامن|تاسع|عاشر|\d+)/gi, '')
    .replace(/,\s*,/g, ',')
    .replace(/،\s*،/g, '،')
    .trim()
    .replace(/^،|،$/g, '')
    .replace(/^,|,$/g, '')
    .trim();
}



