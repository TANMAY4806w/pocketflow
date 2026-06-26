import { auth, db } from "../firebase/client";
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  deleteUser,
  User as FirebaseUser 
} from "firebase/auth";
import { 
  doc, 
  getDoc, 
  setDoc,
  deleteDoc,
  serverTimestamp 
} from "firebase/firestore";
import { UserProfile } from "../../types";

const googleProvider = new GoogleAuthProvider();

export const AuthService = {
  /**
   * Triggers the Google Auth Popup and registers/fetches the UserProfile document.
   */
  async signInWithGoogle(): Promise<UserProfile> {
    const credential = await signInWithPopup(auth, googleProvider);
    const firebaseUser = credential.user;

    const userDocRef = doc(db, "users", firebaseUser.uid);
    const userDoc = await getDoc(userDocRef);

    if (userDoc.exists()) {
      return userDoc.data() as UserProfile;
    } else {
      // Create a new UserProfile
      const newProfile: UserProfile = {
        uid: firebaseUser.uid,
        displayName: firebaseUser.displayName || "User",
        email: firebaseUser.email || "",
        photoURL: firebaseUser.photoURL || null,
        currency: "INR",
        createdAt: new Date(),
        onboarded: false,
        theme: "light",
        notifications: true,
        activeWorkspaceId: firebaseUser.uid, // Default workspace is the user's uid
      };

      await setDoc(userDocRef, {
        ...newProfile,
        createdAt: serverTimestamp(), // Use server timestamp in DB
      });

      return newProfile;
    }
  },

  /**
   * Logs out the currently active user.
   */
  async signOutUser(): Promise<void> {
    await signOut(auth);
  },

  /**
   * Fetches user profile from Firestore by UID.
   */
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    const userDocRef = doc(db, "users", uid);
    const userDoc = await getDoc(userDocRef);
    return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
  },

  /**
   * Permanently deletes the active user's account and profile document.
   * Note: This does NOT recursively delete their ledger data without a Cloud Function.
   */
  async deleteAccount(): Promise<void> {
    const currentUser = auth.currentUser;
    if (!currentUser) throw new Error("No authenticated user found.");
    
    // Delete profile doc first
    const userDocRef = doc(db, "users", currentUser.uid);
    await deleteDoc(userDocRef);
    
    // Delete auth user
    await deleteUser(currentUser);
  }
};
