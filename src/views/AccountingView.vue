<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useAccountingDataStore } from '../stores/accountingData';
import { storeToRefs } from 'pinia';
import { useToast } from 'vue-toastification';
import TransactionModal from '../components/TransactionModal.vue';
import DateField from '../components/ui/DateField.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import AccountingTransactionsTable from '../components/AccountingTransactionsTable.vue';
import { formatCurrency } from '../utils/utils.js';
import ErrorMessage from '../components/ErrorMessage.vue';
import { useViewTutorial } from '../composables/useTutorial.js';
import { accountingTour } from '../utils/tourSteps.js';
import { CURRENCIES, currencySymbol, fromUsdBcv } from '../utils/currency.js';

const toast = useToast();
const accountingStore = useAccountingDataStore();

const {
    transactions,
    currentDailyRate,
    currentRates,
    exchangeRates,
    accountingLoading,
    rateFetchingLoading,
    accountingError
} = storeToRefs(accountingStore);

const {
    getRateForDate,
    updateDailyRate,
    addTransaction,
    saveTransaction,
    deleteTransaction,
    getFilteredTransactions,
    calculateSummary,
    fetchAndUpdateBCVRate,
} = accountingStore;

const isTransactionModalOpen = ref(false);
const editingTransaction = ref(null);

const isConfirmDeleteOpen = ref(false);
const transactionToDeleteId = ref(null);
const transactionNameToDelete = ref('');

const showManualRate = ref(false);
const newRateInputs = ref({ bcv: null, eur: null, binance: null });
const rateUpdateError = ref('');

// Moneda en la que se MUESTRAN los totales. No afecta lo guardado: cada
// movimiento conserva su monto y su moneda original — esto sólo convierte la
// unidad canónica (USD BCV) para leerla cómodo.
const displayCurrency = ref('VES');
const RATE_ROWS = [
    { key: 'bcv', label: 'BCV', unit: 'Bs/USD' },
    { key: 'eur', label: 'Euro', unit: 'Bs/EUR' },
    { key: 'binance', label: 'USDT', unit: 'Bs/USDT' },
];

