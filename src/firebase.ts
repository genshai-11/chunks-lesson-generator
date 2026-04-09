import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

export interface AuthActionResult {
  ok: boolean;
  code?: string;
  message?: string;
  host?: string;
}

export const signInWithGoogle = async (): Promise<AuthActionResult> => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
    return { ok: true };
  } catch (error: any) {
    const code = error?.code || 'auth/unknown';
    const host = typeof window !== 'undefined' ? window.location.hostname : undefined;

    if (code === 'auth/unauthorized-domain') {
      const message = `This domain is not authorized in Firebase Authentication. Add '${host}' to Firebase Authentication > Settings > Authorized domains.`;
      console.error('Error signing in with Google', { code, host, error });
      return {
        ok: false,
        code,
        host,
        message,
      };
    }

    const message = error?.message || 'Failed to sign in with Google.';
    console.error('Error signing in with Google', error);
    return {
      ok: false,
      code,
      host,
      message,
    };
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out', error);
  }
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string;
    email?: string | null;
    emailVerified?: boolean;
    isAnonymous?: boolean;
    tenantId?: string | null;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
