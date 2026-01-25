// src/utils/userLookup.ts
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { normalizePhoneNumber } from './phone';

type UserRecord = Record<string, any> & { id: string };

const buildPhoneVariants = (normalizedPhone: string): string[] => {
  const digitsOnly = String(normalizedPhone).replace(/\D/g, '');
  const variants = new Set<string>();

  if (normalizedPhone) {
    variants.add(normalizedPhone);
  }

  if (digitsOnly) {
    variants.add(digitsOnly);
    if (digitsOnly.startsWith('91') && digitsOnly.length === 12) {
      variants.add(digitsOnly.slice(2));
    }
  }

  const nationalNumber = digitsOnly.startsWith('91') && digitsOnly.length === 12
    ? digitsOnly.slice(2)
    : digitsOnly.length === 10
      ? digitsOnly
      : '';

  if (nationalNumber.length === 10) {
    const fiveFive = `${nationalNumber.slice(0, 5)} ${nationalNumber.slice(5)}`;
    const fiveFiveDash = `${nationalNumber.slice(0, 5)}-${nationalNumber.slice(5)}`;
    const threeThreeFour = `${nationalNumber.slice(0, 3)} ${nationalNumber.slice(3, 6)} ${nationalNumber.slice(6)}`;
    const threeThreeFourDash = `${nationalNumber.slice(0, 3)}-${nationalNumber.slice(3, 6)}-${nationalNumber.slice(6)}`;

    variants.add(nationalNumber);
    variants.add(fiveFive);
    variants.add(fiveFiveDash);
    variants.add(threeThreeFour);
    variants.add(threeThreeFourDash);
    variants.add(`+91${nationalNumber}`);
    variants.add(`+91 ${nationalNumber}`);
    variants.add(`+91 ${fiveFive}`);
    variants.add(`+91-${fiveFiveDash}`);
    variants.add(`+91 ${threeThreeFour}`);
    variants.add(`+91-${threeThreeFourDash}`);
  }

  return Array.from(variants);
};

export const findUsersByPhone = async (phoneNumber: string): Promise<UserRecord[]> => {
  const normalizedPhone = normalizePhoneNumber(phoneNumber);
  if (!normalizedPhone) {
    return [];
  }

  const usersRef = collection(db, 'users');
  const matches = new Map<string, UserRecord>();

  const addDocs = (snapshot: any) => {
    snapshot.forEach((doc: any) => {
      matches.set(doc.id, { id: doc.id, ...doc.data() });
    });
  };

  const normalizedSnapshot = await getDocs(
    query(usersRef, where('phoneNumberNormalized', '==', normalizedPhone))
  );
  addDocs(normalizedSnapshot);

  if (matches.size === 0) {
    const variants = buildPhoneVariants(normalizedPhone);
    for (const variant of variants) {
      const normalizedSnapshot = await getDocs(
        query(usersRef, where('phoneNumberNormalized', '==', variant))
      );
      addDocs(normalizedSnapshot);
      if (matches.size > 0) {
        break;
      }

      const phoneSnapshot = await getDocs(
        query(usersRef, where('phoneNumber', '==', variant))
      );
      addDocs(phoneSnapshot);
      if (matches.size > 0) {
        break;
      }

      const legacySnapshot = await getDocs(
        query(usersRef, where('phone', '==', variant))
      );
      addDocs(legacySnapshot);
      if (matches.size > 0) {
        break;
      }
    }
  }

  return Array.from(matches.values());
};
