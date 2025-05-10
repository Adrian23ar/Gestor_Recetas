<template>
    <Transition name="modal-transition">
        <div v-if="show"
            class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-6 sm:pt-10 pb-6"
            @click.self="closeModal">
            <div
                class="modal-content relative mx-auto p-5 sm:p-6 border border-neutral-300 w-full max-w-xl shadow-lg rounded-md bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div class="flex justify-between items-center pb-3 mb-4">
                    <h3 class="text-xl font-semibold text-primary-800 dark:text-dark-primary-200">
                        Detalles del Evento
                    </h3>
                    <button @click="closeModal"
                        class="cursor-pointer text-neutral-400 hover:text-neutral-600 text-2xl font-bold dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600 transition-all"
                        aria-label="Cerrar modal">
                        &times;
                    </button>
                </div>

                <div v-if="eventEntry" class="space-y-4 text-sm max-h-[75vh] overflow-y-auto pr-2 sm:pr-4">
                    <div class="p-4 bg-neutral-50 rounded-lg dark:bg-dark-neutral-800/50 space-y-2">
                        <div class="flex justify-between items-start">
                            <div>
                                <p class="font-semibold text-lg text-primary-700 dark:text-dark-primary-300">{{
                                    eventEntry.userName || eventEntry.userId || 'Sistema' }}</p>
                                <p class="text-xs text-text-muted dark:text-dark-text-muted">{{ formattedTimestamp }}
                                </p>
                            </div>
                            <span
                                class="px-2 py-0.5 text-xs font-medium rounded-full text-secondary-700 bg-secondary-100 border border-secondary-200 dark:border-dark-secondary-500 dark:text-dark-secondary-300 dark:bg-dark-secondary-900">
                                {{ formattedEventType }}
                            </span>
                        </div>
                        <div class="my-4">
                            <p class="text-sm text-text-muted dark:text-dark-text-muted">Entidad Afectada:</p>
                            <p class="font-medium text-text-base dark:text-dark-text-base">
                                {{ eventEntry.entityType }}: {{ eventEntry.entityName || 'N/A' }}
                                <!-- <em v-if="eventEntry.entityId"
                                    class="text-xs text-neutral-500 dark:text-dark-neutral-400 ml-1">(ID: {{
                                        eventEntry.entityId }})</em> -->
                            </p>
                        </div>
                        <div v-if="eventEntry.relatedEntityId && eventEntry.relatedEntityName">
                            <p class="text-sm text-text-muted dark:text-dark-text-muted">Relacionado con Producción:</p>
                            <p class="font-medium text-text-base dark:text-dark-text-base">
                                {{ eventEntry.relatedEntityName }}
                                <em class="text-xs text-neutral-500 dark:text-dark-neutral-400 ml-1">(ID: {{
                                    eventEntry.relatedEntityId }})</em>
                            </p>
                        </div>
                    </div>

                    <div v-if="eventEntry.changes && eventEntry.changes.length > 0" class="mt-1">
                        <h4 class="text-lg font-semibold mb-3 text-primary-700 dark:text-dark-primary-300">Cambios
                            Detallados</h4>
                        <div class="overflow-x-auto">
                            <table class="w-full text-sm text-left text-text-base dark:text-dark-text-base">
                                <thead
                                    class="text-xs text-text-muted uppercase bg-neutral-100 dark:text-dark-text-muted dark:bg-dark-neutral-800">
                                    <tr>
                                        <th scope="col" class="px-4 py-2">Parámetro</th>
                                        <th scope="col" class="px-4 py-2">Valor Original</th>
                                        <th scope="col" class="px-4 py-2">Nuevo Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr v-for="(change, index) in eventEntry.changes" :key="index"
                                        class="bg-contrast border-b border-neutral-300 last:border-b-0 dark:bg-dark-contrast dark:border-dark-neutral-700">
                                        <td class="px-4 py-3 font-medium ">{{ change.label ||
                                            change.field }}</td>
                                        <td class="px-4 py-3 break-all">{{ formatValue(change.oldValue, change.field) }}
                                        </td>
                                        <td class="px-4 py-3 break-all">{{ formatValue(change.newValue, change.field) }}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                    <div v-else-if="eventEntry.description" class="mt-3">
                        <h4 class="text-lg font-semibold mb-1 text-primary-700 dark:text-dark-primary-300">Descripción:
                        </h4>
                        <p
                            class="text-text-base dark:text-dark-text-base p-2 bg-neutral-50 dark:bg-dark-neutral-800/50 rounded">
                            {{ eventEntry.description }}</p>
                    </div>
                    <div v-else class="mt-3">
                        <p class="text-text-muted dark:text-dark-text-muted italic text-center py-3">No se registraron
                            cambios detallados específicos para este evento.</p>
                    </div>
                </div>
                <div v-else class="text-center py-5 text-text-muted dark:text-dark-text-muted">
                    No hay detalles de evento para mostrar.
                </div>

                <div class="flex justify-end pt-4 mt-5 border-t border-neutral-200 dark:border-dark-neutral-700">
                    <button @click="closeModal"
                        class="cursor-pointer px-4 py-2 bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { computed } from 'vue';

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
    if (ts && typeof ts.toDate === 'function') { // Firestore Timestamp
        return ts.toDate().toLocaleString();
    }
    if (typeof ts === 'string') { // ISO String from localStorage
        return new Date(ts).toLocaleString();
    }
    if (typeof ts === 'number') { // Milliseconds from Date.now() for localStorage temp IDs
        return new Date(ts).toLocaleString();
    }
    return 'Fecha inválida';
});

