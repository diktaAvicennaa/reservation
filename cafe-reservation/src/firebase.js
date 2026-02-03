import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Konfigurasi dari Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyAGelT2x2FZ-zhRMD1ZQf3JhGkT_SkWZmg",
  authDomain: "reservation-ef3ec.firebaseapp.com",
  projectId: "reservation-ef3ec",
  storageBucket: "reservation-ef3ec.firebasestorage.app",
  messagingSenderId: "1063988719869",
  appId: "1:1063988719869:web:e7b2756202477dd1d94e94",
  measurementId: "G-TQ7B4BVWW5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export service supaya bisa dipakai di file lain
export const db = getFirestore(app); // Database reservasi
export const auth = getAuth(app);    // Login admin