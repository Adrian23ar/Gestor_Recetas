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
                        formatCurrency(summary.totalIncome) }}</span>
                </div>
                <div class="flex justify-between text-sm">
                    <span class="text-text-muted dark:text-dark-text-muted">Total Egresos (Bs.):</span>
                    <span class="font-medium text-danger-600 dark:text-danger-400">{{
                        formatCurrency(summary.totalExpenses) }}</span>
                </div>
                <hr class="border-neutral-200 dark:border-dark-neutral-700 my-1">
                <div class="flex justify-between text-sm font-bold">
                    <span class="text-text-base dark:text-dark-text-base">Saldo Neto (Bs.):</span>
                    <span
                        :class="summary.netBalance >= 0 ? 'text-success-700 dark:text-success-400' : 'text-danger-600 dark:text-danger-400'">
                        {{ formatCurrency(summary.netBalance) }}
                    </span>
                </div>
            </div>

            <div class="bg-contrast p-4 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg space-y-2">
                <h2 class="text-lg font-semibold text-primary-700 dark:text-dark-primary-300 mb-2">Tasa del Día (Bs/USD)
                </h2>
                <p class="text-center text-3xl font-bold text-secondary-700 dark:text-dark-secondary-300 mb-2">
                    {{ currentDailyRate ? formatCurrency(currentDailyRate, '') : 'No definida' }}
                </p>
                <div class="flex gap-2 items-center">
                    <input type="number" v-model.number="newRateInput" placeholder="Nueva tasa" min="0" step="any"
                        class="flex-grow mt-1 block w-full px-3 py-1.5 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-accent-500 focus:border-accent-500 sm:text-sm dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    <button @click="handleUpdateRate" :disabled="!newRateInput || newRateInput <= 0"
                        class="px-3 py-1.5 mt-1 bg-accent-500 text-white text-sm font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400">
                        Actualizar
                    </button>
                </div>
                <p v-if="rateUpdateError" class="text-xs text-danger-600 dark:text-danger-400 mt-1">{{ rateUpdateError
                    }}</p>
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

        <div v-if="accountingLoading" class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            Cargando transacciones...
        </div>
        <div v-else-if="accountingError" class="text-center py-10 text-danger-600 font-medium dark:text-danger-400">
            Error al cargar transacciones: {{ accountingError }}
        </div>
        <div v-else-if="transactions.length === 0"
            class="text-center py-10 text-text-muted italic dark:text-dark-text-muted">
            No hay transacciones registradas.
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
                        <td class="px-4 py-2 text-right">{{ formatCurrency(tx.amountBs) }}</td>
                        <td class="px-4 py-2 text-right text-xs">{{ tx.exchangeRate ? tx.exchangeRate.toFixed(2) : 'N/A'
                            }}</td>
                        <td class="px-4 py-2 text-right">{{ formatCurrency(tx.amountUsd) }}</td>
                        <td class="px-4 py-2 text-center space-x-2">
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
                        <td class="px-4 py-2 text-right">{{ formatCurrency(summary.totalIncome - summary.totalExpenses)
                            }}</td>
                        <td colspan="2"></td>
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
import { ref, computed, watch, onMounted } from 'vue';
import { useAccountingData } from '../composables/useAccountingData';
import TransactionModal from '../components/TransactionModal.vue'; // Ajusta la ruta
import ConfirmationModal from '../components/ConfirmationModal.vue'; // Ajusta la ruta
import { useToast } from 'vue-toastification';

const toast = useToast();
const {
    transactions,
    exchangeRates, // Lo necesitamos para la lógica de getRateForDate internamente
    currentDailyRate,
    accountingLoading,
    accountingError,
    loadAccountingData, // Podría usarse para recarga manual si es necesario
    getRateForDate, // Necesario para validar tasa antes de abrir modal de edición?
    updateDailyRate,
    addTransaction,
    saveTransaction,
    deleteTransaction,
    getFilteredTransactions,
    calculateSummary,
} = useAccountingData();

