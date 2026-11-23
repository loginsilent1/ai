import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
  projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
  appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
};

const configured = Object.values(firebaseConfig).every((value) => Boolean(value));
let app: FirebaseApp | null = null;
let auth: Auth | null = null;

if (configured) {
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  auth = getAuth(app);
}

export const firebaseIsConfigured = configured;

export function observeAuth(callback: (user: User | null) => void): () => void {
  if (!auth) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(auth, callback);
}

export async function ensureGuestSession(): Promise<User | null> {
  if (!auth) return null;
  if (auth.currentUser) return auth.currentUser;
  const credential = await signInAnonymously(auth);
  return credential.user;
}

export async function getIdToken(): Promise<string | null> {
  if (!auth) return null;
  const user = auth.currentUser ?? (await ensureGuestSession());
  return user ? user.getIdToken() : null;
}

export async function emailSignIn(email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase sign-in is not configured for this build.");
  const credential = await signInWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function emailRegister(email: string, password: string): Promise<User> {
  if (!auth) throw new Error("Firebase sign-in is not configured for this build.");
  const current = auth.currentUser;
  if (current?.isAnonymous) {
    const emailCredential = EmailAuthProvider.credential(email, password);
    const linked = await linkWithCredential(current, emailCredential);
    return linked.user;
  }
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  return credential.user;
}

export async function signOutUser(): Promise<void> {
  if (auth) await signOut(auth);
}
