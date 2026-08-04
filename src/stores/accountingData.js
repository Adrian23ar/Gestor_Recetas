// src/stores/accountingData.js
import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useAuth } from '../composables/useAuth';
import { db } from '../main';
import { collection, doc, getDocs, setDoc, deleteDoc, addDoc, writeBatch, query, where, orderBy, limit, Timestamp, serverTimestamp } from "firebase/firestore";
import { useLocalStorage } from '../composables/useLocalStorage';
import { useEventHistory } from '../composables/useEventHistory';
import {
    normalizeRateEntry,
    normalizeTransaction,
    parseApiRates,
    toUsdBcv,
} from '../utils/currency.js';

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
    // Tasa BCV vigente (Bs/USD). Se conserva como número suelto porque es la
    // única obligatoria: sin ella no hay unidad canónica y media app se queda sin
    // poder convertir. Las tres juntas van en currentRates.
    const currentDailyRate = ref(null);
    const currentRates = ref({ bcv: null, eur: null, binance: null });

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
            // Campos anteriores a la multimoneda: se conservan porque los eventos
            // ya registrados los siguen nombrando.
            amountBs: 'Monto (Bs.)',
            exchangeRate: 'Tasa de Cambio (Bs/USD)',
            amountUsd: 'Monto (USD)',
            rate: 'Tasa BCV (Bs/USD)',
            // Multimoneda
            amountOriginal: 'Monto',
            currencyOriginal: 'Moneda',
            amountUsdBcv: 'Equivalente (USD BCV)',
            rateBcvApplied: 'Tasa BCV aplicada (Bs/USD)',
            rateEurApplied: 'Tasa EUR aplicada (Bs/EUR)',
            rateBinanceApplied: 'Tasa USDT aplicada (Bs/USDT)',
            rateEur: 'Tasa BCV (Bs/EUR)',
            rateBinance: 'Tasa USDT (Bs/USDT)',
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

            // Sin fila de hoy se cae a la más reciente guardada, para no dejar la
            // app sin tasas: es preferible una tasa vieja y visible (la tarjeta
            // muestra de qué día es) que no poder convertir nada.
            const source = rateForToday || exchangeRates.value[0] || null;
            currentRates.value = normalizeRateEntry(source);
            currentDailyRate.value = currentRates.value.bcv;
        } else {
            currentRates.value = { bcv: null, eur: null, binance: null };
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

                // normalizeTransaction resuelve EN LA LECTURA los movimientos
                // anteriores a la multimoneda (amountBs/exchangeRate/amountUsd).
                // No se reescribe nada en Firestore: se interpretan, no se migran.
                transactions.value = transSnapshot.docs.map(doc => normalizeTransaction({ id: doc.id, ...doc.data() }));
                exchangeRates.value = ratesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

                console.log(`useAccountingData: Cargadas ${transactions.value.length} transacciones y ${exchangeRates.value.length} tasas desde Firestore.`);
            } else {
                transactions.value = JSON.parse(localStorage.getItem(TRANSACTIONS_STORAGE_KEY) || '[]').map(normalizeTransaction);
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


    // --- Lógica de Obtención de Tasas ---
    async function getRatesFromApi(specificDate = null) {
        const now = new Date();
        const todayString = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const dateToFetch = specificDate || todayString;

        // 1. VERIFICAR SI YA EXISTE EN LA BASE DE DATOS (FIREBASE)
        const existingRates = getRatesForExactDate(dateToFetch);
        const cached = existingRates && existingRates.bcv ? existingRates : null;
        // OJO: "tengo la del BCV" ya NO alcanza para dar la caché por buena — era
        // cierto cuando existía una sola tasa. Los registros guardados antes de la
        // multimoneda (y los de hoy, si se creó antes de este cambio) traen sólo
        // el BCV, y quedarse con ellos dejaba EUR y USDT en null para siempre.
        const cacheIsComplete = cached && cached.eur && cached.binance;

        // Se sale por caché si está completa, o si la fecha NO es hoy: la API no
        // tiene histórico, así que completar una fecha pasada con las tasas de hoy
        // sería atribuirle valores que no le corresponden. Para esas fechas, la
        // carga manual del modal es el camino correcto.
        if (cached && (cacheIsComplete || dateToFetch !== todayString)) {
            console.log(`[Caché] Tasas encontradas en base de datos para ${dateToFetch}:`, cached);
            return [{ rates: cached, usd: cached.bcv, date: dateToFetch, source: 'Firebase' }];
        }

        // 2. SI FALTA ALGO, CONSULTAR LA API PÚBLICA. Ojo: dolarflashve.eu/api/rates/all
        // sólo expone las tasas vigentes "ahora mismo", no admite consultar fechas
        // pasadas — una fecha pasada nunca antes consultada recibirá las de hoy.
        rateFetchingLoading.value = true;
        accountingError.value = null;

        try {
            console.log(`[API] Consultando tasa BCV para fecha: ${dateToFetch}...`);
            const configuredUrl = import.meta.env.VITE_DOLARVENEZUELA_API_URL;
            // En dev, la petición directa al host externo falla por CORS (el servidor
            // sólo permite su propio origen) — se enruta por el proxy de vite.config.js
            // (/api-dolar -> https://dolarflashve.eu/api), que hace la petición server-side.
            const apiUrl = import.meta.env.DEV
                ? configuredUrl.replace('https://dolarflashve.eu/api', '/api-dolar')
                : configuredUrl;

            const response = await fetch(apiUrl);

            if (!response.ok) {
                throw new Error(`Error ${response.status}: Fallo en la comunicación con el servidor.`);
            }

            const data = await response.json();
            // La API expone bcvUsd, bcvEur, binanceBuy y binanceSell. USDT no
            // viene dado: parseApiRates promedia compra y venta de Binance.
            const parsed = parseApiRates(data);

            if (parsed.bcv) {
                // 3. GUARDAR AUTOMÁTICAMENTE PARA FUTURAS CONSULTAS.
                // Si ya había algo guardado para esta fecha se COMPLETA lo que falta
                // en vez de pisarlo: una tasa cargada a mano (típicamente cuando la
                // API venía mal o caída) no debe perderse porque la app se recargó.
                const toSave = cached
                    ? {
                        bcv: cached.bcv,
                        eur: cached.eur || parsed.eur,
                        binance: cached.binance || parsed.binance,
                    }
                    : parsed;

                console.log(`[Registro] Guardando tasas en base de datos para ${dateToFetch}:`, toSave);
                await updateDailyRate(toSave, dateToFetch);

                return [{
                    rates: toSave,
                    usd: toSave.bcv,
                    date: dateToFetch,
                    source: 'BCV'
                }];
            } else {
                throw new Error('La API no devolvió una tasa BCV válida.');
            }
        } catch (error) {
            console.error("Error en el flujo de tasa de cambio:", error);
            // Se llegó acá con caché parcial (faltaba EUR o USDT) y la API falló:
            // vale más la tasa BCV que ya estaba guardada que quedarse sin nada.
            // Las que falten se cargan a mano desde el modal o la tarjeta de tasas.
            if (cached) {
                console.warn(`[Caché] API no disponible; se usan las tasas guardadas para ${dateToFetch}.`);
                return [{ rates: cached, usd: cached.bcv, date: dateToFetch, source: 'Firebase' }];
            }
            accountingError.value = "No se pudo obtener ni guardar la tasa de cambio.";
            return [];
        } finally {
            rateFetchingLoading.value = false;
        }
    }

    async function fetchAndUpdateBCVRate() {
        // Ahora getRatesFromApi ya busca las tasas de "hoy" por defecto
        const ratesList = await getRatesFromApi();

        if (ratesList.length > 0) {
            const latest = ratesList[0];
            // Actualizamos la base de datos de Firebase con el juego completo
            const success = await updateDailyRate(latest.rates, latest.date);
            return success;
        }
        return false;
    }

    async function fetchRateForSpecificDateFromAPI(dateStringYYYYMMDD) {
        specificDateRateFetchingLoading.value = true;

        // Esta llamada ahora internamente verifica si existe en BD antes de ir a la API
        const ratesList = await getRatesFromApi(dateStringYYYYMMDD);

        specificDateRateFetchingLoading.value = false;

        if (ratesList.length > 0) {
            const rateData = ratesList[0];
            specificDateRateError.value = null;
            return {
                rates: rateData.rates,
                rate: rateData.usd,
                dateFound: rateData.date,
                error: null
            };
        }

        specificDateRateError.value = `No se pudo obtener tasa para la fecha ${dateStringYYYYMMDD}.`;
        return { rates: null, rate: null, dateFound: null, error: specificDateRateError.value };
    }

    // Las funciones que devuelven un número suelto siguen entregando SÓLO la tasa
    // BCV (compatibilidad con lo que ya las llamaba). Las que terminan en
    // "...Rates..." devuelven el juego completo {bcv, eur, binance}, que es lo
    // que necesita cualquier cosa que trabaje con EUR o USDT.
    function getRateForDate(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        exchangeRates.value.sort((a, b) => new Date(b.date) - new Date(a.date)); // Asegurar orden
        const foundRate = exchangeRates.value.find(rate => rate.date <= targetDateString);
        return foundRate ? normalizeRateEntry(foundRate).bcv : null;
    }
    function getRateForExactDate(targetDateString) {
        return getRatesForExactDate(targetDateString)?.bcv ?? null;
    }

    function getRatesForExactDate(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        // Busca una coincidencia exacta de fecha, sin usar "<="
        const found = exchangeRates.value.find(rate => rate.date === targetDateString);
        return found ? normalizeRateEntry(found) : null;
    }

    function getLatestRateDataBefore(targetDateString) {
        if (!exchangeRates.value || exchangeRates.value.length === 0) {
            return null;
        }
        // Aseguramos que las tasas estén ordenadas de más nueva a más vieja
        const sortedRates = [...exchangeRates.value].sort((a, b) => new Date(b.date) - new Date(a.date));

        // Buscamos la primera tasa que sea en o antes de la fecha objetivo
        const foundRateData = sortedRates.find(rate => rate.date <= targetDateString);
        if (!foundRateData) return null;

        // Se conserva `rate` (número) por compatibilidad y se agrega el juego completo.
        const rates = normalizeRateEntry(foundRateData);
        return { ...foundRateData, rate: rates.bcv, rates };
    }

    // --- INICIO REFACTOR 1.3 ---
    /**
     * @param {number|{bcv?:number, eur?:number, binance?:number}} rateInput
     *   Un número se interpreta como la tasa BCV sola (así la llaman el botón
     *   "Manual" y el modal de transacción). Un objeto permite guardar el juego
     *   completo. Las tasas que vengan vacías NO borran lo ya guardado para esa
     *   fecha: se mezclan, para que un ajuste manual del BCV no tumbe el EUR o
     *   el USDT que la API sí había traído.
     */
    async function updateDailyRate(rateInput, dateString = null) {
        const incoming = typeof rateInput === 'object' && rateInput !== null
            ? rateInput
            : { bcv: rateInput };

        const asRate = (v) => {
            const n = Number(v);
            return Number.isFinite(n) && n > 0 ? n : null;
        };

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

        const originalRateEntry = exchangeRates.value.find(r => r.id === resolvedTargetDateString);
        const previous = normalizeRateEntry(originalRateEntry);

        const merged = {
            bcv: asRate(incoming.bcv) ?? previous.bcv,
            eur: asRate(incoming.eur) ?? previous.eur,
            binance: asRate(incoming.binance) ?? previous.binance,
        };

        if (!merged.bcv) {
            accountingError.value = "La tasa de cambio debe ser un número positivo.";
            console.error("updateDailyRate: Tasa BCV inválida:", rateInput);
            return false;
        }

        const rateEntry = {
            id: resolvedTargetDateString,
            date: resolvedTargetDateString,
            // `rate` se sigue escribiendo con el valor BCV: es lo que leen los
            // documentos y el código anteriores a la multimoneda.
            rate: merged.bcv,
            rateBcv: merged.bcv,
            rateEur: merged.eur,
            rateBinance: merged.binance,
            timestamp: user.value ? serverTimestamp() : new Date().toISOString(),
            userId: user.value ? user.value.uid : null,
        };

        const RATE_LABELS = { bcv: 'Tasa BCV (Bs/USD)', eur: 'Tasa BCV (Bs/EUR)', binance: 'Tasa USDT (Bs/USDT)' };
        const rateChanges = ['bcv', 'eur', 'binance']
            .filter(key => previous[key] !== merged[key])
            .map(key => ({
                field: key === 'bcv' ? 'rate' : (key === 'eur' ? 'rateEur' : 'rateBinance'),
                oldValue: previous[key],
                newValue: merged[key],
                label: RATE_LABELS[key],
            }));

        if (originalRateEntry && rateChanges.length === 0) {
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
                changes: rateChanges
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
                changes: rateChanges
            });
            accountingError.value = null;
            return true;
        }
    }

    /**
     * Arma el cuerpo multimoneda de un movimiento a partir de lo que manda el
     * modal. Devuelve { entry } o { error }.
     *
     * El snapshot de tasas (rate*Applied) es deliberado: un movimiento viejo NO
     * debe cambiar de valor porque cambió la tasa de hoy. Por eso amountUsdBcv
     * se congela acá y nunca se recalcula al leer.
     */
    function _buildTransactionBody(entryData) {
        const amount = Number(entryData.amountOriginal);
        if (isNaN(amount) || amount <= 0) {
            return { error: "El monto debe ser positivo." };
        }

        const currency = entryData.currencyOriginal || 'VES';
        const rates = entryData.rates || {};
        const amountUsdBcv = toUsdBcv(amount, currency, rates);

        if (amountUsdBcv === null) {
            return { error: `Faltan tasas de cambio para registrar un movimiento en ${currency} con fecha ${entryData.date}.` };
        }

        return {
            entry: {
                type: entryData.type,
                date: entryData.date,
                description: entryData.description,
                category: entryData.category || 'General',
                amountOriginal: amount,
                currencyOriginal: currency,
                rateBcvApplied: rates.bcv ?? null,
                rateEurApplied: rates.eur ?? null,
                rateBinanceApplied: rates.binance ?? null,
                amountUsdBcv: Number(amountUsdBcv.toFixed(6)),
                notes: entryData.notes || '',
            },
        };
    }

    async function addTransaction(entryData) {
        accountingError.value = null;
        if (!entryData.date || !entryData.description || !entryData.amountOriginal || !entryData.type) {
            accountingError.value = "Faltan campos requeridos para la transacción."; return null;
        }

        const { entry, error } = _buildTransactionBody(entryData);
        if (error) {
            accountingError.value = error; return null;
        }

        const transactionEntry = {
            ...entry,
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

        const { entry, error } = _buildTransactionBody(updatedEntryData);
        if (error) {
            accountingError.value = error; return false;
        }

        const finalTransactionData = {
            ...originalTransaction,
            ...updatedEntryData,
            ...entry,
            id: updatedEntryData.id,
            updatedAt: user.value ? serverTimestamp() : new Date().toISOString(),
        };
        // `rates` es el juego de tasas que manda el modal para calcular, no un
        // campo del documento: se queda fuera de lo que se persiste.
        delete finalTransactionData.rates;

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

    /**
     * Totales en la UNIDAD CANÓNICA (USD a tasa BCV). Es lo único que permite
     * sumar movimientos cargados en monedas distintas: nunca totalizar sobre
     * amountOriginal, que mezcla bolívares con dólares, euros y USDT.
     * La vista convierte estos totales a la moneda que elija el usuario.
     */
    function calculateSummary(filteredList) {
        const summary = filteredList.reduce((acc, tx) => {
            const amount = Number(tx.amountUsdBcv) || 0;
            if (tx.type === 'income') {
                acc.totalIncome += amount;
            } else if (tx.type === 'expense') {
                acc.totalExpenses += amount;
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
        currentRates,
        accountingLoading,
        rateFetchingLoading,
        specificDateRateFetchingLoading,
        accountingError,
        specificDateRateError,
        loadAccountingData,
        getRateForDate,
        getRateForExactDate,
        getRatesForExactDate,
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