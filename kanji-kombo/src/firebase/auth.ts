import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type User,
} from "firebase/auth";
import { getFirebaseAuth } from "./client";
import { firebaseEnabled } from "./env";

export interface SyncUser {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

function toSyncUser(user: User): SyncUser {
  return {
    uid: user.uid,
    displayName: user.displayName,
    email: user.email,
    photoURL: user.photoURL,
  };
}

/** 로그인 상태를 구독한다. Firebase 설정이 없으면 아무것도 하지 않는다. */
export function observeAuth(onChange: (user: SyncUser | null) => void): () => void {
  if (!firebaseEnabled) {
    onChange(null);
    return () => {};
  }
  return onAuthStateChanged(getFirebaseAuth(), (user) => {
    onChange(user ? toSyncUser(user) : null);
  });
}

export async function signInWithGoogle(): Promise<void> {
  const provider = new GoogleAuthProvider();
  // 개인용 앱이라 계정 선택 화면을 매번 띄워 실수로 다른 계정에 붙는 일을 줄인다
  provider.setCustomParameters({ prompt: "select_account" });
  await signInWithPopup(getFirebaseAuth(), provider);
}

export async function signOutUser(): Promise<void> {
  await signOut(getFirebaseAuth());
}
