<script setup>
import { ref, computed } from 'vue';
import ResponsiveTable from './ui/ResponsiveTable.vue';
import { useDataTable } from '../composables/useDataTable.js';
import { formatCurrency } from '../utils/utils.js';

const props = defineProps({
    ingredients: { type: Array, required: true }, // ya trae stockStatus/stockPercent (useIngredients)
    loading: { type: Boolean, default: false },
});

const emit = defineEmits(['edit-ingredient', 'delete-ingredient', 'edit-stock-click']);

const activeFilter = ref('all');
const filterChips = [
    { key: 'all', label: 'Todos' },
    { key: 'low', label: 'Stock bajo' },
    { key: 'medium', label: 'Stock medio' },
    { key: 'high', label: 'Stock alto' },
];

const chipFiltered = computed(() => {
    if (activeFilter.value === 'all') return props.ingredients;
    return props.ingredients.filter(i => i.stockStatus === activeFilter.value);
});

function chipCount(key) {
    if (key === 'all') return props.ingredients.length;
    return props.ingredients.filter(i => i.stockStatus === key).length;
}

const { query, page, filtered, paged, total, totalPages, rangeFrom, rangeTo, next, prev } = useDataTable(chipFiltered, {
    searchFields: ['name'],
    pageSize: 10,
});

const columns = [
    { key: 'name', label: 'Ingrediente', mobilePrimary: true },
    { key: 'currentStock', label: 'Stock actual', align: 'right' },
    { key: 'level', label: 'Nivel' },
    { key: 'cost', label: 'Costo presentación', align: 'right' },
    { key: 'baseCost', label: 'Costo base', align: 'right' },
];

// Conserva la singularización original: 'Uni' -> 'unidad', plurales en 's' -> singular.
function baseUnitLabel(unit) {
    if (unit === 'Uni') return 'unidad';
    if (typeof unit === 'string' && unit.endsWith('s')) return unit.slice(0, -1);
    return unit || '';
}

function levelTone(status) {
    if (status === 'low') return 'text-red-700 dark:text-red-400';
    if (status === 'medium') return 'text-amber-700 dark:text-amber-400';
    if (status === 'high') return 'text-emerald-700 dark:text-emerald-400';
    return 'text-stone-400';
}

function levelFill(status) {
    if (status === 'low') return 'bg-red-600';
    if (status === 'medium') return 'bg-amber-500';
    if (status === 'high') return 'bg-emerald-600';
    return 'bg-stone-300 dark:bg-stone-600';
}
</script>

<template>
    <ResponsiveTable :columns="columns" :rows="paged" row-key="id" :loading="loading"
        :empty="{ title: 'Sin ingredientes', message: activeFilter === 'all' ? 'Aún no has añadido ingredientes a tu inventario.' : 'Ningún ingrediente coincide con este filtro.' }"
        noun="ingredientes" :total="total" :range-from="rangeFrom" :range-to="rangeTo" :page="page"
        :total-pages="totalPages" @next="next" @prev="prev">
        <template #toolbar>
            <div class="flex flex-wrap gap-1.5">
                <button v-for="chip in filterChips" :key="chip.key" type="button" @click="activeFilter = chip.key"
                    :class="activeFilter === chip.key ? 'ui-chip-active' : 'ui-chip'">
                    {{ chip.label }} · <span class="tabular-nums">{{ chipCount(chip.key) }}</span>
                </button>
            </div>
            <input v-model="query" type="search" placeholder="Buscar ingrediente…" class="ui-input-sm w-full max-w-[220px]" />
        </template>

        <template #cell-name="{ row }">
            <p class="font-medium text-stone-800 dark:text-stone-100">{{ row.name }}</p>
            <p class="text-xs text-stone-400">Presentación {{ row.presentationSize }} {{ row.unit }}</p>
        </template>

        <template #cell-currentStock="{ row }">
            <span class="tabular-nums">{{ row.currentStock }} {{ row.unit }}</span>
        </template>

        <template #cell-level="{ row }">
            <div v-if="row.stockPercent === null" class="text-xs italic text-stone-400">N/D</div>
            <div v-else class="flex items-center gap-2">
                <span class="h-1.5 w-[120px] overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
                    <span class="block h-full rounded-full" :class="levelFill(row.stockStatus)"
                        :style="{ width: Math.max(0, Math.min(100, row.stockPercent)) + '%' }"></span>
                </span>
                <span class="text-xs font-semibold tabular-nums" :class="levelTone(row.stockStatus)">{{ Math.round(row.stockPercent) }}%</span>
            </div>
        </template>

        <template #cell-cost="{ row }">
            <span class="tabular-nums">{{ formatCurrency(row.cost) }}</span>
        </template>

        <template #cell-baseCost="{ row }">
            <span v-if="row.presentationSize > 0" class="tabular-nums">
                {{ formatCurrency(row.cost / row.presentationSize) }} / {{ baseUnitLabel(row.unit) }}
            </span>
            <span v-else>-</span>
        </template>

        <template #actions="{ row, expanded }">
            <button type="button" class="ui-btn-subtle" @click="emit('edit-stock-click', row.id)">
                Ajustar stock
            </button>
            <template v-if="expanded">
                <button type="button" class="ui-btn-subtle" @click="emit('edit-ingredient', row)">Editar</button>
                <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-ingredient', row.id)">Eliminar</button>
            </template>
        </template>
    </ResponsiveTable>
</template>
