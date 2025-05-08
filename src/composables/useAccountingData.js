// src/composables/useAccountingData.js
import { ref, computed, watch } from 'vue';
import { useAuth } from './useAuth';
import { db } from '../main';
import {
    collection,
    doc,
    getDocs,
    setDoc,
    deleteDoc,
    addDoc,
    writeBatch,
    query,
    where,
    orderBy,
    limit,
    Timestamp, // Import if needed, serverTimestamp handles most cases
    serverTimestamp
} from "firebase/firestore";
import { useLocalStorage } from './useLocalStorage';
import { useEventHistory } from './useEventHistory'; // Para registrar eventos

// --- Claves para localStorage ---
const TRANSACTIONS_STORAGE_KEY = 'accountingTransactions';
const RATES_STORAGE_KEY = 'exchangeRates';

// --- Estado Reactivo ---
const transactions = useLocalStorage(TRANSACTIONS_STORAGE_KEY, []);
const exchangeRates = useLocalStorage(RATES_STORAGE_KEY, []); // Array de { id: 'YYYY-MM-DD', date: 'YYYY-MM-DD', rate: number, timestamp: string }
const accountingLoading = ref(true);
const accountingError = ref(null);
const currentDailyRate = ref(null); // La tasa más reciente para hoy o la última registrada

// --- Inicializar Composables ---
const { user, authLoading } = useAuth();
const { addEventHistoryEntry } = useEventHistory();

// --- Funciones Auxiliares (Copiar/Adaptar de useUserData o crear archivo utils) ---

function getFieldLabel(key) {
    const labels = {
        // Campos Comunes
        name: 'Nombre',
        description: 'Descripción',
        notes: 'Notas Adicionales',
        date: 'Fecha',
        category: 'Categoría',
        unit: 'Unidad',

        // Campos de Ingrediente
        cost: 'Costo de Presentación',
        presentationSize: 'Tamaño de Presentación',
        currentStock: 'Stock Actual',

        // Campos de Receta
        ingredients: 'Lista de Ingredientes', // Usado si getIngredientChangeDetails no captura todo
        packagingCostPerBatch: 'Costo Empaque/Lote',
        laborCostPerBatch: 'Mano de Obra/Lote',
        itemsPerBatch: 'Items por Lote',
        profitMarginPercent: '% Margen Ganancia',
        lossBufferPercent: '% Margen Pérdida',

        // Campos de Registro de Producción
        productName: 'Nombre del Producto', // Reutilizado
        batchSize: 'Tamaño del Lote',
        recipeId: 'Receta Asociada',
        totalRevenue: 'Ingresos Totales',
        totalCost: 'Costo Total Producción',
        netProfit: 'Ganancia Neta',

        // Campos de Transacción Contable
        type: 'Tipo Transacción',
        amountBs: 'Monto (Bs.)',
        exchangeRate: 'Tasa de Cambio (Bs/USD)',
        amountUsd: 'Monto (USD)',

        // Campos para cambios detallados de ingredientes (si se usan directamente)
        ingredient_removed: 'Ingrediente Eliminado',
        ingredient_added: 'Ingrediente Añadido',
        ingredient_quantity_updated: 'Cantidad de Ingrediente',
        ingredient_unit_updated: 'Unidad de Ingrediente',

        // Campos de Tasa de Cambio
        rate: 'Tasa (Bs/USD)',

        // Campos de metadatos (generalmente ignorados en 'changes')
        timestamp: 'Fecha del Evento',
        userId: 'ID Usuario',
        userName: 'Nombre Usuario',
        eventType: 'Tipo de Evento',
        entityType: 'Tipo de Entidad',
        entityId: 'ID Entidad',
        entityName: 'Nombre Entidad',
    };
    // Intenta obtener la etiqueta específica, si no, formatea el nombre del campo
    return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

// Simplificado getChangeDetails (ajustar si es necesario para estructuras complejas)
function getChangeDetails(originalObject, updatedObject, ignoreFields = ['id', 'createdAt', 'updatedAt', 'userId']) {
    const changes = [];
    const allKeys = new Set([...Object.keys(originalObject || {}), ...Object.keys(updatedObject || {})]);

    for (const key of allKeys) {
        if (ignoreFields.includes(key)) continue;
        const oldValue = originalObject ? originalObject[key] : undefined;
        const newValue = updatedObject ? updatedObject[key] : undefined;

        // Comparación simple, puede necesitar ajuste para objetos/arrays anidados si los usas
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
                field: key,
                oldValue: oldValue,
                newValue: newValue,
                label: getFieldLabel(key)
            });
        }
    }
    return changes;
}

