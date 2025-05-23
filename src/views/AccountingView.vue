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
                <p v-else class="text-center text-3xl font-bold text-secondary-700 dark:text-dark-secondary-300 mb-2">
                    {{ currentDailyRate ? formatCurrency(currentDailyRate, '') : (accountingError &&
                        !rateFetchingLoading ? 'Error API' : 'No definida') }}
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
                <p v-if="accountingError && !rateUpdateError" class="text-xs text-danger-600 dark:text-danger-400 mt-1">
                    Error API: {{ accountingError }}
                </p>
                <p v-if="lastRateDate && !rateFetchingLoading"
                    class="text-xs text-text-muted dark:text-dark-text-muted mt-1">
                    Última tasa guardada: {{ formatDate(lastRateDate) }}
                    ({{ currentDailyRate ? formatCurrency(currentDailyRate, '') : 'N/A' }})
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
        <div v-else-if="generalError" class="text-center py-10 text-danger-600 font-medium dark:text-danger-400">
            Error al cargar datos: {{ generalError }}
        </div>
        <div v-else-if="transactions.length === 0 && !accountingLoading"
            class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            No hay transacciones registradas para el periodo seleccionado.
        </div>
        <div v-else class="bg-contrast rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg overflow-x-auto">
            <table class="w-full text-sm text-left">
                <thead
                    class="text-xs text-text-muted uppercase bg-neutral-100 dark:text-dark-text-muted dark:bg-dark-neutral-800">
                    <tr>
                        <th scope="col" class="px-4 py-2">Fecha</th>
                        <th scope="col" class="px-4 py-2">Tipo</th>
                        <th scope="col" class="px-4 py-2">Descripción</th>
                        <th scope="col" class="px-4 py-2">Categoría</th>
                        <th scope="col" class="px-4 py-2 text-right">Monto (Bs.)</th>
                        <th scope="col" class="px-4 py-2 text-right">Tasa (Bs/USD)</th>
                        <th scope="col" class="px-4 py-2 text-right">Monto (USD)</th>
                        <th scope="col" class="px-4 py-2 text-center">Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="tx in filteredTransactions" :key="tx.id"
                        class="bg-contrast border-b last:border-b-0 dark:bg-dark-contrast dark:border-dark-neutral-700">
                        <td class="px-4 py-2 whitespace-nowrap">{{ formatDate(tx.date) }}</td>
                        <td class="px-4 py-2">
                            <span
                                :class="tx.type === 'income' ? 'text-success-700 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'">
                                {{ tx.type === 'income' ? 'Ingreso' : 'Egreso' }}
                            </span>
                        </td>
                        <td class="px-4 py-2">{{ tx.description }}</td>
                        <td class="px-4 py-2">{{ tx.category }}</td>
                        <td class="px-4 py-2 text-right">{{ formatCurrency(tx.amountBs, 'Bs.') }}</td>
                        <td class="px-4 py-2 text-right">{{ tx.exchangeRate ? tx.exchangeRate.toFixed(2) : 'N/A'
                        }}</td>
                        <td class="px-4 py-2 text-right">{{ formatCurrency(tx.amountUsd, '$') }}</td>
                        <td class="px-4 py-2 text-center space-x-2 whitespace-nowrap">
                            <button @click="openEditModal(tx)"
                                class="px-2 py-0.5 text-xs font-medium rounded bg-secondary-600 text-white hover:bg-secondary-700 dark:bg-dark-secondary-500 dark:hover:bg-dark-secondary-600">Editar</button>
                            <button @click="openConfirmDelete(tx)"
                                class="px-2 py-0.5 text-xs font-medium rounded bg-danger-600 text-white hover:bg-danger-700 dark:bg-danger-700 dark:hover:bg-danger-800">Borrar</button>
                        </td>
                    </tr>
                </tbody>
                <tfoot v-if="filteredTransactions.length > 0">
                    <tr class="bg-neutral-100 dark:bg-dark-neutral-800 font-semibold">
                        <td colspan="4" class="px-4 py-2 text-right">Totales del Periodo:</td>
                        <td class="px-4 py-2 text-right">
                            <span
                                :class="summary.netBalance >= 0 ? 'text-success-700 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'">
                                {{ formatCurrency(summary.netBalance, 'Bs.') }}
                            </span>
                        </td>
                        <td colspan="1" class="px-4 py-2 text-right"></td>
                        <td class="px-4 py-2 text-right">
                            <span
                                :class="totalUsdMovimientos >= 0 ? 'text-success-700 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'">
                                {{ formatCurrency(totalUsdMovimientos, '$') }}
                            </span>
                        </td>
                        <td></td>
                    </tr>
                </tfoot>
            </table>
        </div>

        <TransactionModal :show="isTransactionModalOpen" :transaction-data="editingTransaction"
            @close="closeTransactionModal" @save="handleSaveTransaction" />
        <ConfirmationModal :show="isConfirmDeleteOpen" title="Confirmar Eliminación"
            :message="`¿Estás seguro de eliminar la transacción '${transactionNameToDelete}'?`"
            confirmButtonText="Sí, Eliminar" @close="closeConfirmDelete" @confirm="confirmDeleteTransaction" />

    </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'; // Añadido onMounted y watch
