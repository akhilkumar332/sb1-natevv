// src/hooks/useBloodBankRegister.ts
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';
import { signInWithPopup, signOut } from 'firebase/auth';
import { applyReferralTrackingForUser, resolveReferralContext } from '../services/referral.service';

export const useBloodBankRegister = () => {
  const [googleLoading, setGoogleLoading] = useState(false);

  const navigate = useNavigate();

  const handleGoogleRegister = async () => {
    console.log('🔵 BloodBank Registration started');
    try {
      setGoogleLoading(true);

      // Authenticate with Google using popup
      console.log('🔵 Opening Google popup...');
      const result = await signInWithPopup(auth, googleProvider)
        .catch((error) => {
          console.error('🔴 Popup error:', error);
          if (error.code === 'auth/popup-closed-by-user') {
            throw new Error('Sign-in popup was closed before completing the sign-in process.');
          }
          if (error.code === 'auth/popup-blocked') {
            throw new Error('Sign-in popup was blocked by the browser. Please allow popups for this site.');
          }
          if (error.code === 'auth/cancelled-popup-request') {
            // Silently handle multiple popup requests
            return null;
          }
          throw error;
        });

      if (!result) {
        console.log('🟡 Popup cancelled, exiting');
        setGoogleLoading(false);
        return;
      }

      console.log('✅ Google auth successful:', result.user.email);

      // Check if user already registered
      const userRef = doc(db, 'users', result.user.uid);
      console.log('🔵 Checking if user exists...');

      const userDoc = await getDoc(userRef).catch((error) => {
        console.error('🔴 Error checking user existence:', error);
        throw new Error(`Failed to check user: ${error.message}`);
      });

      if (userDoc.exists()) {
        console.log('🟡 User already exists, redirecting to login');
        await signOut(auth);
        toast.error('Email already registered. Please use the login page.');
        setGoogleLoading(false);
        navigate('/bloodbank/login');
        return;
      }

      console.log('🔵 Creating new user document...');

      const referralContext = await resolveReferralContext(result.user.uid);

      // Create new user document with BloodBank role
      await setDoc(userRef, {
        uid: result.user.uid,
        email: result.user.email,
        displayName: result.user.displayName,
        photoURL: result.user.photoURL,
        role: 'bloodbank',
        onboardingCompleted: false,
        createdAt: serverTimestamp(),
        lastLoginAt: serverTimestamp(),
        ...(referralContext
          ? {
              referredByUid: referralContext.referrerUid,
              referredByBhId: referralContext.referrerBhId,
              referralCapturedAt: serverTimestamp(),
            }
          : {}),
      }).catch((error) => {
        console.error('🔴 Error creating user document:', error);
        throw new Error(`Failed to create user: ${error.message}`);
      });

      await applyReferralTrackingForUser(result.user.uid);

      console.log('✅ User document created, navigating to onboarding');
      toast.success('Registration successful!');
      navigate('/bloodbank/onboarding');
    } catch (error: any) {
      console.error('🔴 Google registration error:', error);
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error('Registration failed. Please try again.');
      }
    } finally {
      console.log('🔵 Setting loading to false');
      setGoogleLoading(false);
    }
  };

  return {
    handleGoogleRegister,
    googleLoading,
  };
};