// --- Funciones Principales del Composable ---

/** Actualiza la ref currentDailyRate basada en las tasas cargadas */
function _updateCurrentDailyRate() {
    if (exchangeRates.value && exchangeRates.value.length > 0) {
        // Asume que exchangeRates.value está ordenado descendente por fecha
        currentDailyRate.value = exchangeRates.value[0].rate;
    } else {
        currentDailyRate.value = null;
    }
    console.log("useAccountingData: currentDailyRate actualizado:", currentDailyRate.value);
}

/** Carga los datos contables (transacciones y tasas) */
let isLoadingData = false;

async function loadAccountingData(userId) {
    // Guarda anti-concurrencia
    if (isLoadingData) {
        console.log(`useAccountingData: Carga para ${userId || 'localStorage'} ya en progreso, omitiendo llamada duplicada.`);
        return;
    }
    isLoadingData = true;
    accountingLoading.value = true;
    accountingError.value = null;
    console.log(`useAccountingData: Iniciando carga contable para usuario: ${userId || 'localStorage'}...`);

    try {
        if (userId) {
            const transactionsColRef = collection(db, `users/${userId}/transactions`);
            const ratesColRef = collection(db, `users/${userId}/exchangeRates`);

            const transQuery = query(transactionsColRef, orderBy("date", "desc"), orderBy("createdAt", "desc")); // Ordenar por fecha y luego por creación
            const ratesQuery = query(ratesColRef, orderBy("date", "desc")); // Tasa más reciente primero

            const [transSnapshot, ratesSnapshot] = await Promise.all([
                getDocs(transQuery),
                getDocs(ratesQuery)
            ]);

            transactions.value = transSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            exchangeRates.value = ratesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            console.log(`useAccountingData: Cargadas ${transactions.value.length} transacciones y ${exchangeRates.value.length} tasas desde Firestore.`);
        } else {
            transactions.value = JSON.parse(localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || '[]');
            exchangeRates.value = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || '[]');
            // Ordenar por si acaso no se guardó ordenado
            exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));
            console.log(`useAccountingData: Cargadas ${transactions.value.length} transacciones y ${exchangeRates.value.length} tasas desde localStorage.`);
        }
        _updateCurrentDailyRate(); // Actualiza la tasa actual después de cargar
    } catch (e) {
        console.error("useAccountingData: Error cargando datos contables:", e);
        accountingError.value = "Error al cargar datos contables.";
        transactions.value = [];
        exchangeRates.value = [];
        currentDailyRate.value = null;
    } finally {
        accountingLoading.value = false;
        isLoadingData = false; // Liberar la bandera
        console.log(`useAccountingData: Carga contable finalizada. accountingLoading = ${accountingLoading.value}`);
    }
}

/** Obtiene la tasa de cambio aplicable para una fecha dada ('YYYY-MM-DD') */
function getRateForDate(targetDateString) {
    if (!exchangeRates.value || exchangeRates.value.length === 0) {
        return null; // No hay tasas disponibles
    }
    // Como están ordenadas DESC, la primera que sea <= targetDate es la correcta
    const foundRate = exchangeRates.value.find(rate => rate.date <= targetDateString);
    return foundRate ? foundRate.rate : null; // Devuelve null si no hay tasa para esa fecha o anterior
}

