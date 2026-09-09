import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from "firebase/firestore";
import { firebaseConfig, firebaseEnabled } from "./env";

/**
 * Firebase 초기화.
 *
 * 설정값 자체는 env.ts에 있다. 이 모듈은 SDK를 끌고 오므로, 실제로 동기화를
 * 쓸 때만(동적 import) 불러야 한다.
 */

let app: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

function ensureApp(): FirebaseApp {
  if (!firebaseEnabled) throw new Error("Firebase 설정이 없습니다 (.env.local 확인).");
  app ??= initializeApp(firebaseConfig);
  return app;
}

export function getFirebaseAuth(): Auth {
  authInstance ??= getAuth(ensureApp());
  return authInstance;
}

export function getDb(): Firestore {
  if (!dbInstance) {
    // 오프라인에서도 학습이 끊기지 않도록 로컬 캐시를 켠다 (PRD 7장·9장)
    dbInstance = initializeFirestore(ensureApp(), {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  }
  return dbInstance;
}
