import { collection, doc, getDoc, getDocs, orderBy, query } from 'firebase/firestore';
import { auth, db } from '../firebase';

function normalizeValue(value: any): any {
  if (value == null) return value;
  if (Array.isArray(value)) return value.map(normalizeValue);
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  if (typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(item)]));
  }
  return value;
}

async function readCollection(path: string) {
  const snapshot = await getDocs(query(collection(db, path), orderBy('createdAt', 'desc'))).catch(async () => getDocs(collection(db, path)));
  return snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...normalizeValue(docSnap.data()) }));
}

async function readSetting(key: string) {
  const snap = await getDoc(doc(db, 'workspaces/default/settings', key));
  return snap.exists() ? normalizeValue(snap.data()) : null;
}

export async function exportFirebaseWorkspace() {
  if (!auth.currentUser) {
    throw new Error('Please sign in with Firebase before running migration.');
  }

  const [resources, chunks, cvrHistory, aiSettings, baseOhms] = await Promise.all([
    readCollection('workspaces/default/resources'),
    readCollection('workspaces/default/chunks'),
    readCollection('workspaces/default/cvr_history'),
    readSetting('ai'),
    readSetting('baseOhms'),
  ]);

  return {
    resources,
    chunks,
    cvrHistory,
    settings: {
      ai: aiSettings,
      baseOhms,
    },
  };
}
