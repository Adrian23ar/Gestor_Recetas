// src/composables/useEventHistory.js
import { ref } from 'vue';
import { useAuth } from './useAuth';
import { db } from '../main';
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from "firebase/firestore";
import { useLocalStorage } from './useLocalStorage';

const EVENT_HISTORY_STORAGE_KEY = 'eventHistoryLog';
const eventHistoryLog = useLocalStorage(EVENT_HISTORY_STORAGE_KEY, []);
const historyLoading = ref(false);
const historyError = ref(null);

export function useEventHistory() {
    const { user } = useAuth();

    async function addEventHistoryEntry(eventData, existingBatch = null) {
        if (!eventData.eventType || !eventData.entityType) {
            console.error("useEventHistory: eventType y entityType son requeridos.", eventData);
            return null;
        }

        // Objeto base con la información del usuario y el timestamp correcto
        const baseEntryInfo = {
            timestamp: user.value ? serverTimestamp() : new Date().toISOString(),
            userId: user.value ? user.value.uid : null,
            userName: user.value ? (user.value.displayName || user.value.email) : 'Sistema (localStorage)',
        };

        // Objeto con el resto de los datos del evento (sin timestamp, userId, userName, id)
        const eventDetails = { ...eventData };
        delete eventDetails.id;
        delete eventDetails.timestamp; // Eliminar si accidentalmente se pasó
        delete eventDetails.userId;
        delete eventDetails.userName;

        if (user.value) {
            const batch = existingBatch || writeBatch(db); // Usa el batch existente o crea uno nuevo
            let historyDocRef;
            try {
                const historyCollectionRef = collection(db, `users/${user.value.uid}/eventHistory`);
                historyDocRef = doc(historyCollectionRef); // Genera la referencia con ID

                // --- MODIFICACIÓN CLAVE ---
                // Crear el objeto para Firestore, AHORA incluyendo serverTimestamp()
                // PERO asegurándonos de que se maneje correctamente.
                // Firestore *sí* permite serverTimestamp a nivel raíz, el problema
                // parece ser la combinación con arrays anidados DENTRO de la misma operación set/update en batch.
                // Intentemos pasar el objeto completo con serverTimestamp() directamente.
                // Si esto sigue fallando, el siguiente paso es reemplazarlo por null aquí
                // y confiar en reglas de seguridad o triggers para poner el timestamp.

                const entryToSaveInFirestore = {
                    ...eventDetails, // changes, entityType, etc.
                    ...baseEntryInfo // timestamp (serverTimestamp), userId, userName
                };
                // --- FIN MODIFICACIÓN CLAVE ---

                batch.set(historyDocRef, entryToSaveInFirestore);
                console.log("useEventHistory: Entrada de historial preparada para batch de Firestore.");

                // Solo hacemos commit si creamos el batch aquí
                if (!existingBatch) {
                    await batch.commit();
                    console.log("useEventHistory: Entrada de historial añadida a Firestore con ID:", historyDocRef.id);
                }
                return historyDocRef.id;

            } catch (e) {
                // Intentemos loguear el objeto problemático
                const entryToSaveInFirestoreForError = {
                    ...eventDetails,
                    timestamp: "_SERVER_TIMESTAMP_PLACEHOLDER_", // Reemplazar para loguear
                    userId: baseEntryInfo.userId,
                    userName: baseEntryInfo.userName
                };
                console.error("useEventHistory: Error añadiendo entrada de historial a Firestore:", e, entryToSaveInFirestoreForError);
                historyError.value = "Error al guardar historial en servidor.";
                return null;
            }
        } else {
            // Guardar en localStorage (sin cambios aquí)
            const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
            const entryWithId = {
                ...eventDetails,
                ...baseEntryInfo,
                id: newId,
                timestamp: new Date().toISOString() // Asegurar ISO string aquí
            };
            const currentHistory = JSON.parse(localStorage.getItem(EVENT_HISTORY_STORAGE_KEY) || '[]');
            currentHistory.unshift(entryWithId);
            localStorage.setItem(EVENT_HISTORY_STORAGE_KEY, JSON.stringify(currentHistory));
            eventHistoryLog.value = currentHistory;
            console.log("useEventHistory: Entrada de historial añadida a localStorage con ID:", newId);
            return newId;
        }
    }

    async function getEventHistory() {
        historyLoading.value = true;
        historyError.value = null;
        try {
            if (user.value) {
                console.warn("getEventHistory desde useEventHistory leerá de localStorage por ahora. La vista debería implementar su propia carga de Firestore.");
                return JSON.parse(localStorage.getItem(EVENT_HISTORY_STORAGE_KEY) || '[]');

            } else {
                eventHistoryLog.value = JSON.parse(localStorage.getItem(EVENT_HISTORY_STORAGE_KEY) || '[]');
                return eventHistoryLog.value;
            }
        } catch (e) {
            console.error("useEventHistory: Error obteniendo historial:", e);
            historyError.value = "Error al cargar historial.";
            return [];
        } finally {
            historyLoading.value = false;
        }
    }

    return {
        addEventHistoryEntry,
        getEventHistory,
        historyLoading,
        historyError
    };
}