/** Actualiza o crea la tasa de cambio para el día de HOY */
async function updateDailyRate(rateValue) {
    const rate = Number(rateValue);
    if (isNaN(rate) || rate <= 0) {
        accountingError.value = "La tasa de cambio debe ser un número positivo.";
        console.error("updateDailyRate: Tasa inválida:", rateValue);
        return false;
    }

    const todayDateString = new Date().toISOString().split('T')[0];
    const rateEntry = {
        id: todayDateString, // Usar fecha como ID
        date: todayDateString,
        rate: rate,
        timestamp: user.value ? serverTimestamp() : new Date().toISOString(),
        userId: user.value ? user.value.uid : null,
    };
    // Guardamos la tasa original por si hay que hacer rollback del historial
    const originalRateEntry = exchangeRates.value.find(r => r.id === todayDateString);
    const originalRateValue = originalRateEntry ? originalRateEntry.rate : null;

    // Optimista local (añadir o reemplazar)
    const existingIndex = exchangeRates.value.findIndex(r => r.id === todayDateString);
    if (existingIndex !== -1) {
        exchangeRates.value.splice(existingIndex, 1, rateEntry);
    } else {
        exchangeRates.value.unshift(rateEntry); // Añadir al principio
        // Re-ordenar por si acaso (aunque unshift mantiene el orden si ya estaba ordenado)
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
    }
    _updateCurrentDailyRate(); // Actualizar la tasa actual

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const rateDocRef = doc(db, `users/${user.value.uid}/exchangeRates`, todayDateString);
            // Usar set con ID específico (crea o sobrescribe)
            batch.set(rateDocRef, rateEntry);

            await addEventHistoryEntry({
                eventType: 'EXCHANGE_RATE_UPDATED',
                entityType: 'Tasa de Cambio',
                entityId: todayDateString,
                entityName: `Tasa del ${todayDateString}`,
                changes: [{
                    field: 'rate',
                    oldValue: originalRateValue, // Puede ser null si era la primera del día
                    newValue: rate,
                    label: 'Tasa (Bs/USD)'
                }]
            }, batch);

            await batch.commit();
            console.log("useAccountingData: Tasa de cambio actualizada en Firestore para", todayDateString);
            return true;
        } catch (e) {
            console.error("Error actualizando tasa en Firestore:", e);
            accountingError.value = "Error al guardar la tasa de cambio.";
            // Rollback local
            if (originalRateEntry) {
                if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1, originalRateEntry);
            } else {
                if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1); // Si no había original, la quitamos
                else exchangeRates.value.shift(); // Si la añadimos al principio, la quitamos
            }
            exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date)); // Reordenar
            _updateCurrentDailyRate();
            return false;
        }
    } else {
        // localStorage ya se actualizó por el watch en useLocalStorage
        await addEventHistoryEntry({
            eventType: 'EXCHANGE_RATE_UPDATED',
            entityType: 'Tasa de Cambio',
            entityId: todayDateString,
            entityName: `Tasa del ${todayDateString}`,
            changes: [{
                field: 'rate',
                oldValue: originalRateValue,
                newValue: rate,
                label: 'Tasa (Bs/USD)'
            }]
        });
        return true;
    }
}

