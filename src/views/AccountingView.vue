<script setup>
//src/views/AccountingView.vue
import { ref, computed, onMounted, watch } from 'vue'; // Añadido onMounted y watch
import { useAccountingDataStore } from '../stores/accountingData';
import { storeToRefs } from 'pinia';
import { useToast } from 'vue-toastification';
import TransactionModal from '../components/TransactionModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import AccountingTransactionsTable from '../components/AccountingTransactionsTable.vue';
import { formatCurrency } from '../utils/utils.js';
import ErrorMessage from '../components/ErrorMessage.vue';

const toast = useToast();

const accountingStore = useAccountingDataStore();

// El estado (refs) que usas en el template debe ser extraído con storeToRefs
const {
    transactions,
    currentDailyRate,
    exchangeRates,
    accountingLoading,
    rateFetchingLoading,
    accountingError
} = storeToRefs(accountingStore);

// Las acciones (funciones) que usas en el script se extraen directamente
const {
    getRateForDate, // Lo usa openEditModal
    updateDailyRate, // Lo usa handleUpdateRate
    addTransaction, // Lo usa handleSaveTransaction
    saveTransaction, // Lo usa handleSaveTransaction
    deleteTransaction, // Lo usa confirmDeleteTransaction
    getFilteredTransactions, // Lo usa el computed 'filteredTransactions'
    calculateSummary, // Lo usa el computed 'summary'
    fetchAndUpdateBCVRate, // Lo usa triggerAutoRateFetch
} = accountingStore;

// --- State for UI ---
const isTransactionModalOpen = ref(false);
const editingTransaction = ref(null);

const isConfirmDeleteOpen = ref(false);
const transactionToDeleteId = ref(null);
const transactionNameToDelete = ref('');

const newRateInput = ref(null);
const rateUpdateError = ref(''); // Error específico para la actualización manual de tasa

