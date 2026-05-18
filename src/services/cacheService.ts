import { 
  Query, 
  getDocsFromCache, 
  getDocsFromServer, 
  DocumentData, 
  QuerySnapshot,
  DocumentReference,
  getDocFromCache,
  getDocFromServer,
  DocumentSnapshot
} from "firebase/firestore";

/**
 * Custom caching service to optimize Firestore reads.
 * Uses sessionStorage to track when we last fetched from server.
 * If within maxAgeMs, we try to read from the local Firestore cache first.
 */
export const getDocsWithCache = async (
  q: Query<DocumentData, DocumentData>,
  cacheKey: string,
  maxAgeMs = 1000 * 60 * 5 // default 5 minutes
): Promise<QuerySnapshot<DocumentData, DocumentData>> => {
  const cachedTime = sessionStorage.getItem(`${cacheKey}_time`);
  const now = Date.now();
  
  if (cachedTime && now - parseInt(cachedTime) < maxAgeMs) {
    try {
      const snap = await getDocsFromCache(q);
      if (!snap.empty) {
        return snap;
      }
    } catch(e) {
      // Ignore cache miss, fall through to server fetch
    }
  }

  const snap = await getDocsFromServer(q);
  // Only update time if we got a successful server read
  sessionStorage.setItem(`${cacheKey}_time`, now.toString());
  return snap;
};

export const getDocWithCache = async (
  ref: DocumentReference<DocumentData, DocumentData>,
  cacheKey: string,
  maxAgeMs = 1000 * 60 * 5
): Promise<DocumentSnapshot<DocumentData, DocumentData>> => {
  const cachedTime = sessionStorage.getItem(`${cacheKey}_time`);
  const now = Date.now();

  if (cachedTime && now - parseInt(cachedTime) < maxAgeMs) {
    try {
      const snap = await getDocFromCache(ref);
      if (snap.exists()) {
        return snap;
      }
    } catch(e) {
      // Ignore
    }
  }

  const snap = await getDocFromServer(ref);
  sessionStorage.setItem(`${cacheKey}_time`, now.toString());
  return snap;
};