/** Añade una nueva transacción de ingreso o egreso */
async function addTransaction(entryData) {
    accountingError.value = null;
    if (!entryData.date || !entryData.description || !entryData.amountBs || !entryData.type) {
        accountingError.value = "Faltan campos requeridos para la transacción.";
        return null;
    }

    const amountBs = Number(entryData.amountBs);
    if (isNaN(amountBs) || amountBs <= 0) {
        accountingError.value = "El monto en Bs. debe ser un número positivo.";
        return null;
    }

    const rateToUse = getRateForDate(entryData.date);
    if (rateToUse === null || rateToUse <= 0) {
        accountingError.value = `No se encontró una tasa de cambio válida para la fecha ${entryData.date}. Por favor, registre la tasa primero.`;
        console.error("addTransaction: Tasa no encontrada o inválida para", entryData.date);
        return null;
    }

    // --- AJUSTE AQUÍ: Redondear al calcular ---
    const calculatedAmountUsd = amountBs / rateToUse;
    const amountUsd = parseFloat(calculatedAmountUsd.toFixed(2)); // Redondear a 2 decimales
    // --- FIN AJUSTE ---
    const transactionEntry = {
        type: entryData.type,
        date: entryData.date,
        description: entryData.description,
        category: entryData.category || 'General',
        amountBs: amountBs,
        exchangeRate: rateToUse,
        amountUsd: amountUsd,
        notes: entryData.notes || '',
        createdAt: user.value ? serverTimestamp() : new Date().toISOString(),
        updatedAt: user.value ? serverTimestamp() : new Date().toISOString(),
        userId: user.value ? user.value.uid : null
    };

    const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    transactions.value.unshift({ ...transactionEntry, id: tempId });
    transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(b.createdAt) - new Date(a.createdAt));

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const transColRef = collection(db, `users/${user.value.uid}/transactions`);
            const newTransDocRef = doc(transColRef);
            const firestoreEntry = { ...transactionEntry }; // Usar serverTimestamp para Firestore
            batch.set(newTransDocRef, firestoreEntry);

            // --- AJUSTE AQUÍ ---
            const changes = getChangeDetails(
                null,
                firestoreEntry, // Comparar contra el objeto que se va a guardar
                ['id', 'createdAt', 'updatedAt', 'userId'] // Ignorar estos campos en 'changes'
            );
            if (changes.length > 0) { // Añadir solo si hay cambios (siempre habrá en creación)
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_CREATED',
                    entityType: transactionEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: newTransDocRef.id,
                    entityName: transactionEntry.description,
                    changes: changes // Usar los cambios filtrados
                }, batch);
            }
            // --- FIN AJUSTE ---


            await batch.commit();

            const localIndex = transactions.value.findIndex(t => t.id === tempId);
            if (localIndex !== -1) {
                transactions.value[localIndex].id = newTransDocRef.id;
                transactions.value[localIndex].createdAt = new Date().toISOString(); // Aproximación local
                transactions.value[localIndex].updatedAt = new Date().toISOString();
            } else {
                console.warn("addTransaction: No se encontró la transacción local con ID temporal", tempId);
                if (!transactions.value.find(t => t.id === newTransDocRef.id)) {
                    transactions.value.unshift({ ...firestoreEntry, id: newTransDocRef.id, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); // Añadir con ID y TS locales
                    transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(a.createdAt) - new Date(b.createdAt));
                }
            }
            return transactions.value.find(t => t.id === newTransDocRef.id);

        } catch (e) {
            console.error("Error al añadir transacción y/o historial a Firestore:", e);
            accountingError.value = "Error al guardar la transacción.";
            transactions.value = transactions.value.filter(t => t.id !== tempId); // Rollback
            return null;
        }
    } else {
        // localStorage
        const localEntry = { ...transactionEntry, id: tempId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; // Usar ISO string

        // --- AJUSTE AQUÍ ---
        const changes = getChangeDetails(
            null,
            localEntry, // Usar el objeto final para localStorage
            ['id', 'createdAt', 'updatedAt', 'userId'] // Ignorar estos campos
        );
        if (changes.length > 0) {
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_CREATED',
                entityType: localEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: localEntry.id,
                entityName: localEntry.description,
                changes: changes
            });
        }
        // --- FIN AJUSTE ---
        return transactions.value.find(t => t.id === tempId); // Ya está en el array por la adición optimista
    }
}


