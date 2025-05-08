// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import './assets/style.css' // Importa el CSS con Tailwind
import router from './router'
import Toast, { POSITION } from "vue-toastification";
import "vue-toastification/dist/index.css";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// Add other Firebase imports as needed, e.g., getAuth, getFirestore
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Import the setupAuthListener function
import { setupAuthListener } from './composables/useAuth';


// Your web app's Firebase configuration
// Replace with your actual config object from Firebase console
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// Initialize Firebase
const firebaseApp = initializeApp(firebaseConfig);

// Get Firebase services instances
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Export the auth and db instances so they can be used in other files
export { auth, db };


const options = {
    position: POSITION.TOP_RIGHT, // Where the toasts appear
    timeout: 2000, // How long they last (in ms)
    // You can add many other options here
};

const app = createApp(App)
app.use(router)
app.use(Toast, options);

app.mount('#app');

// AFTER mounting the app, setup the auth listener
// Pass the initialized auth instance
setupAuthListener(auth);

// Optional: Clean up the listener when the app instance unmounts
// This is often handled automatically by Vue's app lifecycle,
// but explicitly calling cleanup can be safer in some scenarios.
/*
app.unmount = (originalUnmount => () => {
    cleanupAuthListener();
    originalUnmount();
})(app.unmount);
*/
