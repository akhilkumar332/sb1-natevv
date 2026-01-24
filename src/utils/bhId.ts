type BhIdInput = {
  dateOfBirth?: Date | string;
  postalCode?: string | null;
  uid: string;
};

const formatTwoDigits = (value: number) => String(value).padStart(2, '0');

export const generateBhId = ({ dateOfBirth, postalCode, uid }: BhIdInput): string | null => {
  if (!dateOfBirth || !postalCode || !uid) {
    return null;
  }

  const dob = dateOfBirth instanceof Date ? dateOfBirth : new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime())) {
    return null;
  }

  const day = formatTwoDigits(dob.getDate());
  const month = formatTwoDigits(dob.getMonth() + 1);
  const year = formatTwoDigits(dob.getFullYear() % 100);

  const digitsOnly = String(postalCode).replace(/\D/g, '');
  if (digitsOnly.length < 2) {
    return null;
  }

  const pinSuffix = digitsOnly.slice(-2);
  const uidSuffix = uid.slice(-2).toUpperCase();

  if (uidSuffix.length < 2) {
    return null;
  }

  return `BH${day}${month}${year}${pinSuffix}${uidSuffix}`;
};
