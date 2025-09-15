// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAybASpS7-XezcHEOKY4XKo-PKoSQTImlM",
  authDomain: "screener-d132c.firebaseapp.com",
  projectId: "screener-d132c",
  storageBucket: "screener-d132c.firebasestorage.app",
  messagingSenderId: "740175354901",
  appId: "1:740175354901:web:eb53bfc4fbcd6cfc82821c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

export default app;