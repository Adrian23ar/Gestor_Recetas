<script setup>
import { ref, watch, computed } from 'vue';
import DateField from './ui/DateField.vue';

const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    },
    record: {
        type: Object,
        required: false,
        default: null,
    }
});

const emit = defineEmits(['close', 'save']);

const editableRecord = ref(null);

watch(() => props.record, (newRecord) => {
    if (newRecord) {
        editableRecord.value = JSON.parse(JSON.stringify(newRecord));
        editableRecord.value.batchSize = Number(editableRecord.value.batchSize) || 0;
        editableRecord.value.netProfit = Number(editableRecord.value.netProfit) || 0;
        editableRecord.value.date = editableRecord.value.date || '';
        editableRecord.value.isSold = typeof editableRecord.value.isSold === 'boolean' ? editableRecord.value.isSold : false;
    } else {
        editableRecord.value = null;
    }
}, { immediate: true });

// Invariante: input type="text" inputmode="decimal" — un type="number" rompe el
// formateo a 2 decimales y el manejo del campo vacío.
const formattedNetProfit = computed({
    get() {
        const num = Number(editableRecord.value?.netProfit);
        return editableRecord.value?.netProfit === null || isNaN(num) ? '' : num.toFixed(2);
    },
    set(value) {
        if (editableRecord.value) {
            const parsed = parseFloat(value);
            editableRecord.value.netProfit = (value === '' || isNaN(parsed)) ? null : parsed;
        }
    }
});

const errors = computed(() => {
    const e = {};
    if (!editableRecord.value) return e;
    if (!editableRecord.value.productName || !editableRecord.value.productName.trim()) e.productName = 'Obligatorio.';
    if (editableRecord.value.batchSize === null || isNaN(editableRecord.value.batchSize) || editableRecord.value.batchSize <= 0) {
        e.batchSize = 'Debe ser mayor a cero.';
    }
    if (!editableRecord.value.date) e.date = 'Obligatoria.';
    if (editableRecord.value.netProfit === null || isNaN(editableRecord.value.netProfit)) e.netProfit = 'Número inválido.';
    return e;
});
const isValid = computed(() => Object.keys(errors.value).length === 0);

function closeModal() {
    emit('close');
}

function saveChanges() {
    if (!editableRecord.value || !isValid.value) return;
    emit('save', { ...editableRecord.value });
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show && editableRecord" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-md">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Producción</p>
                        <h3 class="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
                            {{ editableRecord.productName }}
                        </h3>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <form class="mt-5 space-y-4" @submit.prevent="saveChanges">
                    <div>
                        <label class="ui-label" for="edit-product-name">Producción</label>
                        <input id="edit-product-name" v-model="editableRecord.productName" type="text"
                            :class="['ui-input', errors.productName && 'ui-input-error']" />
                        <p v-if="errors.productName" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.productName }}</p>
                    </div>

                    <div class="grid grid-cols-2 gap-3">
                        <div>
                            <label class="ui-label" for="edit-batch-size">Lote (cantidad)</label>
                            <input id="edit-batch-size" v-model.number="editableRecord.batchSize" type="number" min="1" step="1"
                                :class="['ui-input', errors.batchSize && 'ui-input-error']" />
                            <p v-if="errors.batchSize" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.batchSize }}</p>
                        </div>
                        <div>
                            <label class="ui-label" for="edit-production-date">Fecha</label>
                            <DateField id="edit-production-date" v-model="editableRecord.date" :error="!!errors.date" />
                            <p v-if="errors.date" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.date }}</p>
                        </div>
                    </div>

                    <div>
                        <label class="ui-label" for="edit-net-profit">Ganancia neta ($)</label>
                        <input id="edit-net-profit" v-model="formattedNetProfit" type="text" inputmode="decimal" placeholder="0.00"
                            :class="['ui-input', errors.netProfit && 'ui-input-error']" />
                        <p v-if="errors.netProfit" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.netProfit }}</p>
                    </div>

                    <div>
                        <label class="ui-label">Estado</label>
                        <div class="ui-seg-track w-fit">
                            <button type="button" :class="editableRecord.isSold ? 'ui-seg-active' : 'ui-seg'" @click="editableRecord.isSold = true">
                                Vendido
                            </button>
                            <button type="button" :class="!editableRecord.isSold ? 'ui-seg-active' : 'ui-seg'" @click="editableRecord.isSold = false">
                                Pendiente
                            </button>
                        </div>
                    </div>

                    <div class="mt-2 flex items-center justify-between gap-3">
                        <button type="button" @click="closeModal" class="ui-btn-outline">Cancelar</button>
                        <button type="submit" :disabled="!isValid" :class="!isValid ? 'ui-btn-disabled' : 'ui-btn-primary'">
                            Guardar cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>
