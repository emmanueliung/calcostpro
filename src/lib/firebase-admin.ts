
import * as admin from 'firebase-admin';

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


if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.applicationDefault(),
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  });
}

const db = admin.firestore();
const auth = admin.auth();
const storage = admin.storage();

export { db, auth, storage };