async function saveTransaction(updatedEntryData) {
    accountingError.value = null;
    const index = transactions.value.findIndex(t => t.id === updatedEntryData.id);
    if (index === -1) {
        accountingError.value = "Error: Transacción no encontrada para actualizar.";
        return false;
    }
    const originalTransaction = JSON.parse(JSON.stringify(transactions.value[index]));

    // Validar y procesar datos actualizados
    const amountBs = Number(updatedEntryData.amountBs);
    if (isNaN(amountBs) || amountBs <= 0) {
        accountingError.value = "El monto en Bs. debe ser un número positivo.";
        return false;
    }
    let rateToUse = originalTransaction.exchangeRate;
    let amountUsd = originalTransaction.amountUsd;

    if (originalTransaction.date !== updatedEntryData.date || originalTransaction.amountBs !== amountBs) {
        rateToUse = getRateForDate(updatedEntryData.date);
        if (rateToUse === null || rateToUse <= 0) {
            accountingError.value = `No se encontró una tasa de cambio válida para la nueva fecha ${updatedEntryData.date}.`;
            return false;
        }
        // --- AJUSTE AQUÍ: Redondear al calcular ---
        const calculatedAmountUsd = amountBs / rateToUse;
        amountUsd = parseFloat(calculatedAmountUsd.toFixed(2)); // Redondear a 2 decimales
        // --- FIN AJUSTE ---
    }

    const finalTransactionData = {
        ...updatedEntryData,    // Aplicar cambios de la UI
        amountBs: amountBs,
        exchangeRate: rateToUse,
        amountUsd: amountUsd,
        // Mantener los originales de estos campos, Firestore/localStorage los maneja
        createdAt: originalTransaction.createdAt,
        userId: originalTransaction.userId,
        // Actualizar updatedAt
        updatedAt: user.value ? serverTimestamp() : new Date().toISOString(),
    };

    // Objeto para Firestore (sin ID)
    const firestoreEntry = { ...finalTransactionData };
    delete firestoreEntry.id;

    // Objeto para estado local y localStorage (con ID)
    const localEntry = { ...finalTransactionData };

    // Optimista local
    transactions.value.splice(index, 1, localEntry);
    transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(a.createdAt) - new Date(b.createdAt));

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const transDocRef = doc(db, `users/${user.value.uid}/transactions`, updatedEntryData.id);
            batch.set(transDocRef, firestoreEntry, { merge: true }); // Usar merge true es más seguro para updates

            // --- AJUSTE AQUÍ ---
            const changes = getChangeDetails(
                originalTransaction, // El objeto antes de cualquier cambio
                localEntry,          // El objeto final con todos los cambios aplicados
                ['id', 'createdAt', 'updatedAt', 'userId'] // Ignorar metadatos
            );
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_EDITED',
                    entityType: finalTransactionData.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: updatedEntryData.id,
                    entityName: finalTransactionData.description,
                    changes: changes // Cambios filtrados
                }, batch);
            }
            // --- FIN AJUSTE ---

            await batch.commit();

            // Actualizar timestamp local post-commit
            const currentLocalEntry = transactions.value.find(t => t.id === updatedEntryData.id);
            if (currentLocalEntry) currentLocalEntry.updatedAt = new Date().toISOString(); // Aproximación

            return true;
        } catch (e) {
            console.error("Error al actualizar transacción y/o historial en Firestore:", e);
            accountingError.value = "Error al guardar cambios de la transacción.";
            transactions.value.splice(index, 1, originalTransaction); // Rollback
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(a.createdAt) - new Date(b.createdAt));
            return false;
        }
    } else {
        // localStorage ya se actualizó
        // --- AJUSTE AQUÍ ---
        const changes = getChangeDetails(
            originalTransaction,
            localEntry,
            ['id', 'createdAt', 'updatedAt', 'userId']
        );
        if (changes.length > 0) {
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_EDITED',
                entityType: localEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: localEntry.id,
                entityName: localEntry.description,
                changes: changes
            });
        }
        // --- FIN AJUSTE ---
        return true;
    }
}