const defaultStartDate = () => {
    const now = new Date();
    now.setDate(now.getDate() - 30); // Restar 30 días a la fecha actual

    // Formatear a YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexados
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const defaultEndDate = () => {
    const now = new Date(); // Fecha local actual

    // Formatear a YYYY-MM-DD
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0'); // Los meses son 0-indexados
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const filterStartDate = ref(defaultStartDate());
const filterEndDate = ref(defaultEndDate());
const filterType = ref('all');

// --- Computed Properties ---
const criticalErrorPreventingDisplay = computed(() => {
    // Prioridad 1: Error al cargar transacciones (no depende de tasas)
    if (accountingError.value && accountingError.value === "Error al cargar datos contables.") { // [cite: 43]
        return accountingError.value;
    }
    // Prioridad 2: Falla de API de tasas Y no hay tasa actual Y no se está cargando
    if (
        accountingError.value &&
        (accountingError.value.includes("API") || accountingError.value.includes("tasa") || accountingError.value.includes("Error al guardar la tasa")) && // Errores relacionados con tasas
        currentDailyRate.value === null && // [cite: 8, 28, 29]
        !rateFetchingLoading.value // [cite: 6]
    ) {
        return `Error al obtener la tasa de cambio: ${accountingError.value}`;
    }
    return null;
});

const showRatePromptMessage = computed(() => {
    // Mostrar prompt si hubo un error relacionado con tasas, no hay tasa, y no se está cargando
    return !!criticalErrorPreventingDisplay.value && // Solo si hay un error crítico que ya impide mostrar la tabla
        criticalErrorPreventingDisplay.value.toLowerCase().includes("tasa") && // Asegurar que el error es sobre tasas
        currentDailyRate.value === null && // [cite: 8, 28, 29]
        !rateFetchingLoading.value; // [cite: 6]
});

const filteredTransactions = computed(() => {
    return getFilteredTransactions({
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
        type: filterType.value,
    });
});

const summary = computed(() => {
    return calculateSummary(filteredTransactions.value);
});

const totalUsdMovimientos = computed(() => {
    return filteredTransactions.value.reduce((accumulator, transaction) => {
        if (transaction.type === 'income') {
            return accumulator + (transaction.amountUsd || 0);
        } else if (transaction.type === 'expense') {
            return accumulator - (transaction.amountUsd || 0);
        }
        return accumulator; // En caso de que haya algún tipo no esperado, no se modifica el acumulador
    }, 0); // El 0 es el valor inicial del acumulador
});

// Para mostrar la fecha de la tasa actual guardada
const lastRateDate = computed(() => {
    if (exchangeRates.value && exchangeRates.value.length > 0) {
        // Asumiendo que exchangeRates está ordenado por fecha descendente en el composable
        return exchangeRates.value[0].date;
    }
    return null;
});

// Un error general para la sección de transacciones, separado del error de la API de tasa
const generalError = computed(() => {
    // Mostrar accountingError si no está relacionado con la carga de la tasa (rateFetchingLoading es false)
    // o si no hay un error específico de actualización manual de tasa.
    if (accountingError.value && !rateFetchingLoading.value && !rateUpdateError.value) {
        return accountingError.value;
    }
    return null;
});

const formatDate = (dateString) => {
    if (!dateString) return '';
    // Asumir que dateString es 'YYYY-MM-DD'
    const date = new Date(dateString + 'T00:00:00'); // Añadir hora para evitar problemas de zona horaria
    return date.toLocaleDateString('es-VE', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const openAddModal = () => {
    if (currentDailyRate.value === null || currentDailyRate.value <= 0) {
        toast.warning("Por favor, establece o actualiza la tasa de cambio del día antes de registrar un movimiento.");
        return;
    }
    editingTransaction.value = null;
    isTransactionModalOpen.value = true;
};

const openEditModal = (transaction) => {
    const rateForTxDate = getRateForDate(transaction.date);
    if (rateForTxDate === null) {
        toast.warning(`No hay una tasa de cambio registrada para la fecha (${formatDate(transaction.date)}) de esta transacción. Se usará la tasa original de la transacción si está disponible, o podría haber errores de cálculo si se modifica el monto en Bs. Considere registrar la tasa para esa fecha.`);
    }
    editingTransaction.value = JSON.parse(JSON.stringify(transaction));
    isTransactionModalOpen.value = true;
};

const closeTransactionModal = () => {
    isTransactionModalOpen.value = false;
    editingTransaction.value = null;
};

const handleSaveTransaction = async (data) => {
    let success = false;
    let message = '';
    const previousAccountingError = accountingError.value; // Guardar error previo si lo hay
    accountingError.value = null; // Limpiar para esta operación específica

    if (data.id) {
        success = await saveTransaction(data);
        message = success ? `Transacción "${data.description}" actualizada.` : (accountingError.value || 'Error al actualizar transacción.');
    } else {
        const savedTx = await addTransaction(data);
        success = !!savedTx;
        message = success ? `Transacción "${data.description}" añadida.` : (accountingError.value || 'Error al añadir transacción.');
    }

    if (success) {
        toast.success(message);
        closeTransactionModal();
    } else {
        toast.error(message);
        // Si la operación falló, y había un error global previo (ej. de API de tasa), restaurarlo
        // si el error actual de la transacción no es más importante o si son diferentes.
        if (previousAccountingError && !accountingError.value) {
            accountingError.value = previousAccountingError;
        }
    }
};

const openConfirmDelete = (transaction) => {
    transactionToDeleteId.value = transaction.id;
    transactionNameToDelete.value = transaction.description;
    isConfirmDeleteOpen.value = true;
};

const closeConfirmDelete = () => {
    isConfirmDeleteOpen.value = false;
    transactionToDeleteId.value = null;
    transactionNameToDelete.value = '';
};

const confirmDeleteTransaction = async () => {
    if (transactionToDeleteId.value) {
        accountingError.value = null;
        const success = await deleteTransaction(transactionToDeleteId.value);
        if (success) {
            toast.success(`Transacción "${transactionNameToDelete.value}" eliminada.`);
        } else {
            toast.error(accountingError.value || "Error al eliminar la transacción.");
        }
        closeConfirmDelete();
    }
};

// Actualizar tasa manualmente
const handleUpdateRate = async () => {
    rateUpdateError.value = '';
    accountingError.value = null; // Limpiar error general de API
    if (newRateInput.value === null || newRateInput.value <= 0) {
        rateUpdateError.value = 'Ingresa una tasa válida.';
        toast.error(rateUpdateError.value);
        return;
    }
    // updateDailyRate ahora puede devolver false y setear accountingError.value
    const success = await updateDailyRate(newRateInput.value);
    if (success) {
        toast.success(`Tasa del día actualizada manualmente a ${formatCurrency(newRateInput.value, '')}`);
        newRateInput.value = null; // Limpiar input
    } else {
        // El error específico debería estar en accountingError.value desde el composable
        rateUpdateError.value = accountingError.value || 'No se pudo actualizar la tasa manualmente.';
        toast.error(rateUpdateError.value);
    }
};

// Obtener tasa desde API
const triggerAutoRateFetch = async () => {
    rateUpdateError.value = ''; // Limpiar error de tasa manual
    accountingError.value = null; // Limpiar error general de API
    await fetchAndUpdateBCVRate(); // Esta función ahora actualiza rateFetchingLoading y accountingError

    if (accountingError.value) { // Si hubo un error en fetchAndUpdateBCVRate
        toast.error(`Error API: ${accountingError.value}`);
    } else {
        toast.success("Tasa del BCV obtenida y actualizada para hoy.");
    }
};

onMounted(async () => {
    // La carga inicial de transacciones y tasas guardadas se maneja por el watcher en useAccountingData
    // Pero queremos obtener la tasa más reciente de la API al cargar la vista.
    await triggerAutoRateFetch();
});

watch(accountingError, (newError) => {
    if (
        newError &&
        !rateFetchingLoading.value && // No mostrar si se está cargando la tasa [cite: 6]
        !rateUpdateError.value && // // CORREGIDO: Verificar si la cadena de error está vacía
        !showRatePromptMessage.value // No mostrar si ya hay un prompt específico para la tasa
    ) {
        // Evitar mostrar un toast genérico si ya estamos pidiendo la tasa manual por un error de API
        // O si el error ya fue manejado por un toast más específico en las funciones de acción.
        // Esta sección es para errores más 'residuales' o 'generales'.
        // Por ejemplo, si "Error al cargar datos contables." no tuviera su propio manejo de UI:
        if (newError === "Error al cargar datos contables.") { // [cite: 43]
            // toast.error(`Error del sistema: ${newError}`); // Ejemplo, si decides activarlo
        }
        // Puedes añadir más condiciones aquí para otros errores generales no cubiertos.
    }
});

</script>

<template>
    <div class="space-y-6">
        <h1 class="text-2xl font-semibold text-primary-800 dark:text-dark-primary-200">
            Registro Contable (Ingresos y Egresos)
        </h1>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="md:col-span-2 bg-contrast p-4 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg space-y-2">
                <h2 class="text-lg font-semibold text-primary-700 dark:text-dark-primary-300 mb-2">Resumen del Periodo
                </h2>
                <div class="flex justify-between text-sm">
                    <span class="text-text-muted dark:text-dark-text-muted">Total Ingresos (Bs.):</span>
                    <span class="font-medium text-success-700 dark:text-success-400">{{
                        formatCurrency(summary.totalIncome, 'Bs.') }}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-text-muted dark:text-dark-text-muted">Total Egresos (Bs.):</span>
                    <span class="font-medium text-danger-600 dark:text-danger-400">{{
                        formatCurrency(summary.totalExpenses, 'Bs.') }}</span>
                </div>
                <hr class="border-neutral-200 dark:border-dark-neutral-700 my-1">
                <div class="flex justify-between text-sm font-bold">
                    <span class="text-text-base dark:text-dark-text-base">Saldo Neto (Bs.):</span>
                    <span
                        :class="summary.netBalance >= 0 ? 'text-success-700 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'">
                        {{ formatCurrency(summary.netBalance, 'Bs.') }}
                    </span>
                </div>
            </div>

            <div class="bg-contrast p-4 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg space-y-2">
                <h2 class="text-lg font-semibold text-primary-700 dark:text-dark-primary-300 mb-2">Tasa del Día (Bs/USD)
                </h2>
                <div v-if="rateFetchingLoading" class="text-center py-2">
                    <p class="text-sm text-text-muted dark:text-dark-text-muted italic">Obteniendo tasa BCV...</p>
                </div>
                <p v-else-if="currentDailyRate"
                    class="text-center text-3xl font-bold text-secondary-700 dark:text-dark-secondary-300 mb-2">
                    {{ formatCurrency(currentDailyRate, '', false) }}
                </p>
                <p v-else-if="!accountingError && !currentDailyRate"
                    class="text-center text-3xl font-bold text-warning-600 dark:text-warning-400 mb-2">
                    No definida
                </p>
                <p v-else-if="accountingError && !showRatePromptMessage"
                    class="text-center text-3xl font-bold text-danger-600 dark:text-danger-400 mb-2">
                    Error API
                </p>
                <div class="flex gap-2 items-start">
                    <div class="flex-grow">
                        <input type="number" v-model.number="newRateInput" placeholder="Tasa manual" min="0" step="any"
                            :disabled="rateFetchingLoading"
                            class="flex-grow mt-1 block w-full px-3 py-1.5 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500 sm:text-sm dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                        <button @click="handleUpdateRate"
                            :disabled="!newRateInput || newRateInput <= 0 || rateFetchingLoading"
                            class="w-full mt-1 px-3 py-1.5 bg-accent-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400">
                            Actualizar Manual
                        </button>
                    </div>
                    <button @click="triggerAutoRateFetch" :disabled="rateFetchingLoading"
                        title="Obtener tasa del BCV desde la API"
                        class="p-2 mt-1 bg-blue-500 text-white rounded-md shadow-sm hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-blue-600 dark:hover:bg-blue-700">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd"
                                d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z"
                                clip-rule="evenodd" />
                        </svg>
                    </button>
                </div>
                <p v-if="rateUpdateError" class="text-xs text-danger-600 dark:text-danger-400 mt-1">{{ rateUpdateError
                    }}</p>
                <p v-if="accountingError && !rateUpdateError && !showRatePromptMessage"
                    class="text-xs text-danger-600 dark:text-danger-400 mt-1">
                    Error API: {{ accountingError }}
                </p>
                <p v-if="lastRateDate && !rateFetchingLoading"
                    class="text-xs text-text-muted dark:text-dark-text-muted mt-1">
                    Última tasa guardada: {{ formatDate(lastRateDate) }}
                    ({{ currentDailyRate ? formatCurrency(currentDailyRate, '', false) : 'N/A' }})
                </p>
            </div>
        </div>

        <div
            class="flex flex-wrap justify-between items-center gap-4 bg-contrast p-4 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
            <div class="flex flex-wrap items-center gap-3">
                <label for="startDate"
                    class="text-sm font-medium text-text-base dark:text-dark-text-base">Desde:</label>
                <input type="date" id="startDate" v-model="filterStartDate" class="input-filter-style">

                <label for="endDate"
                    class="text-sm font-medium text-text-base dark:text-dark-text-base ml-2">Hasta:</label>
                <input type="date" id="endDate" v-model="filterEndDate" class="input-filter-style">

                <label for="typeFilter"
                    class="text-sm font-medium text-text-base dark:text-dark-text-base ml-2">Tipo:</label>
                <select id="typeFilter" v-model="filterType" class="input-filter-style !pr-8">
                    <option value="all">Todos</option>
                    <option value="income">Ingreso</option>
                    <option value="expense">Egreso</option>
                </select>
            </div>

            <button @click="openAddModal"
                class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold rounded-lg shadow hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 transition-all duration-150 dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400">
                + Registrar Movimiento
            </button>
        </div>


        <div v-if="accountingLoading && !transactions.length"
            class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            Cargando transacciones...
        </div>
        <div v-else-if="criticalErrorPreventingDisplay"
            class="text-center py-10 text-danger-600 font-medium dark:text-danger-400">
            <ErrorMessage :message="criticalErrorPreventingDisplay">
                <template v-if="showRatePromptMessage">
                    <p class="mt-4 text-sm text-text-muted dark:text-dark-text-muted">
                        Por favor, ingrese la tasa del día manualmente en la sección "Tasa del Día (Bs/USD)" más arriba
                        para continuar.
                    </p>
                </template>
            </ErrorMessage>
        </div>
        <div v-else-if="transactions.length === 0 && !accountingLoading"
            class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            No hay transacciones registradas para el periodo seleccionado.
        </div>
        <div v-else class="bg-contrast rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg overflow-x-auto">
            <AccountingTransactionsTable :records="filteredTransactions" @edit-transaction="openEditModal"
                @delete-transaction="openConfirmDelete" />
        </div>

        <TransactionModal :show="isTransactionModalOpen" :transaction-data="editingTransaction"
            @close="closeTransactionModal" @save="handleSaveTransaction" />
        <ConfirmationModal :show="isConfirmDeleteOpen" title="Confirmar Eliminación"
            :message="`¿Estás seguro de eliminar la transacción '${transactionNameToDelete}'?`"
            confirmButtonText="Sí, Eliminar" @close="closeConfirmDelete" @confirm="confirmDeleteTransaction" />
    </div>
</template>