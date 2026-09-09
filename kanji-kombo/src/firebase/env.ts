/**
 * Firebase 설정값만 담는 모듈. **firebase SDK를 import하지 않는다.**
 *
 * `firebaseEnabled`를 여기서 읽어야 로컬 전용으로 쓸 때 SDK 청크를 아예
 * 내려받지 않는다. (client.ts를 참조하는 순간 SDK가 초기 번들에 딸려온다)
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const firebaseEnabled = Boolean(
  firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId,
);

/**
 * 이 앱이 쓰는 Firestore 최상위 컬렉션.
 *
 * 기존 프로젝트에 앱만 추가하는 구성이라, 다른 앱의 컬렉션과 섞이지 않도록
 * 반드시 이 이름 아래에만 쓴다. 문서 하나가 사용자 한 명의 전체 학습 기록이다.
 */
export const ROOT_COLLECTION = "kanjiKombo";
