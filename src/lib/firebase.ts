
// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  "projectId": "studio-4280522698-28821",
  "appId": "1:1096112650826:web:49bc9ff8a3aa8beeb244b3",
  "storageBucket": "studio-4280522698-28821.firebasestorage.app",
  "apiKey": "AIzaSyAK_bhpAEx_x_mdtKEXvPoUVdC5LBKpAZk",
  "authDomain": "studio-4280522698-28821.firebaseapp.com",
  "measurementId": "",
  "messagingSenderId": "1096112650826"
};

// Initialize Firebase for client-side
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

export { app, db, auth, storage };

    