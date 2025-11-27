// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// ★★★ 請將下方的設定換成你自己的 Firebase Config ★★★
const firebaseConfig = {
  apiKey: "AIzaSyB8HJSxbUYWPWt_LKoZMzQdSiA1gQMJvlA",
  authDomain: "tourism-planning-e7e44.firebaseapp.com",
  projectId: "tourism-planning-e7e44",
  storageBucket: "tourism-planning-e7e44.firebasestorage.app",
  messagingSenderId: "725312679774",
  appId: "1:725312679774:web:93be49bdc30a4c5a71a9cf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export default app;