// --- State for UI ---
const isTransactionModalOpen = ref(false);
const editingTransaction = ref(null); // null for adding, object for editing

const isConfirmDeleteOpen = ref(false);
const transactionToDeleteId = ref(null);
const transactionNameToDelete = ref('');

const newRateInput = ref(null);
const rateUpdateError = ref('');

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
const filterType = ref('all'); // 'all', 'income', 'expense'
const filterCategory = ref(''); // Not implemented in filter yet

// --- Computed Properties ---
const filteredTransactions = computed(() => {
    return getFilteredTransactions({
        startDate: filterStartDate.value,
        endDate: filterEndDate.value,
        type: filterType.value,
        // category: filterCategory.value, // Añadir cuando se implemente
    });
});

const summary = computed(() => {
    return calculateSummary(filteredTransactions.value);
});

// --- Methods ---
const formatCurrency = (value, symbol = 'Bs. ') => {
    if (typeof value !== 'number') return `${symbol}0.00`;
    return `${symbol}${value.toFixed(2).replace(/\d(?=(\d{3})+\.)/g, '$&,')}`; // Basic formatting
}
const formatDate = (dateString) => {
    if (!dateString) return '';
    const [year, month, day] = dateString.split('-');
    return `${day}/${month}/${year}`;
}

const openAddModal = () => {
    if (currentDailyRate.value === null) {
        toast.warning("Por favor, establece la tasa de cambio del día antes de registrar un movimiento.");
        return;
    }
    editingTransaction.value = null; // Asegura que es modo 'añadir'
    isTransactionModalOpen.value = true;
};

const openEditModal = (transaction) => {
    const rateExists = getRateForDate(transaction.date);
    if (rateExists === null && transaction.exchangeRate <= 0) { // Permitir editar si ya tenía una tasa guardada, pero no si no tenía y no hay para esa fecha
        toast.error(`No se encontró tasa de cambio para la fecha (${transaction.date}) de esta transacción. No se puede editar.`);
        return;
    }
    editingTransaction.value = JSON.parse(JSON.stringify(transaction)); // Pasar copia
    isTransactionModalOpen.value = true;
};

const closeTransactionModal = () => {
    isTransactionModalOpen.value = false;
    editingTransaction.value = null;
};

const handleSaveTransaction = async (data) => {
    let success = false;
    let message = '';
    if (data.id) { // Editing existing
        success = await saveTransaction(data);
        message = success ? `Transacción "${data.description}" actualizada.` : 'Error al actualizar transacción.';
    } else { // Adding new
        const savedTx = await addTransaction(data);
        success = !!savedTx;
        message = success ? `Transacción "${data.description}" añadida.` : 'Error al añadir transacción.';
    }

    if (success) {
        toast.success(message);
        closeTransactionModal();
    } else {
        toast.error(accountingError.value || message); // Muestra el error específico si existe
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
        const success = await deleteTransaction(transactionToDeleteId.value);
        if (success) {
            toast.success(`Transacción "${transactionNameToDelete.value}" eliminada.`);
        } else {
            toast.error(accountingError.value || "Error al eliminar la transacción.");
        }
        closeConfirmDelete();
    }
};

const handleUpdateRate = async () => {
    rateUpdateError.value = '';
    if (newRateInput.value === null || newRateInput.value <= 0) {
        rateUpdateError.value = 'Ingresa una tasa válida.';
        return;
    }
    const success = await updateDailyRate(newRateInput.value);
    if (success) {
        toast.success(`Tasa del día actualizada a ${newRateInput.value}`);
        newRateInput.value = null; // Limpiar input
    } else {
        toast.error(accountingError.value || 'No se pudo actualizar la tasa.');
    }
};

// Podrías llamar a loadAccountingData en onMounted si no confías en los watchers
// onMounted(() => {
//   if (!user.value && !authLoading.value) {
//      loadAccountingData();
//   }
// });

</script>

<style scoped>
/* Estilos específicos si son necesarios */

</style>