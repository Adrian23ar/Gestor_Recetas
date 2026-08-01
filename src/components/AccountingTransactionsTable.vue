<script setup>
import ResponsiveTable from './ui/ResponsiveTable.vue';
import { useDataTable } from '../composables/useDataTable.js';
import { formatCurrency } from '../utils/utils.js';

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
    { key: 'amountBs', label: 'Monto (Bs.)', align: 'right' },
    { key: 'exchangeRate', label: 'Tasa', align: 'right' },
    { key: 'amountUsd', label: 'Monto (USD)', align: 'right' },
];
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

        <template #cell-amountBs="{ row }">
            <span class="tabular-nums">{{ formatCurrency(row.amountBs, 'Bs.') }}</span>
        </template>

        <template #cell-exchangeRate="{ row }">
            <span class="tabular-nums">{{ row.exchangeRate ? Number(row.exchangeRate).toFixed(2) : 'N/A' }}</span>
        </template>

        <template #cell-amountUsd="{ row }">
            <span class="tabular-nums" :class="row.type === 'expense' ? 'text-red-600 dark:text-red-400' : ''">
                {{ row.type === 'expense' ? '−' : '' }}{{ formatCurrency(row.amountUsd, '$') }}
            </span>
        </template>

        <template #actions="{ row }">
            <button type="button" class="ui-btn-subtle" @click="emit('edit-transaction', row)">Editar</button>
            <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-transaction', row)">Eliminar</button>
        </template>
    </ResponsiveTable>
</template>
