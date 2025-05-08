// src/composables/useAuth.js
import { ref } from 'vue';
import { GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { useToast } from "vue-toastification";
import { auth } from '../main';


const user = ref(null);
const authLoading = ref(true);
let unsubscribeAuth = null;
let isListenerSetup = false;

export function setupAuthListener(authInstance) {
    if (!isListenerSetup) {
        unsubscribeAuth = onAuthStateChanged(authInstance, (rawFirebaseUser) => {
            if (rawFirebaseUser) {
                // Crea un objeto "limpio" con solo los datos que necesitas
                const currentUserData = {
                    uid: rawFirebaseUser.uid,
                    email: rawFirebaseUser.email,
                    displayName: rawFirebaseUser.displayName,
                    photoURL: rawFirebaseUser.photoURL,
                    emailVerified: rawFirebaseUser.emailVerified,
                    // Puedes añadir otras propiedades que utilices, por ejemplo:
                    // providerId: rawFirebaseUser.providerData[0]?.providerId, // Para saber si es google.com, etc.
                };
                console.log("Datos del usuario procesados:", currentUserData);
                user.value = currentUserData;
            } else {
                user.value = null;
            }
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
        const provider = new GoogleAuthProvider();
        try {
            const result = await signInWithPopup(auth, provider);
            // Firebase se encargará de llamar a onAuthStateChanged,
            // y el objeto 'user.value' se actualizará allí con los datos limpios.
            // El 'result.user' aquí también es el objeto "crudo".
            toast.success(`Autenticación con Google exitosa para: ${result.user.email}`);
        } catch (error) {
            console.error("Error durante el inicio de sesión con Google:", error);
            toast.error(`Error al iniciar sesión: ${error.message}`);
            // Manejar errores específicos como popup cerrado por el usuario, etc.
            if (error.code === 'auth/popup-closed-by-user') {
                toast.info('El proceso de inicio de sesión fue cancelado.');
            } else if (error.code === 'auth/cancelled-popup-request') {
                toast.info('Se canceló la solicitud de inicio de sesión.');
            } else {
                toast.error(`Error de autenticación: ${error.message}`);
            }
        }
    }

    async function signOutUser() {
        try {
            await signOut(auth);
            // onAuthStateChanged se encargará de poner user.value a null
            toast.success('Sesión cerrada exitosamente.');
        } catch (error) {
            console.error("Error durante el cierre de sesión:", error);
            toast.error(`Error al cerrar sesión: ${error.message}`);
        }
    }


    return {
        user,
        authLoading,
        signInWithGoogle,
        signOutUser
    };
}