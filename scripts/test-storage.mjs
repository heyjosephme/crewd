// Throwaway: verifies a real upload to Firebase Storage works (bucket + rules).
// Run: node --env-file=.env.local scripts/test-storage.mjs
import { getApp, getApps, initializeApp } from "firebase/app";
import { getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

const cfg = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length ? getApp() : initializeApp(cfg);
const storage = getStorage(app);
const r = ref(storage, `__test__/hello-${Date.now()}.txt`);

try {
  await uploadBytes(r, new TextEncoder().encode("hello from crewd"), {
    contentType: "text/plain",
  });
  const url = await getDownloadURL(r);
  console.log("STORAGE_OK", url);
  process.exit(0);
} catch (e) {
  console.error("STORAGE_ERROR:", e?.code || "", e?.message || String(e));
  process.exit(2);
}