import { useAccountingData } from '../composables/useAccountingData';
import TransactionModal from '../components/TransactionModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import { useToast } from 'vue-toastification';

const toast = useToast();
const {
    transactions,
    currentDailyRate,
    exchangeRates, // Para obtener la fecha de la última tasa
    accountingLoading, // Carga general
    rateFetchingLoading, // Carga específica de la tasa API
    accountingError, // Error general y de API
    getRateForDate,
    updateDailyRate,
    addTransaction,
    saveTransaction,
    deleteTransaction,
    getFilteredTransactions,
    calculateSummary,
    fetchAndUpdateBCVRate, // <-- Importar la función para la API
} = useAccountingData();

// --- State for UI ---
const isTransactionModalOpen = ref(false);
const editingTransaction = ref(null);

const isConfirmDeleteOpen = ref(false);
const transactionToDeleteId = ref(null);
const transactionNameToDelete = ref('');

const newRateInput = ref(null);
const rateUpdateError = ref(''); // Error específico para la actualización manual de tasa

// --- State for Filtering ---
const defaultStartDate = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
}
const defaultEndDate = () => {
    return new Date().toISOString().split('T')[0];
}
const filterStartDate = ref(defaultStartDate());
const filterEndDate = ref(defaultEndDate());
const filterType = ref('all');

// --- Computed Properties ---
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


// --- Methods ---
const formatCurrency = (value, symbol = 'Bs. ', useGrouping = true) => {
    if (value === null || value === undefined || isNaN(Number(value))) {
        return `${symbol}0.00`;
    }
    const numericValue = Number(value);
    const options = {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: useGrouping, // Controlar separadores de miles
    };
    // Para Bs. sin símbolo, solo el número formateado
    if (symbol === '' && !useGrouping) { // Utilizado para la tasa del día
        return numericValue.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
    }

    let formatted = numericValue.toLocaleString(symbol === '$' ? 'en-US' : 'es-VE', options);

    if (symbol && symbol !== '$') { // Añadir símbolo si no es USD y se especificó
        return `${symbol}${formatted}`;
    }
    if (symbol === '$') {
        return `$${formatted}`;
    }
    return formatted; // Para el caso de Bs. que ya incluye el símbolo por toLocaleString
};


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
    // Limpiar errores de API antes de intentar guardar
    accountingError.value = null;

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

// Observar cambios en filterStartDate o filterEndDate para recalcular si es necesario
// (actualmente, summary y filteredTransactions son computed, por lo que se actualizan automáticamente)
// No se necesita un watcher explícito aquí para eso.

// Observar accountingError para mostrar toasts si no son manejados localmente
watch(accountingError, (newError) => {
    // Solo mostrar toast si el error no es por rateUpdateError (ya manejado)
    // y si no estamos en medio de una carga de tasa API (rateFetchingLoading)
    // para evitar toasts duplicados o prematuros.
    if (newError && !rateUpdateError.value && !rateFetchingLoading.value) {
        // Podrías añadir una lógica más fina para no mostrar ciertos errores si ya se mostraron
        // toast.error(`Error general: ${newError}`);
    }
});

</script>