import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getStorage, connectStorageEmulator } from "firebase/storage";

const firebaseConfig = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const db = getFirestore(app);
export const storage = getStorage(app);

// Connect to local emulators in development if true
if (
	process.env.NODE_ENV === "development" &&
	process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATORS
) {
	try {
		connectFirestoreEmulator(db, "127.0.0.1", 8080);
		connectStorageEmulator(storage, "127.0.0.1", 9199);
		console.log("Connected to Firebase Emulators");
	} catch (e) {
		// Ignore if already connected
	}
}

export default app;
