<script setup>
import { computed } from 'vue';
import ResponsiveTable from './ui/ResponsiveTable.vue';
import { useDataTable } from '../composables/useDataTable.js';
import { formatCurrency } from '../utils/utils.js';

const props = defineProps({
    records: { type: Array, default: () => [] },
    loading: { type: Boolean, default: false },
});
const emit = defineEmits(['edit-record', 'delete-record']);

const { query, page, filtered, paged, total, totalPages, rangeFrom, rangeTo, next, prev } = useDataTable(
    () => props.records,
    { searchFields: ['productName'], pageSize: 10, defaultSort: { key: 'date', dir: 'desc' } }
);

const columns = [
    { key: 'productName', label: 'Producción', mobilePrimary: true },
    { key: 'date', label: 'Fecha' },
    { key: 'totalRevenue', label: 'Ingreso total', align: 'right' },
    { key: 'recipeOnlyCost', label: 'Gastos op. (ingr.+emp.)', align: 'right' },
    { key: 'laborCost', label: 'Mano de obra', align: 'right' },
    { key: 'netProfit', label: 'Ganancia neta', align: 'right' },
    { key: 'isSold', label: 'Vendido', align: 'right' },
];

// Cambio intencional: totaliza TODAS las filas filtradas, no sólo la página visible.
const totals = computed(() => filtered.value.reduce((acc, r) => {
    acc.totalRevenue += Number(r.totalRevenue) || 0;
    acc.recipeOnlyCost += Number(r.recipeOnlyCost) || 0;
    acc.laborCost += Number(r.laborCost) || 0;
    acc.netProfit += Number(r.netProfit) || 0;
    return acc;
}, { totalRevenue: 0, recipeOnlyCost: 0, laborCost: 0, netProfit: 0 }));
</script>

<template>
    <ResponsiveTable :columns="columns" :rows="paged" row-key="id" :loading="loading"
        :empty="{ title: 'Sin producción registrada', message: 'Registra tu primer lote desde el formulario de arriba.' }"
        noun="registros" :total="total" :range-from="rangeFrom" :range-to="rangeTo" :page="page"
        :total-pages="totalPages" @next="next" @prev="prev">
        <template #toolbar>
            <h2 class="text-base font-semibold text-stone-800 dark:text-stone-100">Historial de producción</h2>
            <input v-model="query" type="search" placeholder="Buscar producción…" class="ui-input-sm w-full max-w-[220px]" />
        </template>

        <template #cell-productName="{ row }">
            <p class="font-medium text-stone-800 dark:text-stone-100">{{ row.productName || 'Receta desconocida' }}</p>
            <p class="text-xs text-stone-400">Lote: {{ row.batchSize ?? '?' }}</p>
        </template>

        <template #cell-totalRevenue="{ row }">
            <span class="tabular-nums">{{ formatCurrency(row.totalRevenue) }}</span>
        </template>
        <template #cell-recipeOnlyCost="{ row }">
            <span class="tabular-nums">{{ formatCurrency(row.recipeOnlyCost) }}</span>
        </template>
        <template #cell-laborCost="{ row }">
            <span class="tabular-nums">{{ formatCurrency(row.laborCost) }}</span>
        </template>
        <template #cell-netProfit="{ row }">
            <span class="font-medium tabular-nums text-emerald-700 dark:text-emerald-400">{{ formatCurrency(row.netProfit) }}</span>
        </template>
        <template #cell-isSold="{ row }">
            <span :class="row.isSold ? 'ui-badge-success' : 'ui-badge-neutral'">{{ row.isSold ? 'Sí' : 'No' }}</span>
        </template>

        <template #actions="{ row }">
            <button type="button" class="ui-btn-subtle" @click="emit('edit-record', row)">Editar</button>
            <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-record', row)">Eliminar</button>
        </template>

        <template #totals>
            <div class="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-sm">
                <span class="font-semibold text-stone-600 dark:text-stone-300">Totales del periodo</span>
                <div class="flex flex-wrap items-center gap-x-6 gap-y-1.5">
                    <span class="flex items-baseline gap-1.5">
                        <span class="text-xs text-stone-400">Ingreso</span>
                        <span class="tabular-nums font-medium text-stone-800 dark:text-stone-100">{{ formatCurrency(totals.totalRevenue) }}</span>
                    </span>
                    <span class="flex items-baseline gap-1.5">
                        <span class="text-xs text-stone-400">Gastos op.</span>
                        <span class="tabular-nums font-medium text-stone-800 dark:text-stone-100">{{ formatCurrency(totals.recipeOnlyCost) }}</span>
                    </span>
                    <span class="flex items-baseline gap-1.5">
                        <span class="text-xs text-stone-400">M. obra</span>
                        <span class="tabular-nums font-medium text-stone-800 dark:text-stone-100">{{ formatCurrency(totals.laborCost) }}</span>
                    </span>
                    <span class="flex items-baseline gap-1.5">
                        <span class="text-xs text-stone-400">Ganancia neta</span>
                        <span class="tabular-nums font-semibold text-emerald-700 dark:text-emerald-400">{{ formatCurrency(totals.netProfit) }}</span>
                    </span>
                </div>
            </div>
        </template>
    </ResponsiveTable>
</template>
