// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ★★★ 請將下方的設定換成你自己的 Firebase Config ★★★
const firebaseConfig = {
  apiKey: "你的_API_KEY",
  authDomain: "你的_PROJECT_ID.firebaseapp.com",
  projectId: "你的_PROJECT_ID",
  storageBucket: "你的_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "你的_SENDER_ID",
  appId: "你的_APP_ID"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;