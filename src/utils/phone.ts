// src/utils/phone.ts

export const normalizePhoneNumber = (value: string): string => {
  if (!value) return '';

  let formatted = value.replace(/\s+/g, '').trim();

  if (!formatted.startsWith('+')) {
    const digitsOnly = formatted.replace(/\D/g, '');
    if (digitsOnly.length === 10) {
      formatted = `+91${digitsOnly}`;
    } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
      formatted = `+${digitsOnly}`;
    } else if (digitsOnly.length > 0) {
      formatted = `+${digitsOnly}`;
    }
  }

  return formatted;
};

export const isValidPhoneNumber = (value: string): boolean => {
  const normalized = normalizePhoneNumber(value);
  if (!normalized.startsWith('+')) {
    return false;
  }
  const digitsOnly = normalized.replace(/\D/g, '');
  return digitsOnly.length >= 10 && digitsOnly.length <= 15;
};
