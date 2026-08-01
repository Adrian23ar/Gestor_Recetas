<script setup>
import { ref, computed } from 'vue';

const props = defineProps({
    // [{ key, label, align?: 'left'|'right'|'center', mobilePrimary?: boolean, class?: string }]
    columns: { type: Array, required: true },
    rows: { type: Array, required: true }, // filas ya paginadas (useDataTable().paged)
    rowKey: { type: [String, Function], default: 'id' },
    loading: { type: Boolean, default: false },
    empty: {
        type: Object,
        default: () => ({ title: 'Sin resultados', message: 'No hay datos para mostrar.' }),
    },
    noun: { type: String, default: 'resultados' },
    total: { type: Number, default: 0 },
    rangeFrom: { type: Number, default: 0 },
    rangeTo: { type: Number, default: 0 },
    page: { type: Number, default: 1 },
    totalPages: { type: Number, default: 1 },
});

const emit = defineEmits(['next', 'prev']);

const primaryColumn = computed(() => props.columns.find(c => c.mobilePrimary) || props.columns[0]);
const secondaryColumns = computed(() => props.columns.filter(c => c !== primaryColumn.value));

function getRowKey(row) {
    return typeof props.rowKey === 'function' ? props.rowKey(row) : row[props.rowKey];
}

function alignClass(align) {
    if (align === 'right') return 'text-right';
    if (align === 'center') return 'text-center';
    return 'text-left';
}

// Varias filas pueden estar expandidas a la vez en móvil (sin comportamiento acordeón).
const expandedKeys = ref(new Set());
function isExpanded(key) {
    return expandedKeys.value.has(key);
}
function toggleExpanded(key) {
    const next = new Set(expandedKeys.value);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    expandedKeys.value = next;
}
</script>

<template>
    <div class="ui-card overflow-hidden">
        <div v-if="$slots.toolbar" class="ui-table-toolbar">
            <slot name="toolbar" />
        </div>

        <div v-if="loading" class="space-y-3 p-[22px]">
            <div v-for="n in 5" :key="n" class="ui-skeleton h-11 w-full" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.1}s infinite` }"></div>
        </div>

        <div v-else-if="rows.length === 0" class="p-[22px]">
            <div class="ui-empty">
                <h3 class="text-base font-semibold text-stone-700 dark:text-stone-200">{{ empty.title }}</h3>
                <p class="mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">{{ empty.message }}</p>
            </div>
        </div>

        <template v-else>
            <!-- >760px: tabla real -->
            <div class="hidden overflow-x-auto min-[761px]:block">
                <table class="ui-table">
                    <thead>
                        <tr>
                            <th v-for="col in columns" :key="col.key" :class="['ui-thead-th', alignClass(col.align), col.class]">
                                {{ col.label }}
                            </th>
                            <th v-if="$slots.actions" class="ui-thead-th text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="row in rows" :key="getRowKey(row)" class="ui-tr">
                            <td v-for="col in columns" :key="col.key" :class="['ui-td', alignClass(col.align), col.class]">
                                <slot :name="'cell-' + col.key" :row="row">{{ row[col.key] }}</slot>
                            </td>
                            <td v-if="$slots.actions" class="ui-td">
                                <div class="flex items-center justify-end gap-2">
                                    <slot name="actions" :row="row" :expanded="true" />
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- ≤760px: cada fila es una tarjeta que se expande -->
            <div class="divide-y divide-stone-100 min-[761px]:hidden dark:divide-stone-800">
                <div v-for="row in rows" :key="getRowKey(row)" class="px-[22px] py-4">
                    <div class="flex items-start gap-3">
                        <button type="button" class="min-w-0 flex-1 cursor-pointer text-left"
                            :aria-expanded="isExpanded(getRowKey(row))" @click="toggleExpanded(getRowKey(row))">
                            <div class="text-sm text-stone-800 dark:text-stone-100">
                                <slot :name="'cell-' + primaryColumn.key" :row="row">{{ row[primaryColumn.key] }}</slot>
                            </div>
                            <span class="mt-1 inline-block text-[11px] font-bold text-stone-400">
                                {{ isExpanded(getRowKey(row)) ? 'ocultar detalles' : 'ver detalles' }}
                            </span>
                        </button>
                        <div v-if="$slots.actions" class="flex w-full max-w-[128px] shrink-0 flex-col items-stretch gap-1.5">
                            <slot name="actions" :row="row" :expanded="isExpanded(getRowKey(row))" />
                        </div>
                    </div>

                    <div v-if="isExpanded(getRowKey(row))" class="mt-3 space-y-2.5">
                        <div v-for="col in secondaryColumns" :key="col.key"
                            class="border-t border-dashed border-stone-200 pt-2.5 dark:border-stone-700">
                            <div class="text-[11px] font-bold text-stone-400">{{ col.label }}</div>
                            <div class="mt-0.5 text-sm text-stone-800 dark:text-stone-100">
                                <slot :name="'cell-' + col.key" :row="row">{{ row[col.key] }}</slot>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div v-if="$slots.totals" class="border-t border-stone-200 bg-surface-muted px-[22px] py-3 dark:border-stone-700 dark:bg-stone-900/60">
                <slot name="totals" />
            </div>
        </template>

        <div class="ui-table-footer">
            <slot name="footer">
                <p class="text-xs text-stone-500 dark:text-stone-400">
                    Mostrando <span class="tabular-nums">{{ rangeFrom }}</span>–<span class="tabular-nums">{{ rangeTo }}</span>
                    de <span class="tabular-nums">{{ total }}</span> {{ noun }}
                </p>
                <div class="flex items-center gap-2">
                    <button type="button" :disabled="page <= 1" @click="emit('prev')"
                        class="ui-btn-outline !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 dark:disabled:border-stone-700 dark:disabled:text-stone-600">
                        Anterior
                    </button>
                    <button type="button" :disabled="page >= totalPages" @click="emit('next')"
                        class="ui-btn-outline !px-3 !py-1.5 !text-xs disabled:cursor-not-allowed disabled:border-stone-200 disabled:text-stone-300 dark:disabled:border-stone-700 dark:disabled:text-stone-600">
                        Siguiente
                    </button>
                </div>
            </slot>
        </div>
    </div>
</template>