const defaultStartDate = () => {
    const now = new Date();
    now.setDate(now.getDate() - 30);
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const defaultEndDate = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const filterStartDate = ref(defaultStartDate());
const filterEndDate = ref(defaultEndDate());
const filterType = ref('all');

const criticalErrorPreventingDisplay = computed(() => {
    if (accountingError.value && accountingError.value === "Error al cargar datos contables.") {
        return accountingError.value;
    }
    if (
        accountingError.value &&
        (accountingError.value.includes("API") || accountingError.value.includes("tasa") || accountingError.value.includes("Error al guardar la tasa")) &&
        currentDailyRate.value === null &&
        !rateFetchingLoading.value
    ) {
        return `Error al obtener la tasa de cambio: ${accountingError.value}`;
    }
    return null;
});

const showRatePromptMessage = computed(() => {
    return !!criticalErrorPreventingDisplay.value &&
        criticalErrorPreventingDisplay.value.toLowerCase().includes("tasa") &&
        currentDailyRate.value === null &&
        !rateFetchingLoading.value;
});

const filteredTransactions = computed(() => getFilteredTransactions({
    startDate: filterStartDate.value,
    endDate: filterEndDate.value,
    type: filterType.value,
}));

const summary = computed(() => calculateSummary(filteredTransactions.value));

useViewTutorial(
    {
        id: 'contabilidad',
        getSteps: () => accountingTour({ hasTransactions: filteredTransactions.value.length > 0 }),
    },
    // La tasa se busca en onMounted; se espera a que termine para no abrir el
    // tutorial con la tarjeta de tasa todavía en "…".
    () => !accountingLoading.value && !rateFetchingLoading.value,
);

const lastRateDate = computed(() => {
    if (exchangeRates.value && exchangeRates.value.length > 0) {
        return exchangeRates.value[0].date;
    }
    return null;
});

// summary viene en la unidad canónica (USD BCV); esto lo lleva a la moneda
// elegida. null = faltan tasas para esa conversión, y la UI lo muestra como
// "N/D" en vez de inventar un 0.
function toDisplay(amountUsd) {
    return fromUsdBcv(amountUsd, displayCurrency.value, currentRates.value);
}

function formatDisplay(amountUsd) {
    const value = toDisplay(amountUsd);
    if (value === null) return 'N/D';
    // USDT no tiene símbolo de prefijo: va detrás del número. El resto usa el
    // suyo delante, como el resto de la app (formatCurrency elige el locale
    // es-VE justamente por el símbolo 'Bs.').
    if (displayCurrency.value === 'USDT') return `${formatCurrency(value, '')} USDT`;
    return formatCurrency(value, currencySymbol(displayCurrency.value));
}

const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
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
        toast.warning(`No hay una tasa de cambio registrada para la fecha (${formatDate(transaction.date)}) de esta transacción. Se usará la tasa original si está disponible.`);
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
    const previousAccountingError = accountingError.value;
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

const handleUpdateRate = async () => {
    rateUpdateError.value = '';
    accountingError.value = null;

    // Sólo se envían las que el usuario llenó: updateDailyRate mezcla con lo ya
    // guardado, así que dejar una vacía no borra la que ya estaba.
    const entered = {};
    for (const key of ['bcv', 'eur', 'binance']) {
        const value = Number(newRateInputs.value[key]);
        if (newRateInputs.value[key] === null || newRateInputs.value[key] === '') continue;
        if (!Number.isFinite(value) || value <= 0) {
            rateUpdateError.value = 'Las tasas deben ser números positivos.';
            return;
        }
        entered[key] = value;
    }

    if (Object.keys(entered).length === 0) {
        rateUpdateError.value = 'Ingresa al menos una tasa.';
        return;
    }
    if (!currentRates.value.bcv && !entered.bcv) {
        rateUpdateError.value = 'Falta la tasa BCV (Bs/USD): es la base de todas las conversiones.';
        return;
    }

    const success = await updateDailyRate(entered);
    if (success) {
        toast.success('Tasas del día actualizadas manualmente.');
        newRateInputs.value = { bcv: null, eur: null, binance: null };
        showManualRate.value = false;
    } else {
        rateUpdateError.value = accountingError.value || 'No se pudo actualizar la tasa manualmente.';
    }
};

const triggerAutoRateFetch = async () => {
    rateUpdateError.value = '';
    accountingError.value = null;
    await fetchAndUpdateBCVRate();

    if (accountingError.value) {
        toast.error(`Error API: ${accountingError.value}`);
    } else {
        toast.success("Tasa del BCV obtenida y actualizada para hoy.");
    }
};

onMounted(async () => {
    await triggerAutoRateFetch();
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="ui-h1">Contabilidad</h1>
                <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Ingresos, egresos y tasa de cambio del día</p>
            </div>
            <button type="button" data-tour="accounting-new" class="ui-btn-primary" @click="openAddModal">Registrar movimiento</button>
        </div>

        <div data-tour="accounting-currency" class="flex flex-wrap items-center gap-2">
            <span class="text-xs font-semibold text-stone-600 dark:text-stone-300">Ver totales en</span>
            <div class="ui-seg-track">
                <button v-for="currency in CURRENCIES" :key="currency.code" type="button"
                    :class="displayCurrency === currency.code ? 'ui-seg-active' : 'ui-seg'"
                    @click="displayCurrency = currency.code">
                    {{ currency.code === 'VES' ? 'Bs.' : currency.code }}
                </button>
            </div>
        </div>

        <div data-tour="accounting-summary" class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(230px, 1fr));">
            <div class="ui-stat-tile">
                <p class="ui-label !mb-2">Ingresos</p>
                <p class="text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-emerald-700 dark:text-emerald-400">
                    {{ formatDisplay(summary.totalIncome) }}
                </p>
                <p v-if="displayCurrency !== 'USD'" class="mt-1 text-xs tabular-nums text-stone-400">
                    ≈ {{ formatCurrency(summary.totalIncome, '$') }}
                </p>
            </div>
            <div class="ui-stat-tile">
                <p class="ui-label !mb-2">Egresos</p>
                <p class="text-[28px] font-semibold tabular-nums tracking-[-0.03em] text-red-700 dark:text-red-400">
                    {{ formatDisplay(summary.totalExpenses) }}
                </p>
                <p v-if="displayCurrency !== 'USD'" class="mt-1 text-xs tabular-nums text-stone-400">
                    ≈ {{ formatCurrency(summary.totalExpenses, '$') }}
                </p>
            </div>
            <div class="ui-card-inverted p-5">
                <p class="text-xs font-semibold text-stone-300">Saldo neto</p>
                <p class="mt-2 text-[28px] font-semibold tabular-nums tracking-[-0.03em]"
                    :class="summary.netBalance >= 0 ? 'text-emerald-400' : 'text-red-400'">
                    {{ formatDisplay(summary.netBalance) }}
                </p>
                <p v-if="displayCurrency !== 'USD'" class="mt-1 text-xs tabular-nums text-stone-400">
                    ≈ {{ formatCurrency(summary.netBalance, '$') }}
                </p>
            </div>
            <div data-tour="accounting-rate" class="ui-stat-tile">
                <div class="flex items-center justify-between">
                    <p class="ui-label !mb-0">Tasas del día</p>
                    <span class="ui-badge-success">BCV</span>
                </div>
                <div class="mt-2 space-y-1.5">
                    <div v-for="(row, index) in RATE_ROWS" :key="row.key" class="flex items-baseline justify-between gap-2">
                        <span class="shrink-0 text-xs font-medium text-stone-500 dark:text-stone-400">
                            {{ row.label }} <span class="text-stone-400">{{ row.unit }}</span>
                        </span>
                        <span class="tabular-nums tracking-[-0.02em] text-amber-600 dark:text-amber-400"
                            :class="index === 0 ? 'text-[26px] font-semibold' : 'text-sm font-semibold'">
                            <template v-if="rateFetchingLoading">…</template>
                            <template v-else-if="currentRates[row.key]">{{ formatCurrency(currentRates[row.key], '', false) }}</template>
                            <template v-else>N/D</template>
                        </span>
                    </div>
                </div>
                <div class="mt-3 flex flex-wrap gap-2">
                    <button type="button" :disabled="rateFetchingLoading" class="ui-btn-subtle" @click="triggerAutoRateFetch">
                        Actualizar del BCV
                    </button>
                    <button type="button" class="ui-btn-outline" @click="showManualRate = !showManualRate">Manual</button>
                </div>
                <div v-if="showManualRate" class="mt-3 space-y-2">
                    <div v-for="row in RATE_ROWS" :key="row.key">
                        <label class="ui-label !mb-1" :for="`manual-rate-${row.key}`">{{ row.label }} ({{ row.unit }})</label>
                        <input :id="`manual-rate-${row.key}`" v-model.number="newRateInputs[row.key]" type="number"
                            :placeholder="currentRates[row.key] ? String(currentRates[row.key]) : 'Sin tasa'" min="0" step="any"
                            class="ui-input-sm w-full" />
                    </div>
                    <p class="text-xs text-stone-400">Deja en blanco las que no quieras cambiar.</p>
                    <button type="button"
                        class="w-full cursor-pointer rounded-control bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700 dark:bg-accent-500 dark:hover:bg-accent-600"
                        @click="handleUpdateRate">
                        Guardar tasas
                    </button>
                </div>
                <p v-if="rateUpdateError" class="mt-1.5 text-xs text-red-600 dark:text-red-400">{{ rateUpdateError }}</p>
                <p v-else-if="lastRateDate && !rateFetchingLoading" class="mt-1.5 text-xs text-stone-400">
                    Última tasa guardada: {{ formatDate(lastRateDate) }}
                </p>
            </div>
        </div>

        <div data-tour="accounting-filters" class="ui-card-flat flex flex-wrap items-center justify-between gap-4 p-4">
            <div class="flex flex-wrap items-center gap-2 max-[640px]:w-full">
                <span class="shrink-0 text-xs font-semibold text-stone-600 dark:text-stone-300">Periodo</span>
                <div class="flex min-w-0 flex-1 items-center gap-2 max-[640px]:w-full">
                    <DateField v-model="filterStartDate" size="sm" class="min-w-0 max-[640px]:flex-1" />
                    <span class="shrink-0 text-stone-400">–</span>
                    <DateField v-model="filterEndDate" size="sm" class="min-w-0 max-[640px]:flex-1" />
                </div>
            </div>
            <div class="ui-seg-track">
                <button type="button" :class="filterType === 'all' ? 'ui-seg-active' : 'ui-seg'" @click="filterType = 'all'">Todos</button>
                <button type="button" :class="filterType === 'income' ? 'ui-seg-active' : 'ui-seg'" @click="filterType = 'income'">Ingresos</button>
                <button type="button" :class="filterType === 'expense' ? 'ui-seg-active' : 'ui-seg'" @click="filterType = 'expense'">Egresos</button>
            </div>
        </div>

        <div v-if="criticalErrorPreventingDisplay">
            <ErrorMessage :message="criticalErrorPreventingDisplay">
                <template v-if="showRatePromptMessage">
                    <p class="mt-4 text-sm text-stone-500 dark:text-stone-400">
                        Ingresa la tasa del día manualmente en la tarjeta "Tasa del día" para continuar.
                    </p>
                </template>
            </ErrorMessage>
        </div>

        <AccountingTransactionsTable v-else data-tour="accounting-table" :records="filteredTransactions" :loading="accountingLoading && !transactions.length"
            @edit-transaction="openEditModal" @delete-transaction="openConfirmDelete" />

        <TransactionModal :show="isTransactionModalOpen" :transaction-data="editingTransaction"
            @close="closeTransactionModal" @save="handleSaveTransaction" />
        <ConfirmationModal :show="isConfirmDeleteOpen" eyebrow="Eliminar movimiento" title="¿Eliminar movimiento?"
            :message="`¿Estás seguro de eliminar la transacción '${transactionNameToDelete}'?`"
            confirm-button-text="Sí, eliminar" @close="closeConfirmDelete" @confirm="confirmDeleteTransaction" />
    </div>
</template>