const formattedEventType = computed(() => {
    if (!props.eventEntry) return '';
    const type = props.eventEntry.eventType;
    const labels = {
        RECIPE_CREATED: 'Nueva Receta Creada',
        RECIPE_EDITED: 'Receta Modificada',
        RECIPE_DELETED: 'Receta Eliminada',
        INGREDIENT_CREATED: 'Nuevo Ingrediente Añadido',
        INGREDIENT_EDITED: 'Ingrediente Modificado',
        INGREDIENT_DELETED: 'Ingrediente Eliminado',
        PRODUCTION_RECORD_CREATED: 'Nuevo Registro de Producción',
        PRODUCTION_RECORD_EDITED: 'Registro de Producción Modificado',
        PRODUCTION_RECORD_DELETED: 'Registro de Producción Eliminado',
        STOCK_MANUAL_EDIT: 'Stock de Ingrediente Editado Manualmente',
        STOCK_ADJUST_BY_PRODUCTION_ADD: 'Stock Descontado por Producción',
        STOCK_ADJUST_BY_PRODUCTION_DELETE: 'Stock Restaurado (Producción Eliminada)',
        STOCK_ADJUST_BY_PRODUCTION_EDIT: 'Stock Ajustado (Edición de Producción)',
        TRANSACTION_CREATED: 'Transacción Creada',
        TRANSACTION_EDITED: 'Transacción Editada',
        TRANSACTION_DELETED: 'Transacción Eliminada',
        EXCHANGE_RATE_UPDATED: 'Tasa de Cambio Actualizada',
        EXCHANGE_RATE_CREATED: 'Tasa de Cambio Creada',
        EXCHANGE_RATE_EDITED: 'Tasa de Cambio Editada',
    };
    return labels[type] || type;
});

const formatValue = (value, fieldName) => {
    if (value === null || value === undefined) {
        return '---'; // O 'No aplica', 'Vacío', etc.
    }

    // --- NUEVA LÓGICA PARA EL CAMPO 'type' ---
    if (fieldName === 'type' && typeof value === 'string') {
        if (value === 'income') return 'Ingreso';
        if (value === 'expense') return 'Egreso';
    }
    // --- FIN NUEVA LÓGICA ---
    
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
        return JSON.stringify(value, null, 2); // Un poco más legible para objetos
    }
    const numericFields = ['cost', 'price', 'profit', 'revenue', 'currentstock', 'quantity', 'batchsize', 'presentationsize', 'netprofit', 'totalcost', 'totalrevenue', 'packagingcostperbatch', 'laborcostperbatch', 'itemsperbatch', 'profitmarginpercent', 'lossbufferpercent'];
    if (typeof value === 'number' && fieldName && numericFields.some(nf => fieldName.toLowerCase().includes(nf))) {
        // Para campos de costo o cantidad, podrías querer un formato específico
        if (fieldName.toLowerCase().includes('percent')) {
            return `${value.toFixed(2)}%`;
        }
        // Evitar $ para cantidades puras como 'currentStock' o 'quantity' a menos que explícitamente sea un costo
        const costRelated = ['cost', 'price', 'profit', 'revenue', 'netprofit', 'totalcost', 'totalrevenue', 'packagingcostperbatch', 'laborcostperbatch'];
        if (costRelated.some(cf => fieldName.toLowerCase().includes(cf))) {
            return `$${value.toFixed(2)}`;
        }
        return value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 }); // Formato numérico general
    }
    return String(value);
};

</script>

<style scoped>
/* Estilos específicos para el modal si son necesarios */

.break-all {
    /* Para valores largos en la tabla de cambios */
    word-break: break-all;
}
</style>