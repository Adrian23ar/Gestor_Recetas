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
const exchangeRates = useLocalStorage(RATES_STORAGE_KEY, []);
const accountingLoading = ref(true);
const rateFetchingLoading = ref(false); // Para la tasa del día en AccountingView
const specificDateRateFetchingLoading = ref(false); // Para el modal
const accountingError = ref(null);
const specificDateRateError = ref(null); // Error específico para la tasa de fecha en modal
const currentDailyRate = ref(null);

// --- Inicializar Composables ---
const { user, authLoading } = useAuth();
const { addEventHistoryEntry } = useEventHistory();

// --- Funciones Auxiliares (Existentes) ---
function getFieldLabel(key) {
    const labels = {
        name: 'Nombre',
        description: 'Descripción',
        notes: 'Notas Adicionales',
        date: 'Fecha',
        category: 'Categoría',
        unit: 'Unidad',
        cost: 'Costo de Presentación',
        presentationSize: 'Tamaño de Presentación',
        currentStock: 'Stock Actual',
        ingredients: 'Lista de Ingredientes',
        packagingCostPerBatch: 'Costo Empaque/Lote',
        laborCostPerBatch: 'Mano de Obra/Lote',
        itemsPerBatch: 'Items por Lote',
        profitMarginPercent: '% Margen Ganancia',
        lossBufferPercent: '% Margen Pérdida',
        productName: 'Nombre del Producto',
        batchSize: 'Tamaño del Lote',
        recipeId: 'Receta Asociada',
        totalRevenue: 'Ingresos Totales',
        totalCost: 'Costo Total Producción',
        netProfit: 'Ganancia Neta',
        type: 'Tipo Transacción',
        amountBs: 'Monto (Bs.)',
        exchangeRate: 'Tasa de Cambio (Bs/USD)',
        amountUsd: 'Monto (USD)',
        ingredient_removed: 'Ingrediente Eliminado',
        ingredient_added: 'Ingrediente Añadido',
        ingredient_quantity_updated: 'Cantidad de Ingrediente',
        ingredient_unit_updated: 'Unidad de Ingrediente',
        rate: 'Tasa (Bs/USD)',
        timestamp: 'Fecha del Evento',
        userId: 'ID Usuario',
        userName: 'Nombre Usuario',
        eventType: 'Tipo de Evento',
        entityType: 'Tipo de Entidad',
        entityId: 'ID Entidad',
        entityName: 'Nombre Entidad',
    };
    return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}

// --- FUNCIÓN CORREGIDA ---
function getChangeDetails(originalObject, updatedObject, ignoreFields = ['id', 'createdAt', 'updatedAt', 'userId']) {
    const changes = [];
    // Asegurarse de que updatedObject no sea null o undefined para evitar errores con Object.keys si no hay originalObject
    const safeUpdatedObject = updatedObject || {};
    const allKeys = new Set([...Object.keys(originalObject || {}), ...Object.keys(safeUpdatedObject)]);

    for (const key of allKeys) {
        if (ignoreFields.includes(key)) continue;

        let oldValue = originalObject ? originalObject[key] : undefined;
        let newValue = safeUpdatedObject[key]; // Acceder directamente ya que nos aseguramos que no es null/undefined

        // Convert undefined to null for Firestore compatibility
        if (oldValue === undefined) {
            oldValue = null;
        }
        if (newValue === undefined) {
            newValue = null;
        }

        // Comparar, ahora usando null en lugar de undefined
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
// --- FIN FUNCIÓN CORREGIDA ---

/** Actualiza la ref currentDailyRate basada en las tasas cargadas */
function _updateCurrentDailyRate() {
    if (exchangeRates.value && exchangeRates.value.length > 0) {
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date));

        // --- MODIFICACIÓN para hoy local ---
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const localTodayString = `${year}-${month}-${day}`;
        // --- FIN MODIFICACIÓN ---

        const rateForToday = exchangeRates.value.find(r => r.date === localTodayString); // Usar localTodayString

        if (rateForToday) {
            currentDailyRate.value = rateForToday.rate;
        } else if (exchangeRates.value.length > 0) {
            // Fallback a la última tasa conocida si no hay para "hoy" local
            currentDailyRate.value = exchangeRates.value[0].rate;
        } else {
            currentDailyRate.value = null;
        }
    } else {
        currentDailyRate.value = null;
    }

}

