// API-based validation utilities for address, contact, and other fields

// Mock API validation - simulates real API calls
// In production, these would make actual API calls to validation services

export async function validateAddress(
  country,
  city,
  address,
  pinCode
) {
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, 500));

  const errors = [];

  // Country validation
  if (!country || country.length !== 2) {
    errors.push({ field: 'country', message: 'Please select a valid country' });
  }

  // City validation
  if (!city || city.trim().length < 2) {
    errors.push({ field: 'city', message: 'City name must be at least 2 characters' });
  }

  // Address validation
  if (!address || address.trim().length < 10) {
    errors.push({ field: 'address', message: 'Please provide a complete address (minimum 10 characters)' });
  }

  // Pin code validation (basic pattern check)
  if (pinCode && pinCode.trim()) {
    const pinCodePattern = /^[A-Z0-9]{3,10}$/i;
    if (!pinCodePattern.test(pinCode.replace(/[\s-]/g, ''))) {
      errors.push({ field: 'pinCode', message: 'Invalid pin/postal code format' });
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function validatePhone(phone, countryCode) {
  await new Promise(resolve => setTimeout(resolve, 300));

  const errors = [];

  if (!phone || phone.trim().length === 0) {
    return { isValid: true, errors: [] }; // Phone is optional
  }

  // Basic phone validation - must include country code and be 10-15 digits
  const phonePattern = /^\+?[1-9]\d{9,14}$/;
  const cleanPhone = phone.replace(/[\s()-]/g, '');

  if (!phonePattern.test(cleanPhone)) {
    errors.push({ 
      field: 'phone', 
      message: 'Invalid phone number. Must include country code (e.g., +1234567890)' 
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function validateEmail(email) {
  await new Promise(resolve => setTimeout(resolve, 300));

  const errors = [];

  if (!email || email.trim().length === 0) {
    return { isValid: true, errors: [] }; // Email is optional in some contexts
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    errors.push({ field: 'email', message: 'Invalid email address format' });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

export async function validateHSCode(hsCode) {
  await new Promise(resolve => setTimeout(resolve, 400));

  const errors = [];

  if (!hsCode || hsCode.trim().length === 0) {
    return { isValid: true, errors: [] }; // HS Code is optional
  }

  // HS Code format: usually 6-10 digits with optional dots
  const hsCodePattern = /^\d{4}\.?\d{2}\.?\d{0,4}$/;
  if (!hsCodePattern.test(hsCode.replace(/\s/g, ''))) {
    errors.push({ 
      field: 'hsCode', 
      message: 'Invalid HS Code format. Should be 6-10 digits (e.g., 8541.10.00)' 
    });
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

// Currency mapping based on country codes
export const currencyMap = {
  'US': { code: 'USD', symbol: '$', name: 'US Dollar' },
  'IN': { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  'CN': { code: 'CNY', symbol: '¥', name: 'Chinese Yuan' },
  'GB': { code: 'GBP', symbol: '£', name: 'British Pound' },
  'JP': { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  'EU': { code: 'EUR', symbol: '€', name: 'Euro' },
  'CA': { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  'AU': { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
};

export function getCurrencyByCountry(countryCode) {
  return currencyMap[countryCode] || { code: 'USD', symbol: '$', name: 'US Dollar' };
}

// Timezone mapping based on country codes
export const timezoneMap = {
  'US': 'America/New_York (UTC-5)',
  'IN': 'Asia/Kolkata (UTC+5:30)',
  'CN': 'Asia/Shanghai (UTC+8)',
  'GB': 'Europe/London (UTC+0)',
  'JP': 'Asia/Tokyo (UTC+9)',
  'CA': 'America/Toronto (UTC-5)',
  'AU': 'Australia/Sydney (UTC+11)',
};

export function getTimezoneByCountry(countryCode) {
  return timezoneMap[countryCode] || 'UTC';
}

// Format currency using Intl, with a safe fallback
export function formatCurrency(amount, currency = 'USD') {
  const num = parseFloat(amount) || 0;
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(num);
  } catch (e) {
    return `${num.toLocaleString()} ${currency}`;
  }
}

  // HS Code suggestions based on product name/description
export async function suggestHSCode(productName, productDescription, category) {
  // Call backend HS suggestion endpoint
  try {
    const resp = await fetch('https://api.pre-clear.app/api/ai/hs/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: productName || '', category: category || '', description: productDescription || '', k: 5 })
    });
    if (!resp.ok) {
      console.error('HS suggest API returned', resp.status);
      return [];
    }
    const body = await resp.json();
    const suggestions = body?.suggestions;
    if (!Array.isArray(suggestions)) {
      console.error('HS suggest API returned invalid format:', body);
      return [];
    }
    const items = suggestions.map(s => ({ code: s.hscode || s.code, description: s.description || '', score: s.score || 0 }));
    return items;
  } catch (err) {
    console.error('HS suggest call failed', err);
    return [];
  }
}

// Validate HS code and get status
export async function validateAndCheckHSCode(hsCode, destCountry) {
  await new Promise(resolve => setTimeout(resolve, 500));

  const hsCodeClean = hsCode.replace(/\./g, '');

  // Medical devices (9018-9022)
  if (hsCodeClean.startsWith('9018') || hsCodeClean.startsWith('9019') || 
      hsCodeClean.startsWith('9020') || hsCodeClean.startsWith('9021') || 
      hsCodeClean.startsWith('9022')) {
    return {
      isValid: true,
      status: 'restricted',
      message: 'Medical device - Additional FDA approval and certifications required',
      requiredDocs: ['FDA Registration', 'ISO Certificate', 'Safety Data Sheet'],
      restrictions: ['FDA approval required', 'ISO 13485 certification mandatory']
    };
  }

  // Pharmaceuticals (3004)
  if (hsCodeClean.startsWith('3004')) {
    return {
      isValid: true,
      status: 'banned',
      message: 'Pharmaceutical product - Requires special import license and FDA approval',
      restrictions: ['Cannot ship without FDA import license', 'Controlled substance regulations apply']
    };
  }

  // Weapons (9301-9307)
  if (hsCodeClean.startsWith('93')) {
    return {
      isValid: true,
      status: 'banned',
      message: 'Weapons and ammunition - Prohibited without special government authorization',
      restrictions: ['Strictly prohibited', 'Requires ATF and export/import licenses']
    };
  }

  // Electronics (8541-8548)
  if (hsCodeClean.startsWith('854')) {
    return {
      isValid: true,
      status: 'valid',
      message: 'Electronic components - Standard compliance required',
      requiredDocs: ['FCC Declaration', 'RoHS Certificate'],
      restrictions: ['FCC certification required for US', 'RoHS compliance']
    };
  }

  // Default valid
  return {
    isValid: true,
    status: 'valid',
    message: 'HS Code validated - Standard documentation required',
    requiredDocs: ['Commercial Invoice', 'Packing List', 'Certificate of Origin']
  };
}

