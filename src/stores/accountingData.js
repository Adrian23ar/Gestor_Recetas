// src/composables/useAccountingData.js
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useAuth } from '../composables/useAuth';
import { db } from '../main';
import { collection, doc, getDocs, setDoc, deleteDoc, addDoc, writeBatch, query, where, orderBy, limit, Timestamp, serverTimestamp } from "firebase/firestore";
import { useLocalStorage } from '../composables/useLocalStorage';
import { useEventHistory } from '../composables/useEventHistory';

export const useAccountingDataStore = defineStore('accountingData', () => {
    // --- Claves para localStorage ---
    const TRANSACTIONS_STORAGE_KEY = 'accountingTransactions';
    const RATES_STORAGE_KEY = 'exchangeRates';

    // --- Estado Reactivo ---
    const transactions = useLocalStorage(TRANSACTIONS_STORAGE_KEY, []);
    const exchangeRates = useLocalStorage(RATES_STORAGE_KEY, []);
    const accountingLoading = ref(true);
    const rateFetchingLoading = ref(false);
    const specificDateRateFetchingLoading = ref(false);
    const accountingError = ref(null);
    const specificDateRateError = ref(null);
    const currentDailyRate = ref(null);

    // --- NUEVO: Caché para la respuesta de la API ---
    const apiRatesCache = ref(null);

    // --- Inicializar Composables ---
    const { user, authLoading } = useAuth();
    const { addEventHistoryEntry } = useEventHistory();

    // --- Funciones Auxiliares (Sin cambios) ---
    function getFieldLabel(key) {
        const labels = {
            name: 'Nombre',
            description: 'Descripción',
            notes: 'Notas Adicionales',
            date: 'Fecha',
            category: 'Categoría',
            type: 'Tipo Transacción',
            amountBs: 'Monto (Bs.)',
            exchangeRate: 'Tasa de Cambio (Bs/USD)',
            amountUsd: 'Monto (USD)',
            rate: 'Tasa (Bs/USD)',
        };
        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }

    function getChangeDetails(originalObject, updatedObject, ignoreFields = ['id', 'createdAt', 'updatedAt', 'userId']) {
        const changes = [];
        const safeUpdatedObject = updatedObject || {};
        const allKeys = new Set([...Object.keys(originalObject || {}), ...Object.keys(safeUpdatedObject)]);

        for (const key of allKeys) {
            if (ignoreFields.includes(key)) continue;
            let oldValue = originalObject ? originalObject[key] : undefined;
            let newValue = safeUpdatedObject[key];
            if (oldValue === undefined) oldValue = null;
            if (newValue === undefined) newValue = null;
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

    function _updateCurrentDailyRate() {
        if (exchangeRates.value && exchangeRates.value.length > 0) {
            exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
            const now = new Date();
            const localTodayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const rateForToday = exchangeRates.value.find(r => r.date === localTodayString);

            if (rateForToday) {
                currentDailyRate.value = rateForToday.rate;
            } else if (exchangeRates.value.length > 0) {
                currentDailyRate.value = exchangeRates.value[0].rate;
            } else {
                currentDailyRate.value = null;
            }
        } else {
            currentDailyRate.value = null;
        }
    }

    // --- Lógica de Carga de Datos (Sin cambios) ---
    let isLoadingData = false;
    async function loadAccountingData(userId) {
        // ... (El resto de la función `loadAccountingData` se mantiene igual)
        if (isLoadingData && !userId) {
            console.log('useAccountingData: Ya en modo localStorage, no se recarga desde localStorage por loadDataFromFirestore(null).');
            accountingLoading.value = false;
            return;
        }
        if (isLoadingData && userId) {
            console.log(`useAccountingData: Carga para ${userId} ya en progreso, omitiendo llamada duplicada.`);
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

                const transQuery = query(transactionsColRef, orderBy("date", "desc"), orderBy("createdAt", "desc"));
                const ratesQuery = query(ratesColRef, orderBy("date", "desc"));

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
                exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
                console.log(`useAccountingData: Cargadas ${transactions.value.length} transacciones y ${exchangeRates.value.length} tasas desde localStorage.`);
            }
            _updateCurrentDailyRate();
        } catch (e) {
            console.error("useAccountingData: Error cargando datos contables:", e);
            accountingError.value = "Error al cargar datos contables.";
            transactions.value = [];
            exchangeRates.value = [];
            currentDailyRate.value = null;
        } finally {
            accountingLoading.value = false;
            isLoadingData = false;
            console.log(`useAccountingData: Carga contable finalizada. accountingLoading = ${accountingLoading.value}`);
        }
    }


    // --- Lógica de Obtención de Tasas (Refactorizada) ---

    /**
     * NUEVA FUNCIÓN: Obtiene las tasas de la API y las guarda en caché para evitar llamadas repetidas.
     */
    async function getRatesFromApi() {
        if (apiRatesCache.value) {
            return apiRatesCache.value; // Devuelve desde caché si ya existe
        }
        rateFetchingLoading.value = true;
        accountingError.value = null;
        try {
            const apiUrl = import.meta.env.VITE_DOLARVENEZUELA_API_URL;
            const response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error('La API de DolarVzla no respondió correctamente.');
            }
            const data = await response.json();
            if (!data || !data.rates || !Array.isArray(data.rates)) {
                throw new Error('La respuesta de la API no tiene el formato esperado.');
            }
            apiRatesCache.value = data.rates; // Guardar en caché
            return data.rates;
        } catch (error) {
            console.error("Error fetching from DolarVzla API:", error);
            accountingError.value = "No se pudo obtener la lista de tasas de cambio.";
            return []; // Devuelve un array vacío en caso de error
        } finally {
            rateFetchingLoading.value = false;
        }
    }

    /**
     * REESCRITA: Usa la nueva función `getRatesFromApi` para obtener la tasa de hoy.
     */
    async function fetchAndUpdateBCVRate() {
        const ratesList = await getRatesFromApi();
        if (ratesList.length > 0) {
            // La API devuelve la lista ordenada, la primera es la más reciente.
            const latestRateData = ratesList[0];
            const rateValue = latestRateData.usd;
            const rateDate = latestRateData.date; // Formato YYYY-MM-DD

            const now = new Date();
            const localTodayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            // Actualizamos la tasa para la fecha de "hoy" con el valor más reciente obtenido.
            const success = await updateDailyRate(rateValue, localTodayString);

            // Opcional pero recomendado: guardamos la tasa en su fecha original si es diferente.
            if (success && localTodayString !== rateDate) {
                await updateDailyRate(rateValue, rateDate);
            }
            return success;
        }
        return false;
    }

    /**
     * REESCRITA: Usa la nueva función `getRatesFromApi` para buscar una tasa para una fecha específica.
     */
    async function fetchRateForSpecificDateFromAPI(dateStringYYYYMMDD) {
        specificDateRateFetchingLoading.value = true;
        const ratesList = await getRatesFromApi();
        specificDateRateFetchingLoading.value = false;

        if (ratesList.length > 0) {
            // Buscar la tasa para la fecha exacta o la más cercana anterior
            const rateData = ratesList.find(rate => rate.date <= dateStringYYYYMMDD);
            if (rateData) {
                specificDateRateError.value = null;
                return { rate: rateData.usd, dateFound: rateData.date, error: null };
            }
        }

        specificDateRateError.value = `No se encontró tasa para la fecha ${dateStringYYYYMMDD} o anterior.`;
        return { rate: null, dateFound: null, error: specificDateRateError.value };
    }

    function getRateForDate(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date)); // Asegurar orden
        const foundRate = exchangeRates.value.find(rate => rate.date <= targetDateString);
        return foundRate ? foundRate.rate : null;
    }
    function getRateForExactDate(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        // Busca una coincidencia exacta de fecha, sin usar "<="
        const foundRate = exchangeRates.value.find(rate => rate.date === targetDateString);
        return foundRate ? foundRate.rate : null;
    }

    function getLatestRateDataBefore(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        // Aseguramos que las tasas estén ordenadas de más nueva a más vieja
        const sortedRates = [...exchangeRates.value].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Buscamos la primera tasa que sea en o antes de la fecha objetivo
        const foundRateData = sortedRates.find(rate => rate.date <= targetDateString);

        return foundRateData || null; // Devuelve el objeto completo o null
    }

    async function updateDailyRate(rateValue, dateString = null) {
        const rate = Number(rateValue);
        if (isNaN(rate) || rate <= 0) {
            accountingError.value = "La tasa de cambio debe ser un número positivo.";
            console.error("updateDailyRate: Tasa inválida:", rateValue);
            return false;
        }

        let resolvedTargetDateString;
        if (dateString) {
            resolvedTargetDateString = dateString;
        } else {
            const now = new Date();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            resolvedTargetDateString = `${year}-${month}-${day}`;
        }

        const rateEntry = {
            id: resolvedTargetDateString,
            date: resolvedTargetDateString,
            rate: rate,
            timestamp: user.value ? serverTimestamp() : new Date().toISOString(),
            userId: user.value ? user.value.uid : null,
        };

        const originalRateEntry = exchangeRates.value.find(r => r.id === resolvedTargetDateString);
        const originalRateValue = originalRateEntry ? originalRateEntry.rate : null;

        if (originalRateEntry && originalRateEntry.rate === rate) {
            _updateCurrentDailyRate();
            return true;
        }

        const existingIndex = exchangeRates.value.findIndex(r => r.id === resolvedTargetDateString);
        if (existingIndex !== -1) {
            exchangeRates.value.splice(existingIndex, 1, rateEntry);
        } else {
            exchangeRates.value.unshift(rateEntry);
        }
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
        _updateCurrentDailyRate();

        if (user.value) {
            const batch = writeBatch(db);
            try {
                const rateDocRef = doc(db, `users/${user.value.uid}/exchangeRates`, resolvedTargetDateString);
                batch.set(rateDocRef, rateEntry);

                await addEventHistoryEntry({
                    eventType: originalRateEntry ? 'EXCHANGE_RATE_EDITED' : 'EXCHANGE_RATE_CREATED',
                    entityType: 'Tasa de Cambio',
                    entityId: resolvedTargetDateString,
                    entityName: `Tasa del ${resolvedTargetDateString}`,
                    changes: [{
                        field: 'rate',
                        oldValue: originalRateValue,
                        newValue: rate,
                        label: 'Tasa (Bs/USD)'
                    }]
                }, batch);

                await batch.commit();
                accountingError.value = null;
                return true;
            } catch (e) {
                console.error("Error actualizando tasa en Firestore:", e);
                accountingError.value = "Error al guardar la tasa de cambio en servidor.";
                // Rollback
                if (originalRateEntry) {
                    if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1, originalRateEntry);
                    else exchangeRates.value.unshift(originalRateEntry);
                } else {
                    if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1);
                    else exchangeRates.value.shift();
                }
                exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                _updateCurrentDailyRate();
                return false;
            }
        } else {
            await addEventHistoryEntry({
                eventType: originalRateEntry ? 'EXCHANGE_RATE_EDITED' : 'EXCHANGE_RATE_CREATED',
                entityType: 'Tasa de Cambio',
                entityId: resolvedTargetDateString,
                entityName: `Tasa del ${resolvedTargetDateString}`,
                changes: [{
                    field: 'rate',
                    oldValue: originalRateValue,
                    newValue: rate,
                    label: 'Tasa (Bs/USD)'
                }]
            });
            accountingError.value = null;
            return true;
        }
    }

    async function addTransaction(entryData) {
        accountingError.value = null;
        if (!entryData.date || !entryData.description || !entryData.amountBs || !entryData.type) {
            accountingError.value = "Faltan campos requeridos para la transacción."; return null;
        }
        const amountBs = Number(entryData.amountBs);
        if (isNaN(amountBs) || amountBs <= 0) {
            accountingError.value = "Monto en Bs. debe ser positivo."; return null;
        }
        const rateToUse = Number(entryData.exchangeRate);
        if (isNaN(rateToUse) || rateToUse <= 0) {
            accountingError.value = `Tasa de cambio inválida o no provista para la fecha ${entryData.date}. (${entryData.exchangeRate})`;
            return null;
        }

        const calculatedAmountUsd = amountBs / rateToUse;
        const amountUsd = parseFloat(calculatedAmountUsd.toFixed(2));

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

        if (user.value) {
            const batch = writeBatch(db);
            try {
                const transColRef = collection(db, `users/${user.value.uid}/transactions`);
                const newTransDocRef = doc(transColRef);
                batch.set(newTransDocRef, { ...transactionEntry });

                const changes = getChangeDetails(null, transactionEntry, ['id', 'createdAt', 'updatedAt', 'userId']);

                if (changes.length > 0) {
                    await addEventHistoryEntry({
                        eventType: 'TRANSACTION_CREATED',
                        entityType: transactionEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                        entityId: newTransDocRef.id,
                        entityName: transactionEntry.description,
                        changes: changes
                    }, batch);
                }
                await batch.commit();

                const savedTransaction = {
                    ...transactionEntry,
                    id: newTransDocRef.id,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                };
                transactions.value.unshift(savedTransaction);
                transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
                _updateCurrentDailyRate();
                accountingError.value = null;
                return savedTransaction;
            } catch (e) {
                console.error("Error al añadir transacción a Firestore:", e);
                accountingError.value = e.message || "Error al guardar la transacción en servidor.";
                return null;
            }
        } else {
            const localId = `local_${Date.now()}`;
            const localEntry = { ...transactionEntry, id: localId };
            const changes = getChangeDetails(null, localEntry, ['id', 'createdAt', 'updatedAt', 'userId']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_CREATED',
                    entityType: localEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: localEntry.id,
                    entityName: localEntry.description,
                    changes: changes
                });
            }
            transactions.value.unshift(localEntry);
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
            _updateCurrentDailyRate();
            accountingError.value = null;
            return localEntry;
        }
    }

    async function saveTransaction(updatedEntryData) {
        accountingError.value = null;
        const index = transactions.value.findIndex(t => t.id === updatedEntryData.id);
        if (index === -1) {
            accountingError.value = "Error: Transacción no encontrada para actualizar."; return false;
        }
        const originalTransaction = JSON.parse(JSON.stringify(transactions.value[index]));
        const amountBs = Number(updatedEntryData.amountBs);
        if (isNaN(amountBs) || amountBs <= 0) {
            accountingError.value = "Monto en Bs. debe ser positivo."; return false;
        }
        const rateToUse = Number(updatedEntryData.exchangeRate);
        if (isNaN(rateToUse) || rateToUse <= 0) {
            accountingError.value = `Tasa de cambio inválida o no provista (${updatedEntryData.exchangeRate}).`; return false;
        }
        const amountUsd = parseFloat((amountBs / rateToUse).toFixed(2));
        const finalTransactionData = {
            ...originalTransaction,
            ...updatedEntryData,
            amountBs: amountBs,
            exchangeRate: rateToUse,
            amountUsd: amountUsd,
            updatedAt: user.value ? serverTimestamp() : new Date().toISOString(),
        };
        if (user.value) {
            const batch = writeBatch(db);
            try {
                const transDocRef = doc(db, `users/${user.value.uid}/transactions`, updatedEntryData.id);
                const { id, ...firestoreEntry } = finalTransactionData;
                batch.set(transDocRef, firestoreEntry, { merge: true });
                const changes = getChangeDetails(originalTransaction, firestoreEntry, ['id', 'createdAt', 'updatedAt', 'userId']);
                if (changes.length > 0) {
                    await addEventHistoryEntry({
                        eventType: 'TRANSACTION_EDITED',
                        entityType: finalTransactionData.type === 'income' ? 'Ingreso' : 'Egreso',
                        entityId: updatedEntryData.id,
                        entityName: finalTransactionData.description,
                        changes: changes
                    }, batch);
                }
                await batch.commit();
                transactions.value.splice(index, 1, finalTransactionData);
                transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                _updateCurrentDailyRate();
                accountingError.value = null;
                return true;
            } catch (e) {
                console.error("Error al actualizar transacción en Firestore:", e);
                accountingError.value = e.message || "Error al guardar cambios de transacción en servidor.";
                return false;
            }
        } else {
            const changes = getChangeDetails(originalTransaction, finalTransactionData, ['id', 'createdAt', 'updatedAt', 'userId']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_EDITED',
                    entityType: finalTransactionData.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: finalTransactionData.id,
                    entityName: finalTransactionData.description,
                    changes: changes
                });
            }
            transactions.value.splice(index, 1, finalTransactionData);
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));
            _updateCurrentDailyRate();
            accountingError.value = null;
            return true;
        }
    }

    async function deleteTransaction(transactionId) {
        accountingError.value = null;
        const index = transactions.value.findIndex(t => t.id === transactionId);
        if (index === -1) {
            accountingError.value = "Error: Transacción no encontrada para eliminar."; return false;
        }
        const transactionToDelete = JSON.parse(JSON.stringify(transactions.value[index]));
        if (user.value) {
            const batch = writeBatch(db);
            try {
                const transDocRef = doc(db, `users/${user.value.uid}/transactions`, transactionId);
                batch.delete(transDocRef);
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_DELETED',
                    entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: transactionId,
                    entityName: transactionToDelete.description,
                    changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({
                        field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                    }))
                }, batch);
                await batch.commit();
                transactions.value.splice(index, 1);
                _updateCurrentDailyRate();
                accountingError.value = null;
                return true;
            } catch (e) {
                console.error("Error al eliminar transacción de Firestore:", e);
                accountingError.value = "Error al eliminar la transacción."; return false;
            }
        } else {
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_DELETED',
                entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: transactionId,
                entityName: transactionToDelete.description,
                changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({
                    field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            });
            transactions.value.splice(index, 1);
            _updateCurrentDailyRate();
            accountingError.value = null;
            return true;
        }
    }

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
        const summary = filteredList.reduce((acc, tx) => {
            if (tx.type === 'income') {
                acc.totalIncome += tx.amountBs || 0;
            } else if (tx.type === 'expense') {
                acc.totalExpenses += tx.amountBs || 0;
            }
            return acc;
        }, { totalIncome: 0, totalExpenses: 0, netBalance: 0 });

        summary.netBalance = summary.totalIncome - summary.totalExpenses;
        return summary;
    }
    const dataLoadedForContext = ref(null);

    watch(
        () => ({ user: user.value, authIsLoading: authLoading.value }),
        (newState, oldState) => {
            const newUserId = newState.user ? newState.user.uid : null;
            if (newState.authIsLoading) {
                if (dataLoadedForContext.value !== null) {
                    dataLoadedForContext.value = null;
                }
                if (!accountingLoading.value) {
                    accountingLoading.value = true;
                }
                return;
            }
            if (newUserId) {
                if (dataLoadedForContext.value !== newUserId) {
                    loadAccountingData(newUserId);
                    dataLoadedForContext.value = newUserId;
                } else {
                    if (accountingLoading.value && isLoadingData === false) {
                        accountingLoading.value = false;
                    }
                }
            } else {
                if (dataLoadedForContext.value !== 'local') {
                    loadAccountingData(null);
                    dataLoadedForContext.value = 'local';
                } else {
                    if (accountingLoading.value && isLoadingData === false) {
                        accountingLoading.value = false;
                    }
                }
            }
        },
        { deep: true, immediate: true }
    );

    // --- Exportar ---
    return {
        transactions,
        exchangeRates,
        currentDailyRate,
        accountingLoading,
        rateFetchingLoading,
        specificDateRateFetchingLoading,
        accountingError,
        specificDateRateError,
        loadAccountingData,
        getRateForDate,
        getRateForExactDate,
        getLatestRateDataBefore,
        updateDailyRate,
        addTransaction,
        saveTransaction,
        deleteTransaction,
        getFilteredTransactions,
        calculateSummary,
        fetchAndUpdateBCVRate,
        fetchRateForSpecificDateFromAPI,
    };
});

