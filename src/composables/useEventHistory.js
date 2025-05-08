// src/composables/useEventHistory.js
import { ref } from 'vue';
import { useAuth } from './useAuth';
import { db } from '../main'; // Tu instancia de Firestore
import { collection, addDoc, serverTimestamp, Timestamp, writeBatch, doc } from "firebase/firestore";
import { useLocalStorage } from './useLocalStorage';

// Clave para localStorage
const EVENT_HISTORY_STORAGE_KEY = 'eventHistoryLog';

// Estado reactivo para el historial (si decides cargarlo aquí, aunque es más común cargarlo en la vista)
// Por ahora, nos enfocaremos en la escritura.
const eventHistoryLog = useLocalStorage(EVENT_HISTORY_STORAGE_KEY, []);
const historyLoading = ref(false);
const historyError = ref(null);

export function useEventHistory() {
    const { user } = useAuth();

    /**
     * Añade una entrada al historial de eventos.
     * @param {Object} eventData - Objeto con los datos del evento.
     * @param {import("firebase/firestore").WriteBatch} [existingBatch] - Un batch de Firestore existente para incluir esta escritura.
     * @returns {Promise<string|null>} El ID de la entrada de historial creada o null si falla.
     */
    async function addEventHistoryEntry(eventData, existingBatch = null) {
        if (!eventData.eventType || !eventData.entityType) {
            console.error("useEventHistory: eventType y entityType son requeridos.", eventData);
            return null;
        }

        const newEntry = {
            ...eventData, // Debe incluir entityId, entityName, changes, etc.
            timestamp: user.value ? serverTimestamp() : new Date().toISOString(), // Firestore timestamp o ISO string
            userId: user.value ? user.value.uid : null,
            userName: user.value ? (user.value.displayName || user.value.email) : 'Sistema (localStorage)',
        };

        // Eliminar el ID si venía en eventData, ya que Firestore/localStorage lo generará
        delete newEntry.id;

        if (user.value) {
            try {
                const historyCollectionRef = collection(db, `users/${user.value.uid}/eventHistory`);
                if (existingBatch) {
                    const newDocRef = doc(historyCollectionRef); // Genera un ID para usar en el batch
                    existingBatch.set(newDocRef, newEntry);
                    console.log("useEventHistory: Entrada de historial añadida al batch de Firestore.");
                    return newDocRef.id; // Devolvemos el ID que se usará en el batch
                } else {
                    const docRef = await addDoc(historyCollectionRef, newEntry);
                    console.log("useEventHistory: Entrada de historial añadida a Firestore con ID:", docRef.id);
                    return docRef.id;
                }
            } catch (e) {
                console.error("useEventHistory: Error añadiendo entrada de historial a Firestore:", e, newEntry);
                historyError.value = "Error al guardar historial en servidor.";
                // Fallback a localStorage si Firestore falla? Podría ser una opción, pero puede complicar.
                // Por ahora, solo logueamos el error.
                return null;
            }
        } else {
            // Guardar en localStorage
            const newId = Date.now().toString() + Math.random().toString(36).substring(2, 9);
            const entryWithId = { ...newEntry, id: newId, timestamp: new Date().toISOString() }; // Asegurar timestamp ISO y ID local

            const currentHistory = JSON.parse(localStorage.getItem(EVENT_HISTORY_STORAGE_KEY) || '[]');
            currentHistory.unshift(entryWithId); // Añadir al principio para orden cronológico inverso
            localStorage.setItem(EVENT_HISTORY_STORAGE_KEY, JSON.stringify(currentHistory));
            // Actualizar la ref de useLocalStorage si se está usando directamente
            eventHistoryLog.value = currentHistory;
            console.log("useEventHistory: Entrada de historial añadida a localStorage con ID:", newId);
            return newId;
        }
    }

    /**
     * Obtiene todas las entradas del historial.
     * (Implementación básica, podría necesitar paginación/filtros más adelante)
     */
    async function getEventHistory() {
        historyLoading.value = true;
        historyError.value = null;
        try {
            if (user.value) {
                // const historyColRef = collection(db, `users/${user.value.uid}/eventHistory`);
                // const q = query(historyColRef, orderBy("timestamp", "desc")); // Ejemplo de ordenamiento
                // const snapshot = await getDocs(q);
                // eventHistoryLog.value = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                // Por ahora, retornamos el valor de localStorage que podría estar sincronizado si se usan listeners,
                // o se podría implementar la carga directa aquí. Para la vista, es mejor cargarla allí.
                // Esta función podría ser más para uso interno si es necesario.
                // Para la vista del historial, es mejor que la vista misma gestione su propia carga.
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
        getEventHistory, // Aunque la vista del historial probablemente tendrá su propia lógica de carga
        historyLoading,  // Estado de carga para la vista
        historyError     // Estado de error para la vista
    };
}