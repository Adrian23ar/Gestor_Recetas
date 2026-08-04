<script setup>
import ResponsiveTable from './ui/ResponsiveTable.vue';
import { useDataTable } from '../composables/useDataTable.js';
import { formatCurrency } from '../utils/utils.js';
import { currencySymbol, requiredRateKeys, transactionRates } from '../utils/currency.js';

const props = defineProps({
    records: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
});
const emit = defineEmits(['edit-transaction', 'delete-transaction']);

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Fecha inválida';
    const day = String(date.getUTCDate()).padStart(2, '0');
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const year = date.getUTCFullYear();
    return `${day}/${month}/${year}`;
}

const { query, page, total, totalPages, rangeFrom, rangeTo, paged, next, prev } = useDataTable(
    () => props.records,
    { searchFields: ['description', 'category'], pageSize: 10, defaultSort: { key: 'date', dir: 'desc' } }
);

const columns = [
    { key: 'date', label: 'Fecha' },
    { key: 'movement', label: 'Movimiento', mobilePrimary: true },
    { key: 'category', label: 'Categoría' },
    { key: 'amountOriginal', label: 'Monto', align: 'right' },
    { key: 'ratesApplied', label: 'Tasa aplicada', align: 'right' },
    { key: 'amountUsdBcv', label: 'Equivalente (USD)', align: 'right' },
];

/**
 * Las tasas con las que se registró el movimiento, sólo las que hicieron falta
 * para su moneda. Es un snapshot: no cambia aunque hoy la tasa sea otra.
 */
function appliedRates(row) {
    const rates = transactionRates(row);
    const labels = { bcv: 'Bs/USD', eur: 'Bs/EUR', binance: 'Bs/USDT' };
    return requiredRateKeys(row.currencyOriginal)
        .filter(key => rates[key])
        .map(key => `${labels[key]} ${Number(rates[key]).toFixed(2)}`);
}

function formatOriginal(row) {
    const currency = row.currencyOriginal || 'VES';
    if (currency === 'USDT') return `${formatCurrency(row.amountOriginal, '')} USDT`;
    return formatCurrency(row.amountOriginal, currencySymbol(currency));
}
</script>

<template>
    <ResponsiveTable :columns="columns" :rows="paged" row-key="id" :loading="loading"
        :empty="{ title: 'Sin transacciones', message: 'No hay movimientos registrados para este periodo.' }"
        noun="transacciones" :total="total" :range-from="rangeFrom" :range-to="rangeTo" :page="page"
        :total-pages="totalPages" @next="next" @prev="prev">
        <template #toolbar>
            <h2 class="text-base font-semibold text-stone-800 dark:text-stone-100">Movimientos</h2>
            <input v-model="query" type="search" placeholder="Buscar transacción…" class="ui-input-sm w-full max-w-[220px]" />
        </template>

        <template #cell-date="{ row }">{{ formatDate(row.date) }}</template>

        <template #cell-movement="{ row }">
            <div class="flex items-center gap-2">
                <span :class="row.type === 'income' ? 'ui-badge-success' : 'ui-badge-danger'">
                    {{ row.type === 'income' ? 'Ingreso' : 'Egreso' }}
                </span>
                <span class="truncate text-stone-800 dark:text-stone-100">{{ row.description }}</span>
            </div>
        </template>

        <template #cell-category="{ row }">{{ row.category || '—' }}</template>

        <template #cell-amountOriginal="{ row }">
            <span class="tabular-nums font-medium">{{ formatOriginal(row) }}</span>
        </template>

        <template #cell-ratesApplied="{ row }">
            <span v-if="appliedRates(row).length === 0" class="text-xs text-stone-400">—</span>
            <span v-else class="tabular-nums text-xs">
                <span v-for="(rate, i) in appliedRates(row)" :key="i" class="block">{{ rate }}</span>
            </span>
        </template>

        <template #cell-amountUsdBcv="{ row }">
            <span class="tabular-nums" :class="row.type === 'expense' ? 'text-red-600 dark:text-red-400' : ''">
                {{ row.type === 'expense' ? '−' : '' }}{{ formatCurrency(row.amountUsdBcv, '$') }}
            </span>
        </template>

        <template #actions="{ row }">
            <button type="button" class="ui-btn-subtle" @click="emit('edit-transaction', row)">Editar</button>
            <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-transaction', row)">Eliminar</button>
        </template>
    </ResponsiveTable>
</template>
