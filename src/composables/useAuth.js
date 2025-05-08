// src/composables/useAuth.js
import { ref } from 'vue';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { useToast } from "vue-toastification"; // Importa el composable useToast

// --- Import auth instance statically ---
// auth is initialized and exported from main.js
import { auth } from '../main';
// --- End static import ---

const user = ref(null);
const authLoading = ref(true);
let unsubscribeAuth = null;
let isListenerSetup = false;

export function setupAuthListener(authInstance) {
    if (!isListenerSetup) {
        const toast = useToast();
        // ... (rest of setupAuthListener logic) ...
        unsubscribeAuth = onAuthStateChanged(authInstance, (firebaseUser) => {
             user.value = firebaseUser;
             authLoading.value = false;
        });
        isListenerSetup = true;
    }
}

export function cleanupAuthListener() {
    const toast = useToast();
    // toast.info('Limpiando el listener global de autenticación.');
    if (unsubscribeAuth) {
        unsubscribeAuth();
        unsubscribeAuth = null;
        isListenerSetup = false;
        // toast.success('Listener global de autenticación limpiado exitosamente.');
    }
}

export function useAuth() {
    const toast = useToast();

    async function signInWithGoogle() {
        // --- REMOVE the dynamic import here ---
        // const { auth } = await import('../main'); // <-- REMOVE THIS LINE
        const provider = new GoogleAuthProvider();
        try {
            // Use the statically imported 'auth' instance
            const result = await signInWithPopup(auth, provider); // <-- Use imported 'auth'
            const firebaseUser = result.user;
            toast.success(`Sesión iniciada exitosamente: ${firebaseUser.email}`);
        } catch (error) {
             // ... (error handling) ...
        }
    }

    async function signOutUser() {
        // --- REMOVE the dynamic import here ---
        // const { auth } = await import('../main'); // <-- REMOVE THIS LINE
        try {
            // Use the statically imported 'auth' instance
            await signOut(auth); // <-- Use imported 'auth'
            toast.success('Sesión cerrada exitosamente.');
        } catch (error) {
             // ... (error handling) ...
        }
    }

    return {
        user,
        authLoading,
        signInWithGoogle,
        signOutUser
    };
}