async function deleteTransaction(transactionId) {
    accountingError.value = null;
    const index = transactions.value.findIndex(t => t.id === transactionId);
    if (index === -1) {
        accountingError.value = "Error: Transacción no encontrada para eliminar.";
        return false;
    }
    const transactionToDelete = JSON.parse(JSON.stringify(transactions.value[index]));

    transactions.value.splice(index, 1); // Optimista local

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const transDocRef = doc(db, `users/${user.value.uid}/transactions`, transactionId);
            batch.delete(transDocRef);

            // --- AJUSTE AQUÍ ---
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_DELETED',
                entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: transactionId,
                entityName: transactionToDelete.description,
                changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({ // Ignorar metadatos
                    field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            }, batch);
            // --- FIN AJUSTE ---

            await batch.commit();
            return true;
        } catch (e) {
            console.error("Error al eliminar transacción y/o historial de Firestore:", e);
            accountingError.value = "Error al eliminar la transacción.";
            transactions.value.splice(index, 0, transactionToDelete); // Rollback
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || new Date(a.createdAt) - new Date(b.createdAt));
            return false;
        }
    } else {
        // localStorage ya se actualizó
        // --- AJUSTE AQUÍ ---
        await addEventHistoryEntry({
            eventType: 'TRANSACTION_DELETED',
            entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
            entityId: transactionId,
            entityName: transactionToDelete.description,
            changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({ // Ignorar metadatos
                field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
            }))
        });
        // --- FIN AJUSTE ---
        return true;
    }
}

// --- Funciones de Cálculo y Filtrado (Plan C - básicas) ---

function getFilteredTransactions(options = {}) {
    const { startDate, endDate, type, category } = options;
    return transactions.value.filter(tx => {
        let keep = true;
        if (type && type !== 'all' && tx.type !== type) {
            keep = false;
        }
        if (category && tx.category !== category) {
            keep = false;
        }
        if (startDate && tx.date < startDate) {
            keep = false;
        }
        if (endDate && tx.date > endDate) {
            keep = false;
        }
        return keep;
    });
}

function calculateSummary(filteredList) {
    let totalIncome = 0;
    let totalExpenses = 0;
    filteredList.forEach(tx => {
        if (tx.type === 'income') {
            totalIncome += tx.amountBs || 0;
        } else if (tx.type === 'expense') {
            totalExpenses += tx.amountBs || 0;
        }
    });
    return {
        totalIncome,
        totalExpenses,
        netBalance: totalIncome - totalExpenses
    };
}

watch(
    () => ({ u: user.value, al: authLoading.value }), // Observa un objeto con user y authLoading
    (currentState, prevState) => {
        const currentUid = currentState.u ? currentState.u.uid : null;

        console.log(`useAccountingData: Watcher combinado activado. User: ${currentUid}, AuthLoading: ${currentState.al}`);

        if (currentState.al === false) { // Solo proceder si la autenticación está resuelta
            // Esto se activará en la carga inicial (cuando authLoading pase a false)
            // y también cuando el usuario inicie o cierre sesión.
            console.log(`useAccountingData: Auth resuelto. Llamando loadAccountingData(${currentUid || 'null'}).`);
            loadAccountingData(currentUid); // loadAccountingData ya maneja la lógica de Firestore vs localStorage
        } else if (currentState.al === true) {
            // La autenticación está en proceso
            if (!accountingLoading.value) {
                accountingLoading.value = true;
                accountingError.value = null;
                console.log(`useAccountingData: Auth está cargando. Estableciendo accountingLoading a true.`);
            }
        }
    },
    { deep: true, immediate: true }
);


// --- Exportar ---
export function useAccountingData() {
    return {
        transactions,
        exchangeRates,
        currentDailyRate,
        accountingLoading,
        accountingError,
        loadAccountingData,
        getRateForDate,
        updateDailyRate,
        addTransaction,
        saveTransaction,
        deleteTransaction,
        getFilteredTransactions,
        calculateSummary,
    };
}