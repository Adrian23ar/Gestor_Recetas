// src/main.js
import { createApp } from 'vue'
import App from './App.vue'
import { createPinia } from 'pinia'
import './assets/style.css'
import router from './router'
import Toast, { POSITION } from "vue-toastification";
import "vue-toastification/dist/index.css";
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache } from "firebase/firestore";

import { setupAuthListener } from './composables/useAuth';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);

let db;
try {
    // Intenta inicializar Firestore con persistencia local habilitada
    db = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache(/*{ sizeBytes: 104857600 } Límite opcional de 100MB */)
    });
    console.log("Persistencia offline de Firestore HABILITADA.");
} catch (error) {
    console.error("Error al habilitar la persistencia offline de Firestore:", error);
    // Fallback a la inicialización normal (solo caché en memoria) si la persistencia falla
    db = initializeFirestore(firebaseApp, {});
    console.log("Persistencia offline FALLÓ. Usando caché en memoria.");
}


export { auth, db };


const options = {
    position: POSITION.TOP_RIGHT,
    timeout: 2000,
};

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(Toast, options);

app.mount('#app');
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