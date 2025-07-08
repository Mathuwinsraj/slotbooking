import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFunctions } from "firebase/functions";

const firebaseConfig = {
  apiKey: "AIzaSyDCrvnyqX4BZVhqRP6m3SaglE3EYKLWTT8",
  authDomain: "slot-sync-ai.firebaseapp.com",
  projectId: "slot-sync-ai",
  storageBucket: "slot-sync-ai.firebasestorage.app",
  messagingSenderId: "986193658136",
  appId: "1:986193658136:web:dbbdb55ce285b1e5fd1e6d",
  measurementId: "G-DWQKNQD9K5"
};

const app = initializeApp(firebaseConfig);

const db = getFirestore(app);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();
const functions = getFunctions(app, "us-central1");

export { db, auth, provider, functions };
