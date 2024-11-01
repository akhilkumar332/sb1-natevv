// src/contexts/AuthContext.tsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser
} from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  getDoc,
  serverTimestamp, 
  DocumentReference,
  DocumentSnapshot
} from 'firebase/firestore';
import { auth, db, googleProvider } from '../firebase';

// Define User interface with additional Firestore fields
interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  phoneNumber?: string | null;
  createdAt?: Date;
  lastLoginAt?: Date;
  role?: 'donor' | 'recipient' | 'admin';
  bloodType?: string;
  location?: {
    latitude?: number;
    longitude?: number;
    address?: string;
  };
  isAvailable?: boolean;
  lastDonation?: Date;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Helper function to convert Firestore timestamp to Date
const convertTimestampToDate = (timestamp: any): Date | undefined => {
  return timestamp ? new Date(timestamp.seconds * 1000) : undefined;
};

// Helper function to convert FirebaseUser to our User type
//const _createUserObject = (firebaseUser: FirebaseUser, additionalData?: Partial<User>): User => {
//  return {
//    uid: firebaseUser.uid,
//    email: firebaseUser.email,
//    displayName: firebaseUser.displayName,
//    photoURL: firebaseUser.photoURL,
//    phoneNumber: firebaseUser.phoneNumber,
//    ...additionalData
//  };
//};

// Helper function to add or update user in Firestore
const addUserToFirestore = async (
  firebaseUser: FirebaseUser, 
  additionalData?: Partial<User>
): Promise<User> => {
  const userRef: DocumentReference = doc(db, 'users', firebaseUser.uid);
  const userDoc: DocumentSnapshot = await getDoc(userRef);
  
  const userData: Partial<User> = {
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    displayName: firebaseUser.displayName,
    photoURL: firebaseUser.photoURL,
    phoneNumber: firebaseUser.phoneNumber,
    lastLoginAt: new Date(),
    ...additionalData
  };

  // If user doesn't exist, add createdAt timestamp
  if (!userDoc.exists()) {
    userData.createdAt = new Date();
    userData.role = 'donor'; // Default role
    userData.isAvailable = true; // Default availability
  }

  // Merge with existing data
  await setDoc(userRef, {
    ...userData,
    lastLoginAt: serverTimestamp(),
    createdAt: userData.createdAt ? serverTimestamp() : userDoc.data()?.createdAt,
  }, { merge: true });

  // Get the updated user data
  const updatedUserDoc = await getDoc(userRef);
  const updatedUserData = updatedUserDoc.data();

  return {
    ...userData,
    createdAt: convertTimestampToDate(updatedUserData?.createdAt),
    lastLoginAt: convertTimestampToDate(updatedUserData?.lastLoginAt),
    lastDonation: convertTimestampToDate(updatedUserData?.lastDonation),
  } as User;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        if (firebaseUser) {
          // Get user data from Firestore
          const userData = await addUserToFirestore(firebaseUser);
          setUser(userData);
        } else {
          setUser(null);
        }
      } catch (error) {
        console.error('Error in auth state change:', error);
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await addUserToFirestore(userCredential.user);
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  };

  const loginWithGoogle = async (): Promise<void> => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      await addUserToFirestore(result.user);
    } catch (error) {
      console.error('Google login error:', error);
      throw error;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await signOut(auth);
      setUser(null);
    } catch (error) {
      console.error('Logout error:', error);
      throw error;
    }
  };

  const updateUserProfile = async (data: Partial<User>): Promise<void> => {
    if (!user?.uid) throw new Error('No user logged in');
    
    try {
      const userRef = doc(db, 'users', user.uid);
      await setDoc(userRef, {
        ...data,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      // Update local user state
      setUser(prev => prev ? { ...prev, ...data } : null);
    } catch (error) {
      console.error('Profile update error:', error);
      throw error;
    }
  };

  const value: AuthContextType = {
    user,
    loading,
    login,
    loginWithGoogle,
    logout,
    updateUserProfile,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export type { User, AuthContextType };