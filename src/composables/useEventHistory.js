// src/composables/useEventHistory.js
import { ref } from 'vue';
import { useAuth } from './useAuth';
import { db } from '../main';
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from "firebase/firestore";
import { useLocalStorage } from './useLocalStorage';

const EVENT_HISTORY_STORAGE_KEY = 'eventHistoryLog';
const eventHistoryLog = useLocalStorage(EVENT_HISTORY_STORAGE_KEY, []);
const historyLoading = ref(false);
const historyError = ref(null); // Este es el error que se setea en este composable

export function useEventHistory() {
    const { user } = useAuth();

    async function addEventHistoryEntry(eventData, existingBatch = null) {
        historyError.value = null; // Limpiar error previo de este composable
        if (!eventData.eventType || !eventData.entityType) {
            console.error("useEventHistory: eventType y entityType son requeridos.", eventData);
            historyError.value = "Datos incompletos para registrar historial (eventType/entityType).";
            return null;
        }

        const baseEntryInfo = {
            timestamp: user.value ? serverTimestamp() : new Date().toISOString(),
            userId: user.value ? user.value.uid : null,
            userName: user.value ? (user.value.displayName || user.value.email) : 'Sistema (localStorage)',
        };

        const eventDetails = { ...eventData };
        delete eventDetails.id;
        delete eventDetails.timestamp;
        delete eventDetails.userId;
        delete eventDetails.userName;

        // Función recursiva para reemplazar undefined con null en el objeto y sus arrays/objetos anidados
        function sanitizeForFirestore(obj) {
            if (obj === null || typeof obj !== 'object') {
                return obj === undefined ? null : obj;
            }
            if (Array.isArray(obj)) {
                return obj.map(sanitizeForFirestore);
            }
            const newObj = {};
            for (const key in obj) {
                if (Object.prototype.hasOwnProperty.call(obj, key)) {
                    const value = obj[key];
                    newObj[key] = value === undefined ? null : sanitizeForFirestore(value);
                }
            }
            return newObj;
        }

        const sanitizedEventDetails = sanitizeForFirestore(eventDetails);

        if (user.value) {
            const batch = existingBatch || writeBatch(db);
            let historyDocRef;
            try {
                const historyCollectionRef = collection(db, `users/${user.value.uid}/eventHistory`);
                historyDocRef = doc(historyCollectionRef);

                const entryToSaveInFirestore = {
                    ...sanitizedEventDetails, // Usar el objeto sanitizado
                    ...baseEntryInfo
                };

                // Loguear el objeto justo antes de enviarlo a Firestore para depuración profunda
                // console.debug("useEventHistory: Objeto a guardar en Firestore:", JSON.stringify(entryToSaveInFirestore, null, 2));


                batch.set(historyDocRef, entryToSaveInFirestore);
                // console.log("useEventHistory: Entrada de historial preparada para batch de Firestore.");

                if (!existingBatch) {
                    await batch.commit();
                    // console.log("useEventHistory: Entrada de historial añadida a Firestore con ID:", historyDocRef.id);
                }
                return historyDocRef.id;

            } catch (e) {
                const entryAttempted = { ...sanitizedEventDetails, ...baseEntryInfo, timestamp: "_SERVER_TIMESTAMP_PLACEHOLDER_DEBUG_" };
                console.error("useEventHistory: Error DIRECTO añadiendo entrada de historial a Firestore:", e, "Objeto intentado:", JSON.stringify(entryAttempted, null, 2));
                historyError.value = `Error al guardar historial en servidor: ${e.message}`;
                return null;
            }
        } else {
            // Guardar en localStorage
            const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
            const entryWithId = {
                ...sanitizedEventDetails, // Usar sanitizado también para localStorage por consistencia
                ...baseEntryInfo,
                id: newId,
                timestamp: new Date().toISOString()
            };
            const currentHistory = JSON.parse(localStorage.getItem(EVENT_HISTORY_STORAGE_KEY) || '[]');
            currentHistory.unshift(entryWithId);
            localStorage.setItem(EVENT_HISTORY_STORAGE_KEY, JSON.stringify(currentHistory));
            eventHistoryLog.value = currentHistory;
            // console.log("useEventHistory: Entrada de historial añadida a localStorage con ID:", newId);
            return newId;
        }
    }

    async function getEventHistory() {
        // ... (sin cambios)
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
        historyError // Asegúrate de que este error se esté usando/observando donde sea necesario
    };
}