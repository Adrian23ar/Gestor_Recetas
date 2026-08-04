<script setup>
import { computed } from 'vue';
import { getEventMeta, getFieldLabel } from '../utils/eventLabels.js';

const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    },
    eventEntry: {
        type: Object,
        default: null,
    },
});

const emit = defineEmits(['close']);

const closeModal = () => {
    emit('close');
};

const formattedTimestamp = computed(() => {
    if (!props.eventEntry || !props.eventEntry.timestamp) return 'Fecha desconocida';
    const ts = props.eventEntry.timestamp;
    if (ts && typeof ts.toDate === 'function') return ts.toDate().toLocaleString();
    if (typeof ts === 'string') return new Date(ts).toLocaleString();
    if (typeof ts === 'number') return new Date(ts).toLocaleString();
    return 'Fecha inválida';
});

const eventMeta = computed(() => getEventMeta(props.eventEntry?.eventType));

const badgeClass = computed(() => {
    const tone = eventMeta.value.tone;
    if (tone === 'success') return 'ui-badge-success';
    if (tone === 'warning') return 'ui-badge-warning';
    if (tone === 'danger') return 'ui-badge-danger';
    return 'ui-badge-neutral';
});

// INVARIANTE: formatValue se conserva sin cambios — cualquier campo nuevo debe
// seguir apareciendo solo, sin tocar este componente.
const formatValue = (value, fieldName) => {
    if (value === null || value === undefined) {
        return '---';
    }

    if (fieldName === 'type' && typeof value === 'string') {
        if (value === 'income') return 'Ingreso';
        if (value === 'expense') return 'Egreso';
    }

    if (typeof value === 'boolean') {
        return value ? 'Sí' : 'No';
    }
    if (Array.isArray(value)) {
        if (fieldName && (fieldName.startsWith('ingredient_') || fieldName === 'ingredients')) {
            if (typeof value === 'string') return value;
            return `Lista (${value.length} items)`;
        }
        return value.map(item => (typeof item === 'object' ? JSON.stringify(item) : item)).join(', ') || '(Lista vacía)';
    }
    if (typeof value === 'object' && value !== null && Object.keys(value).length === 0) {
        return '(Objeto vacío)';
    }
    if (typeof value === 'object' && value !== null) {
        return JSON.stringify(value, null, 2);
    }
    const numericFields = ['cost', 'price', 'profit', 'revenue', 'currentstock', 'quantity', 'batchsize', 'presentationsize', 'netprofit', 'totalcost', 'totalrevenue', 'packagingcostperbatch', 'laborcostperbatch', 'itemsperbatch', 'profitmarginpercent', 'lossbufferpercent'];
    if (typeof value === 'number' && fieldName && numericFields.some(nf => fieldName.toLowerCase().includes(nf))) {
        if (fieldName.toLowerCase().includes('percent')) {
            return `${value.toFixed(2)}%`;
        }
        const costRelated = ['cost', 'price', 'profit', 'revenue', 'netprofit', 'totalcost', 'totalrevenue', 'packagingcostperbatch', 'laborcostperbatch'];
        if (costRelated.some(cf => fieldName.toLowerCase().includes(cf))) {
            return `$${value.toFixed(2)}`;
        }
        return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    }
    return String(value);
};
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-xl">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Evento</p>
                        <div class="mt-1 flex items-center gap-2">
                            <span :class="badgeClass">{{ eventMeta.label }}</span>
                        </div>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <div v-if="eventEntry" class="mt-5 max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm">
                    <div class="ui-panel space-y-2 p-4">
                        <div class="flex items-start justify-between gap-3">
                            <div class="min-w-0">
                                <p class="truncate font-semibold text-stone-800 dark:text-stone-100">
                                    {{ eventEntry.userName || eventEntry.userId || 'Sistema' }}
                                </p>
                                <p class="text-xs text-stone-400">{{ formattedTimestamp }}</p>
                            </div>
                        </div>
                        <div class="border-t border-stone-200 pt-2 dark:border-stone-700">
                            <p class="text-xs text-stone-400">Entidad afectada</p>
                            <p class="font-medium text-stone-800 dark:text-stone-100">
                                {{ eventEntry.entityType }}: {{ eventEntry.entityName || 'N/A' }}
                            </p>
                        </div>
                        <div v-if="eventEntry.relatedEntityId && eventEntry.relatedEntityName">
                            <p class="text-xs text-stone-400">Relacionado con producción</p>
                            <p class="font-medium text-stone-800 dark:text-stone-100">
                                {{ eventEntry.relatedEntityName }}
                                <em class="ml-1 text-xs text-stone-400">(ID: {{ eventEntry.relatedEntityId }})</em>
                            </p>
                        </div>
                    </div>

                    <div v-if="eventEntry.changes && eventEntry.changes.length > 0">
                        <h4 class="mb-2 text-sm font-semibold text-stone-700 dark:text-stone-200">Cambios detallados</h4>

                        <div class="hidden overflow-hidden rounded-box border border-stone-200 min-[641px]:block dark:border-stone-700">
                            <table class="w-full border-collapse text-left text-sm">
                                <thead>
                                    <tr class="bg-surface-muted dark:bg-stone-900/60">
                                        <th class="px-3 py-2 text-xs font-medium text-stone-400">Parámetro</th>
                                        <th class="px-3 py-2 text-xs font-medium text-stone-400">Valor original</th>
                                        <th class="px-3 py-2 text-xs font-medium text-stone-400">Nuevo valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(change, index) in eventEntry.changes" :key="index" class="border-t border-stone-100 dark:border-stone-800">
                                        <td class="px-3 py-2.5 font-medium text-stone-700 dark:text-stone-200">{{ change.label || getFieldLabel(change.field) }}</td>
                                        <td class="break-all px-3 py-2.5 text-stone-600 dark:text-stone-300">{{ formatValue(change.oldValue, change.field) }}</td>
                                        <td class="break-all px-3 py-2.5 text-stone-600 dark:text-stone-300">{{ formatValue(change.newValue, change.field) }}</td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        <div class="space-y-2.5 min-[641px]:hidden">
                            <div v-for="(change, index) in eventEntry.changes" :key="index" class="ui-panel space-y-1.5 p-3">
                                <p class="text-[11px] font-bold text-stone-400">{{ change.label || getFieldLabel(change.field) }}</p>
                                <div class="flex flex-wrap items-center gap-1.5 break-all">
                                    <span class="text-stone-500 dark:text-stone-400">{{ formatValue(change.oldValue, change.field) }}</span>
                                    <span class="text-stone-400">→</span>
                                    <span class="font-medium text-stone-800 dark:text-stone-100">{{ formatValue(change.newValue, change.field) }}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div v-else-if="eventEntry.description">
                        <h4 class="mb-1 text-sm font-semibold text-stone-700 dark:text-stone-200">Descripción</h4>
                        <p class="ui-panel p-3 text-stone-700 dark:text-stone-200">{{ eventEntry.description }}</p>
                    </div>
                    <p v-else class="py-3 text-center italic text-stone-400">
                        No se registraron cambios detallados específicos para este evento.
                    </p>
                </div>
                <div v-else class="py-5 text-center text-stone-400">No hay detalles de evento para mostrar.</div>

                <div class="mt-6 flex justify-end border-t border-stone-200 pt-4 dark:border-stone-700">
                    <button type="button" @click="closeModal" class="ui-btn-primary">Cerrar</button>
                </div>
            </div>
        </div>
    </Transition>
</template>