/** Carga los datos contables (transacciones y tasas) */
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

function getRateForDate(targetDateString) {
    if (!exchangeRates.value || exchangeRates.value.length === 0) {
        return null;
    }
    exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date)); // Asegurar orden
    const foundRate = exchangeRates.value.find(rate => rate.date <= targetDateString);
    return foundRate ? foundRate.rate : null;
}

// --- FUNCIÓN NUEVA Y MÁS ESTRICTA ---
function getRateForExactDate(targetDateString) {
    if (!exchangeRates.value || exchangeRates.value.length === 0) {
        return null;
    }
    // Busca una coincidencia exacta de fecha, sin usar "<="
    const foundRate = exchangeRates.value.find(rate => rate.date === targetDateString);
    return foundRate ? foundRate.rate : null;
}

// --- FUNCIÓN NUEVA: OBTIENE EL OBJETO COMPLETO DE LA TASA MÁS RECIENTE ---
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
        accountingError.value = "La tasa de cambio debe ser un número positivo."; // [cite: 49]
        console.error("updateDailyRate: Tasa inválida:", rateValue); // [cite: 50]
        return false;
    }

    let resolvedTargetDateString;
    if (dateString) {
        resolvedTargetDateString = dateString;
    } else {
        console.log(`useAccountingData: usando fecha de hoy.`); // Esta línea es de tu código, la mantengo
        // Usar la fecha local para "hoy"
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        resolvedTargetDateString = `${year}-${month}-${day}`;
    }

    const rateEntry = {
        id: resolvedTargetDateString, // [cite: 51] // CORREGIDO
        date: resolvedTargetDateString, // [cite: 51] // CORREGIDO
        rate: rate, // [cite: 51]
        timestamp: user.value ? serverTimestamp() : new Date().toISOString(), // [cite: 51, 52]
        userId: user.value ? user.value.uid : null, // [cite: 52, 53]
    };
    // Aquí es donde necesitas usar resolvedTargetDateString
    const originalRateEntry = exchangeRates.value.find(r => r.id === resolvedTargetDateString); // CORREGIDO
    const originalRateValue = originalRateEntry ? originalRateEntry.rate : null;

    if (originalRateEntry && originalRateEntry.rate === rate) {
        // Y aquí también
        console.log(`useAccountingData: La tasa ${rate} para ${resolvedTargetDateString} ya está registrada y es la misma. No se requiere actualización.`); // CORREGIDO
        _updateCurrentDailyRate();
        return true;
    }

    // Y aquí
    const existingIndex = exchangeRates.value.findIndex(r => r.id === resolvedTargetDateString); // CORREGIDO
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
            // Y aquí
            const rateDocRef = doc(db, `users/${user.value.uid}/exchangeRates`, resolvedTargetDateString); // CORREGIDO
            batch.set(rateDocRef, rateEntry);

            await addEventHistoryEntry({
                eventType: originalRateEntry ? 'EXCHANGE_RATE_EDITED' : 'EXCHANGE_RATE_CREATED',
                entityType: 'Tasa de Cambio',
                entityId: resolvedTargetDateString, // CORREGIDO
                entityName: `Tasa del ${resolvedTargetDateString}`, // CORREGIDO
                changes: [{
                    field: 'rate',
                    oldValue: originalRateValue,
                    newValue: rate,
                    label: 'Tasa (Bs/USD)'
                }]
            }, batch);

            await batch.commit();
            // Y aquí
            console.log("useAccountingData: Tasa de cambio actualizada en Firestore para", resolvedTargetDateString); // CORREGIDO
            accountingError.value = null;
            return true;
        } catch (e) {
            console.error("Error actualizando tasa en Firestore:", e);
            accountingError.value = "Error al guardar la tasa de cambio en servidor.";
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
            entityId: resolvedTargetDateString, // CORREGIDO
            entityName: `Tasa del ${resolvedTargetDateString}`, // CORREGIDO
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

// --- FUNCIÓN MODIFICADA PARA OBTENER TASA DEL BCV DESDE API ---
async function fetchAndUpdateBCVRate(maxRetries = 5) { // [cite: 77]
    console.log(`useAccountingData: Buscando tasa BCV para HOY, con hasta ${maxRetries} reintentos hacia atrás.`);
    rateFetchingLoading.value = true;
    accountingError.value = null; // Limpiar error general

    const originalTodayDate = new Date(); // Guardar la fecha original de "hoy"

    // --- INICIO DE CAMBIO ---
    // Determinar originalTodayYYYYMMDD basado en componentes de fecha local
    const yearLocal = originalTodayDate.getFullYear();
    const monthLocal = String(originalTodayDate.getMonth() + 1).padStart(2, '0');
    const dayLocal = String(originalTodayDate.getDate()).padStart(2, '0');
    const originalTodayYYYYMMDD = `${yearLocal}-${monthLocal}-${dayLocal}`;
    // --- FIN DE CAMBIO ---

    let currentDateToTry = new Date(originalTodayDate); // Empezar con hoy
    // Asegurémonos que currentDateToTry también se alinee con la medianoche local para la primera iteración si es necesario.
    // Para la lógica de la API que usa DD-MM-YYYY, la forma en que construyes formattedApiDateForQuery ya usa los componentes de currentDateToTry.
    // Sin embargo, para la primera iteración (i=0), currentDateToTry se basa en la hora actual.
    // Si es importante que la primera consulta a la API sea exactamente para la fecha YYYY-MM-DD local (medianoche):
    currentDateToTry = new Date(originalTodayYYYYMMDD + 'T00:00:00'); // Para que el primer día a intentar sea la fecha local "hoy" desde medianoche.


    const apiToken = 'ZCp_K35_WZUYeTJWoJLYcA'; // Tu token

    for (let i = 0; i <= maxRetries; i++) {
        if (i > 0) { // Si no es el primer intento, retroceder un día
            currentDateToTry.setDate(currentDateToTry.getDate() - 1);
        }

        const year = currentDateToTry.getFullYear();
        const month = String(currentDateToTry.getMonth() + 1).padStart(2, '0');
        const day = String(currentDateToTry.getDate()).padStart(2, '0');

        const dateAttemptingYYYYMMDD = `${year}-${month}-${day}`;
        const formattedApiDateForQuery = `${day}-${month}-${year}`;

        const apiUrl = `https://pydolarve.org/api/v2/dollar/history?page=bcv&monitor=usd&start_date=${formattedApiDateForQuery}&end_date=${formattedApiDateForQuery}&format_date=default&rounded_price=true&order=desc`;

        try {
            console.log(`useAccountingData (fetchAndUpdateBCVRate): Intento ${i + 1}. API para fecha: ${dateAttemptingYYYYMMDD} (Query: ${formattedApiDateForQuery})`);
            const response = await fetch(apiUrl, {
                headers: { Authorization: `Bearer ${apiToken}` }
            });
            const responseBodyForDebug = await response.text();

            if (!response.ok) {
                let errorData;
                try { errorData = JSON.parse(responseBodyForDebug); } catch (e) { /* no es json */ }
                // console.warn(`useAccountingData (fetchAndUpdateBCVRate): Error API intento ${i + 1} para ${dateAttemptingYYYYMMDD}: ${response.status}`, errorData || responseBodyForDebug);
                if (i === maxRetries) {
                    // --- CAMBIO PARA MENSAJE GENÉRICO ---
                    accountingError.value = "Error al obtener datos de la API de tasas. Intente más tarde o ingrese la tasa manualmente.";
                    // La línea original lanzaba un error que luego se capturaba y se usaba su message.
                    // throw new Error(`Error API final (${response.status}) para ${dateAttemptingYYYYMMDD}: ${errorData?.message || responseBodyForDebug}`);
                    rateFetchingLoading.value = false;// Asegurar que el loading se detenga
                    return; // Salir si es el último reintento y falló
                }
                // Mensaje temporal para el usuario mientras se reintenta (opcional, o hacerlo más genérico)
                // accountingError.value = `API no disponible para ${dateAttemptingYYYYMMDD}. Reintentando...`;
                // Por ahora, para simplificar, no pondremos un error temporal aquí si va a reintentar.
                // El error final se manejará arriba.
                continue;
            }

            const data = JSON.parse(responseBodyForDebug);

            if (data && data.history && data.history.length > 0) {
                const latestRateEntry = data.history[0];
                const bcvUsdRate = parseFloat(latestRateEntry.price);

                const [datePartApi] = latestRateEntry.last_update.split(',');
                const [dayApi, monthApi, yearApi] = datePartApi.split('/');
                const apiDateRateIsValidForYYYYMMDD = `${yearApi}-${monthApi.padStart(2, '0')}-${dayApi.padStart(2, '0')}`;


                if (bcvUsdRate && !isNaN(bcvUsdRate) && bcvUsdRate > 0) {
                    console.log(`useAccountingData (fetchAndUpdateBCVRate): Tasa ENCONTRADA: ${bcvUsdRate} (corresponde al ${apiDateRateIsValidForYYYYMMDD}). Se aplicará para HOY (${originalTodayYYYYMMDD}).`);

                    await updateDailyRate(bcvUsdRate, originalTodayYYYYMMDD);

                    if (originalTodayYYYYMMDD !== apiDateRateIsValidForYYYYMMDD) {
                        await updateDailyRate(bcvUsdRate, apiDateRateIsValidForYYYYMMDD);
                    }

                    rateFetchingLoading.value = false;
                    accountingError.value = null; // Limpiar cualquier error temporal
                    return; // Salir del bucle y de la función, tasa encontrada y aplicada
                } else {
                    console.warn(`useAccountingData (fetchAndUpdateBCVRate): Tasa no válida en API para ${dateAttemptingYYYYMMDD}.`, latestRateEntry);
                }
            } else {
                console.warn(`useAccountingData (fetchAndUpdateBCVRate): No historial en API para ${dateAttemptingYYYYMMDD}.`);
            }
            accountingError.value = `No hay tasa API para ${dateAttemptingYYYYMMDD}.`; // Mensaje temporal

        } catch (error) {
            console.error(`useAccountingData (fetchAndUpdateBCVRate): Catch Error intento ${i + 1} para ${dateAttemptingYYYYMMDD}:`, error);
            accountingError.value = error.message || `Error procesando tasa para ${dateAttemptingYYYYMMDD}.`;
            if (i === maxRetries) { // Si es el último reintento y falló
                accountingError.value = "Error procesando la respuesta de la API de la tasa BCV. Intente más tarde.";
                rateFetchingLoading.value = false;
                return;
            }
        }
    }

    rateFetchingLoading.value = false;
    if (!accountingError.value) { // Solo si no se estableció un error más específico (como el de response.ok o el catch)
        // --- CAMBIO PARA MENSAJE GENÉRICO ---
        accountingError.value = `Servicio de tasas no disponible. No se encontró tasa para hoy (${originalTodayYYYYMMDD}) ni días anteriores.`;
    }
    console.log(`useAccountingData (fetchAndUpdateBCVRate): ${accountingError.value}`);
}
// --- FIN FUNCIÓN MODIFICADA ---

// --- FUNCIÓN MODIFICADA PARA OBTENER TASA DE UNA FECHA ESPECÍFICA (CON REINTENTOS HACIA ATRÁS) ---
async function fetchRateForSpecificDateFromAPI(dateStringYYYYMMDD, maxRetries = 5) { // maxRetries: ej. buscar hasta 5 días atrás
    console.log(`useAccountingData: Buscando tasa API para ${dateStringYYYYMMDD}, con hasta ${maxRetries} reintentos hacia atrás.`);
    specificDateRateFetchingLoading.value = true;
    specificDateRateError.value = null;

    if (!dateStringYYYYMMDD) {
        specificDateRateError.value = "Fecha no proporcionada.";
        specificDateRateFetchingLoading.value = false;
        return { rate: null, dateFound: null, error: specificDateRateError.value };
    }

    let currentDateToTry = new Date(dateStringYYYYMMDD + 'T00:00:00'); // Asegurar que se interprete como local
    const apiToken = 'ZCp_K35_WZUYeTJWoJLYcA'; // Tu token

    for (let i = 0; i <= maxRetries; i++) {
        if (i > 0) { // Si no es el primer intento, retroceder un día
            currentDateToTry.setDate(currentDateToTry.getDate() - 1);
        }

        const year = currentDateToTry.getFullYear();
        const month = String(currentDateToTry.getMonth() + 1).padStart(2, '0');
        const day = String(currentDateToTry.getDate()).padStart(2, '0');

        const formattedApiDateForQuery = `${day}-${month}-${year}`; // DD-MM-YYYY para la API
        const currentDateYYYYMMDD = `${year}-${month}-${day}`; // YYYY-MM-DD para lógica interna y logs

        const apiUrl = `https://pydolarve.org/api/v2/dollar/history?page=bcv&monitor=usd&start_date=${formattedApiDateForQuery}&end_date=${formattedApiDateForQuery}&format_date=default&rounded_price=true&order=desc`;

        try {
            console.log(`useAccountingData: Intento ${i + 1}/${maxRetries + 1}. Llamando API para fecha: ${currentDateYYYYMMDD} (Query: ${formattedApiDateForQuery}) URL: ${apiUrl}`);
            const response = await fetch(apiUrl, {
                headers: { Authorization: `Bearer ${apiToken}` }
            });
            const responseBodyForDebug = await response.text();

            if (!response.ok) {
                let errorData;
                try { errorData = JSON.parse(responseBodyForDebug); } catch (e) { /* no es json */ }
                // console.warn(`useAccountingData: Error API en intento ${i + 1} para ${currentDateYYYYMMDD}: ${response.status}`, errorData || responseBodyForDebug); // Warn Si falla la API
                // Continuar al siguiente reintento si hay un error de API (ej. 404 si la ruta no existe para esa fecha)
                // pero si es el último reintento y falla, se propagará el error después del bucle.
                if (i === maxRetries) {
                    // --- CAMBIO PARA MENSAJE GENÉRICO ---
                    specificDateRateError.value = "Error al obtener datos de la API de tasas para esta fecha.";

                    specificDateRateFetchingLoading.value = false;
                    return { rate: null, dateFound: null, error: specificDateRateError.value };
                }
                continue; // Probar día anterior
            }

            const data = JSON.parse(responseBodyForDebug);
            console.log(`useAccountingData: Respuesta API para ${currentDateYYYYMMDD}:`, data);

            if (data && data.history && data.history.length > 0) {
                const rateEntry = data.history[0];
                const specificDateRate = parseFloat(rateEntry.price);

                if (specificDateRate && !isNaN(specificDateRate) && specificDateRate > 0) {
                    console.log(`useAccountingData: Tasa USD BCV ENCONTRADA: ${specificDateRate} para fecha (API) ${rateEntry.last_update}, buscada originalmente para ${dateStringYYYYMMDD} (encontrada en ${currentDateYYYYMMDD})`);

                    await updateDailyRate(specificDateRate, currentDateYYYYMMDD);

                    specificDateRateFetchingLoading.value = false;
                    return { rate: specificDateRate, dateFound: currentDateYYYYMMDD, error: null }; // Retorna la tasa y la fecha en que se encontró
                } else {
                    console.warn(`useAccountingData: Tasa no válida en respuesta para ${currentDateYYYYMMDD}.`, rateEntry);
                }
            } else {
                console.warn(`useAccountingData: No se encontró historial en API para ${currentDateYYYYMMDD}.`);
            }
            // Si llegamos aquí, no se encontró tasa para `currentDateToTry`, así que el bucle continuará o terminará.
            specificDateRateError.value = `No hay tasa API para ${currentDateYYYYMMDD}.`; // Mensaje temporal mientras se reintenta

        } catch (error) {
            console.error(`useAccountingData: Catch Error en intento ${i + 1} para ${currentDateYYYYMMDD}:`, error);
            if (i === maxRetries) {
                // --- CAMBIO PARA MENSAJE GENÉRICO ---
                specificDateRateError.value = "Error procesando la respuesta de la API para esta fecha.";
                specificDateRateFetchingLoading.value = false;
                return { rate: null, dateFound: null, error: specificDateRateError.value };
            }
            // Continuar al siguiente reintento si es un error de red u otro
        }
    }

    // Si el bucle termina sin encontrar una tasa
    specificDateRateFetchingLoading.value = false;
    if (!specificDateRateError.value) { // Solo si no se estableció un error más específico
        // --- CAMBIO PARA MENSAJE GENÉRICO ---
        specificDateRateError.value = `Servicio de tasas no disponible para ${dateStringYYYYMMDD} ni días anteriores.`;
    }
    console.log(specificDateRateError.value);
    return { rate: null, dateFound: null, error: specificDateRateError.value };
}
// --- FIN FUNCIÓN MODIFICADA ---
// --- FIN NUEVA FUNCIÓN ---

async function addTransaction(entryData) {
    accountingError.value = null; // Limpiar error previo
    if (!entryData.date || !entryData.description || !entryData.amountBs || !entryData.type) {
        accountingError.value = "Faltan campos requeridos para la transacción."; return null;
    }
    const amountBs = Number(entryData.amountBs);
    if (isNaN(amountBs) || amountBs <= 0) {
        accountingError.value = "Monto en Bs. debe ser positivo."; return null;
    }
    // Asegurarse de que la tasa de cambio (exchangeRate) esté en entryData y sea válida
    // Esta tasa ahora debería venir del modal, obtenida de la API o localmente.
    const rateToUse = Number(entryData.exchangeRate);
    if (isNaN(rateToUse) || rateToUse <= 0) {
        accountingError.value = `Tasa de cambio inválida o no provista para la fecha ${entryData.date}. (${entryData.exchangeRate})`;
        console.error("addTransaction: Tasa inválida o no provista:", entryData.exchangeRate, "para fecha:", entryData.date);
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
        exchangeRate: rateToUse, // Usar la tasa validada
        amountUsd: amountUsd,
        notes: entryData.notes || '',
        createdAt: user.value ? serverTimestamp() : new Date().toISOString(),
        updatedAt: user.value ? serverTimestamp() : new Date().toISOString(),
        userId: user.value ? user.value.uid : null
    };

    const tempId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    // Optimista local (no se guarda directamente aquí, se hace en el modal/vista)
    // Pero necesitamos la estructura completa para el historial.
    const firestoreEntryForHistory = { ...transactionEntry };
    // Para el historial, si es serverTimestamp, Firestore lo manejará.
    // No necesitamos convertirlo a ISO string aquí para el historial.

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const transColRef = collection(db, `users/${user.value.uid}/transactions`);
            const newTransDocRef = doc(transColRef);
            // El objeto que se guarda en Firestore (createdAt/updatedAt son serverTimestamp)
            const firestoreDbEntry = { ...transactionEntry };
            batch.set(newTransDocRef, firestoreDbEntry);

            // Para el historial, usamos firestoreEntryForHistory que tiene los serverTimestamp()
            const changes = getChangeDetails(null, firestoreEntryForHistory, ['id', 'createdAt', 'updatedAt', 'userId']);

            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'TRANSACTION_CREATED',
                    entityType: transactionEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                    entityId: newTransDocRef.id, // Usar el ID que Firestore generará
                    entityName: transactionEntry.description,
                    changes: changes
                }, batch);
            }
            await batch.commit();

            // Devolver la transacción con el ID de Firestore y timestamps resueltos (aproximación)
            const savedTransaction = {
                ...transactionEntry,
                id: newTransDocRef.id,
                // Para devolver, convertir serverTimestamp a algo usable por el cliente si es necesario
                // o simplemente devolver la estructura con los serverTimestamp si el cliente los maneja
                createdAt: new Date().toISOString(), // Aproximación
                updatedAt: new Date().toISOString(), // Aproximación
            };
            transactions.value.unshift(savedTransaction); // Añadir al inicio del array local
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(b.createdAt || 0)) - (new Date(a.createdAt || 0)));
            _updateCurrentDailyRate(); // Actualizar currentDailyRate por si acaso
            accountingError.value = null;
            return savedTransaction;

        } catch (e) {
            console.error("Error al añadir transacción y/o historial a Firestore:", e);
            // El error de Firestore ya está en `e`, y `addEventHistoryEntry` también setea `historyError`.
            // Queremos que `accountingError` refleje el problema principal de la transacción.
            if (e.message.includes("invalid data") && e.message.includes("undefined")) {
                accountingError.value = "Error de datos al guardar en historial (posiblemente valor 'undefined').";
            } else {
                accountingError.value = e.message || "Error al guardar la transacción en servidor.";
            }
            return null;
        }
    } else { // Guardado Local (localStorage)
        const localId = tempId;
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

    // La tasa (exchangeRate) debe venir en updatedEntryData desde el modal
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

    const firestoreEntry = { ...finalTransactionData };
    delete firestoreEntry.id;

    const localEntry = { ...finalTransactionData };
    if (firestoreEntry.updatedAt && typeof firestoreEntry.updatedAt !== 'string') {
        localEntry.updatedAt = new Date().toISOString();
    }

    const firestoreEntryForHistory = { ...finalTransactionData }; // Para el historial
    delete firestoreEntryForHistory.id;


    if (user.value) {
        const batch = writeBatch(db);
        try {
            const transDocRef = doc(db, `users/${user.value.uid}/transactions`, updatedEntryData.id);
            batch.set(transDocRef, firestoreEntry, { merge: true });

            const changes = getChangeDetails(originalTransaction, firestoreEntryForHistory, ['id', 'createdAt', 'updatedAt', 'userId']);
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
            // Actualizar el array local después del commit exitoso
            transactions.value.splice(index, 1, localEntry);
            transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0)));
            _updateCurrentDailyRate();
            accountingError.value = null;
            return true;
        } catch (e) {
            console.error("Error al actualizar transacción y/o historial en Firestore:", e);
            if (e.message.includes("invalid data") && e.message.includes("undefined")) {
                accountingError.value = "Error de datos al guardar en historial (posiblemente valor 'undefined').";
            } else {
                accountingError.value = e.message || "Error al guardar cambios de transacción en servidor.";
            }
            return false;
        }
    } else {
        const changes = getChangeDetails(originalTransaction, localEntry, ['id', 'createdAt', 'updatedAt', 'userId']);
        if (changes.length > 0) {
            await addEventHistoryEntry({
                eventType: 'TRANSACTION_EDITED',
                entityType: localEntry.type === 'income' ? 'Ingreso' : 'Egreso',
                entityId: localEntry.id,
                entityName: localEntry.description,
                changes: changes
            });
        }
        transactions.value.splice(index, 1, localEntry);
        transactions.value.sort((a, b) => new Date(b.date) - new Date(a.date) || (new Date(a.createdAt || 0)) - (new Date(b.createdAt || 0)));
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
                entityId: transactionId, entityName: transactionToDelete.description,
                changes: Object.keys(transactionToDelete).filter(k => !['id', 'createdAt', 'updatedAt', 'userId'].includes(k)).map(key => ({
                    field: key, oldValue: transactionToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            }, batch);
            await batch.commit();
            transactions.value.splice(index, 1); // Eliminar del array local solo después del commit exitoso
            _updateCurrentDailyRate();
            accountingError.value = null;
            return true;
        } catch (e) {
            console.error("Error al eliminar transacción y/o historial de Firestore:", e);
            accountingError.value = "Error al eliminar la transacción."; return false;
        }
    } else {
        await addEventHistoryEntry({
            eventType: 'TRANSACTION_DELETED',
            entityType: transactionToDelete.type === 'income' ? 'Ingreso' : 'Egreso',
            entityId: transactionId, entityName: transactionToDelete.description,
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

// --- Funciones de Cálculo y Filtrado (Existentes) ---
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

// NEW: Add a ref to track what context data has been loaded for
const dataLoadedForContext = ref(null); // Will store user UID or 'local'

watch(
    () => ({ user: user.value, authIsLoading: authLoading.value }),
    (newState, oldState) => {
        const newUserId = newState.user ? newState.user.uid : null;
        const oldUserId = oldState?.user ? oldState.user.uid : null;

        console.log(
            `useAccountingData: Watcher triggered. AuthLoading: ${newState.authIsLoading}, User: ${newUserId}, Previously Loaded for: ${dataLoadedForContext.value}`
        );

        // If authentication is still in progress, do nothing further here.
        if (newState.authIsLoading) {
            // If auth starts loading (e.g., user logs out and login process begins),
            // reset the loaded context so data reloads when auth completes.
            if (dataLoadedForContext.value !== null) { // Only reset if something was loaded before
                console.log("useAccountingData: Auth is now loading. Resetting dataLoadedForContext.");
                dataLoadedForContext.value = null;
            }
            if (!accountingLoading.value) { // Set global loading if not already set
                accountingLoading.value = true;
            }
            return;
        }

        // At this point, newState.authIsLoading is false (authentication is resolved)

        if (newUserId) {
            // User is logged in
            if (dataLoadedForContext.value !== newUserId) {
                console.log(`useAccountingData: Auth resolved for user ${newUserId}. Loading data.`);
                loadAccountingData(newUserId);
                dataLoadedForContext.value = newUserId;
            } else {
                console.log(`useAccountingData: Auth resolved for user ${newUserId}, but data already marked as loaded for this user.`);
                // Ensure accountingLoading is false if we skip loading but it was somehow true
                if (accountingLoading.value && isLoadingData === false) { // isLoadingData is the flag inside loadAccountingData
                    accountingLoading.value = false;
                }
            }
        } else {
            // No user is logged in (auth resolved, user is null)
            if (dataLoadedForContext.value !== 'local') {
                console.log(`useAccountingData: Auth resolved, no user. Loading from localStorage.`);
                loadAccountingData(null); // Load from localStorage
                dataLoadedForContext.value = 'local';
            } else {
                console.log(`useAccountingData: Auth resolved, no user, but data already marked as loaded from localStorage.`);
                if (accountingLoading.value && isLoadingData === false) {
                    accountingLoading.value = false;
                }
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
        rateFetchingLoading, // Para la tasa del día en AccountingView
        specificDateRateFetchingLoading, // NUEVO: para el modal
        accountingError, // Error general y de API para tasa del día
        specificDateRateError, // NUEVO: error específico para la tasa de fecha en modal
        loadAccountingData,
        getRateForDate, // Esta la usaremos como fallback o para fechas muy antiguas
        getRateForExactDate,
        getLatestRateDataBefore,
        updateDailyRate,
        addTransaction,
        saveTransaction,
        deleteTransaction,
        getFilteredTransactions,
        calculateSummary,
        fetchAndUpdateBCVRate, // Para la vista principal (tasa de hoy)
        fetchRateForSpecificDateFromAPI, // NUEVO: para el modal
    };
}