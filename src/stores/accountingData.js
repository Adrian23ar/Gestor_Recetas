// src/stores/accountingData.js
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
            // --- MODIFICACIÓN 1.2 ---
            if (e.code === 'unavailable') {
                console.warn("useAccountingData: No se pudo conectar a Firestore (offline). Mostrando datos locales cacheados.");
            } else {
                console.error("useAccountingData: Error cargando datos contables:", e);
                accountingError.value = "Error al cargar datos contables.";
                transactions.value = [];
                exchangeRates.value = [];
                currentDailyRate.value = null;
            }
            // --- FIN MODIFICACIÓN 1.2 ---
        } finally {
            accountingLoading.value = false;
            isLoadingData = false;
            console.log(`useAccountingData: Carga contable finalizada. accountingLoading = ${accountingLoading.value}`);
        }
    }


    // --- Lógica de Obtención de Tasas (Sin cambios) ---
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

    // --- INICIO REFACTOR 1.3 ---
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

        // 1. Guardar estado original y ejecutar actualización optimista
        const existingIndex = exchangeRates.value.findIndex(r => r.id === resolvedTargetDateString);
        if (existingIndex !== -1) {
            exchangeRates.value.splice(existingIndex, 1, rateEntry);
        } else {
            exchangeRates.value.unshift(rateEntry);
        }
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
        _updateCurrentDailyRate();

        if (user.value) {
            // 2. "Disparar y Olvidar"
            const batch = writeBatch(db);
            const rateDocRef = doc(db, `users/${user.value.uid}/exchangeRates`, resolvedTargetDateString);
            batch.set(rateDocRef, rateEntry);

            addEventHistoryEntry({
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
            }, batch).then(() => {
                batch.commit().then(() => {
                    console.log(`Sincronización (updateDailyRate ${resolvedTargetDateString}) exitosa.`);
                    accountingError.value = null; // Limpiar error en éxito
                }).catch(e => {
                    console.error("Error al sincronizar 'updateDailyRate' en Firestore:", e);
                    accountingError.value = "Error al guardar la tasa de cambio en servidor.";
                    // 3. Rollback
                    if (originalRateEntry) {
                        if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1, originalRateEntry);
                        else exchangeRates.value.unshift(originalRateEntry);
                    } else {
                        if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1);
                        else exchangeRates.value.shift();
                    }
                    exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                    _updateCurrentDailyRate();
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'updateDailyRate':", e);
                accountingError.value = "Error al preparar historial de tasa.";
                // 3. Rollback (copiado de arriba)
                if (originalRateEntry) {
                    if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1, originalRateEntry);
                    else exchangeRates.value.unshift(originalRateEntry);
                } else {
                    if (existingIndex !== -1) exchangeRates.value.splice(existingIndex, 1);
                    else exchangeRates.value.shift();
                }
                exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                _updateCurrentDailyRate();
            });

            // 4. Retornar éxito inmediatamente
            return true;

        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
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
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const transColRef = collection(db, `users/${user.value.uid}/transactions`);
            const newTransDocRef = doc(transColRef);
            const firestoreId = newTransDocRef.id;

            // 1. Preparar datos locales optimistas
            const savedTransaction = {
                ...transactionEntry,
                id: firestoreId,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            // 2. Ejecutar actualización optimista de UI PRIMERO
            transactions.value.unshift(savedTransaction);
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));

            // 3. "Disparar y Olvidar"
            const changes = getChangeDetails(null, transactionEntry, ['id', 'createdAt', 'updatedAt', 'userId']);
            if (changes.length > 0) {
                addEventHistoryEntry({
                    eventType: 'TRANSACTION_CREATED',
                    entityType: transactionEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: firestoreId,
                    entityName: transactionEntry.description,
                    changes: changes
                }, batch).then(() => {
                    batch.set(newTransDocRef, { ...transactionEntry });

                    batch.commit().then(() => {
                        console.log(`Sincronización (addTransaction ${firestoreId}) exitosa.`);
                        accountingError.value = null;
                    }).catch(e => {
                        console.error("Error al sincronizar 'addTransaction' a Firestore:", e);
                        accountingError.value = e.message || "Error al guardar la transacción en servidor.";
                        // 4. Rollback
                        transactions.value = transactions.value.filter(t => t.id !== firestoreId);
                    });
                }).catch(e => {
                    console.error("Error al preparar historial para 'addTransaction':", e);
                    accountingError.value = "Error al preparar historial de transacción.";
                    transactions.value = transactions.value.filter(t => t.id !== firestoreId); // Rollback
                });
            } else {
                // Si no hay cambios (extraño para un 'add'), solo haz el commit
                batch.set(newTransDocRef, { ...transactionEntry });
                batch.commit().then(() => {
                    console.log(`Sincronización (addTransaction ${firestoreId}) exitosa (sin historial).`);
                    accountingError.value = null;
                }).catch(e => {
                    console.error("Error al sincronizar 'addTransaction' (sin hist) a Firestore:", e);
                    accountingError.value = e.message || "Error al guardar la transacción en servidor.";
                    transactions.value = transactions.value.filter(t => t.id !== firestoreId); // Rollback
                });
            }

            // 5. Retornar éxito inmediatamente
            _updateCurrentDailyRate(); // <-- Esto es síncrono, está bien aquí
            return savedTransaction;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
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
        // 1. Guardar estado original y ejecutar actualización optimista
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

        // 2. Ejecutar actualización optimista de UI PRIMERO
        transactions.value.splice(index, 1, finalTransactionData);
        transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const transDocRef = doc(db, `users/${user.value.uid}/transactions`, updatedEntryData.id);
            const { id, ...firestoreEntry } = finalTransactionData;
            batch.set(transDocRef, firestoreEntry, { merge: true });

            // 3. "Disparar y Olvidar"
            const changes = getChangeDetails(originalTransaction, firestoreEntry, ['id', 'createdAt', 'updatedAt', 'userId']);
            if (changes.length > 0) {
                addEventHistoryEntry({
                    eventType: 'TRANSACTION_EDITED',
                    entityType: finalTransactionData.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: updatedEntryData.id,
                    entityName: finalTransactionData.description,
                    changes: changes
                }, batch).then(() => {
                    batch.commit().then(() => {
                        console.log(`Sincronización (saveTransaction ${updatedEntryData.id}) exitosa.`);
                        accountingError.value = null;
                    }).catch(e => {
                        console.error("Error al sincronizar 'saveTransaction' en Firestore:", e);
                        accountingError.value = e.message || "Error al guardar cambios de transacción en servidor.";
                        // 4. Rollback
                        transactions.value.splice(index, 1, originalTransaction);
                        transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                    });
                }).catch(e => {
                    console.error("Error al preparar historial para 'saveTransaction':", e);
                    accountingError.value = "Error al preparar historial de guardado.";
                    transactions.value.splice(index, 1, originalTransaction); // Rollback
                    transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                });
            } else {
                console.log("saveTransaction: No hay cambios detectados para sincronizar.");
                // Aunque no haya cambios en el historial, el campo 'updatedAt' sí cambió, así que hacemos commit
                batch.commit().then(() => {
                    console.log(`Sincronización (saveTransaction ${updatedEntryData.id}) exitosa (solo timestamp).`);
                    accountingError.value = null;
                }).catch(e => {
                    console.error("Error al sincronizar 'saveTransaction' (solo timestamp) en Firestore:", e);
                    accountingError.value = e.message || "Error al guardar cambios de transacción en servidor.";
                    transactions.value.splice(index, 1, originalTransaction); // Rollback
                    transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date));
                });
            }

            // 5. Retornar éxito inmediatamente
            _updateCurrentDailyRate();
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
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
        // 1. Guardar estado original y ejecutar actualización optimista
        const transactionToDelete = JSON.parse(JSON.stringify(transactions.value[index]));
        transactions.value.splice(index, 1);
        _updateCurrentDailyRate(); // Actualizar UI optimista

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const transDocRef = doc(db, `users/${user.value.uid}/transactions`, transactionId);
            batch.delete(transDocRef);

            // 2. "Disparar y Olvidar"
            addEventHistoryEntry({
                eventType: 'TRANSACTION_DELETED',
                entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: transactionId,
                entityName: transactionToDelete.description,
                changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({
                    field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            }, batch).then(() => {
                batch.commit().then(() => {
                    console.log(`Sincronización (deleteTransaction ${transactionId}) exitosa.`);
                    accountingError.value = null;
                }).catch(e => {
                    console.error("Error al sincronizar 'deleteTransaction' en Firestore:", e);
                    accountingError.value = "Error al eliminar la transacción.";
                    // 3. Rollback
                    transactions.value.splice(index, 0, transactionToDelete);
                    _updateCurrentDailyRate();
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'deleteTransaction':", e);
                accountingError.value = "Error al preparar historial de borrado.";
                transactions.value.splice(index, 0, transactionToDelete); // Rollback
                _updateCurrentDailyRate();
            });

            // 4. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_DELETED',
                entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: transactionId,
                entityName: transactionToDelete.description,
                changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({
                    field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            });
            // La actualización optimista ya se hizo
            return true;
        }
    }
    // --- FIN REFACTOR 1.3 ---

    function getFilteredTransactions(options = {}) {
        // ... (código existente, sin cambios)
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
        // ... (código existente, sin cambios)
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
            // ... (código existente, sin cambios)
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