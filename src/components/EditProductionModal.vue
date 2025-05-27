<script setup>
import { ref, watch, computed } from 'vue';

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

// --- Estado Local del Modal ---
const editableRecord = ref(null);

watch(() => props.record, (newRecord) => {
    if (newRecord) {
        editableRecord.value = JSON.parse(JSON.stringify(newRecord));
        editableRecord.value.batchSize = Number(editableRecord.value.batchSize) || 0;
        editableRecord.value.netProfit = Number(editableRecord.value.netProfit) || 0;
        editableRecord.value.date = editableRecord.value.date || '';
        // Asegurar que isSold exista, por defecto false si no viene en el registro
        editableRecord.value.isSold = typeof editableRecord.value.isSold === 'boolean' ? editableRecord.value.isSold : false;
    } else {
        editableRecord.value = null;
    }
}, { immediate: true });

// --- NUEVO: Computed para formatear Ganancia Neta ---
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
// --- Fin Computed ---

// --- Funciones del Modal ---
function closeModal() {
    emit('close');
}

function saveChanges() {
    if (!editableRecord.value) {
        console.error("EditProductionModal: No hay registro editable.");
        return;
    }
    // Se mantiene la validación original, isSold no es obligatorio para guardar
    if (!editableRecord.value.productName || editableRecord.value.batchSize === null || !editableRecord.value.date || editableRecord.value.netProfit === null || isNaN(editableRecord.value.netProfit)) {
        alert('Por favor, completa todos los campos antes de guardar.');
        return;
    }
    if (editableRecord.value.batchSize <= 0) {
        alert('El lote debe ser mayor a cero.');
        return;
    }
    if (editableRecord.value.netProfit === null || isNaN(editableRecord.value.netProfit)) {
        alert('La ganancia neta debe ser un número válido.');
        return;
    }

    emit('save', { ...editableRecord.value }); // editableRecord.value ya incluye isSold
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show && editableRecord" @click.self="closeModal"
            class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">

            <div class="modal-content relative mx-auto p-6 border border-neutral-300 w-full max-w-md shadow-lg rounded-md bg-contrast
            dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4
              dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800
               dark:text-dark-primary-200">Editar Registro: {{ editableRecord?.productName || '' }}
                    </h3>
                    <button @click="closeModal" class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
               dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <form @submit.prevent="saveChanges" class="space-y-4">
                    <div>
                        <label for="edit-product-name" class="block text-sm font-medium text-text-base
                              dark:text-dark-text-base">Producción (Nombre
                            del producto):</label>
                        <input type="text" id="edit-product-name" v-model="editableRecord.productName" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                 dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                 dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="edit-batch-size" class="block text-sm font-medium text-text-base
                              dark:text-dark-text-base">Lote (Cantidad):</label>
                        <input type="number" id="edit-batch-size" v-model.number="editableRecord.batchSize" required
                            min="1" step="1" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                 dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                 dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="edit-production-date" class="block text-sm font-medium text-text-base
                          dark:text-dark-text-base">Fecha:</label>
                        <input type="date" id="edit-production-date" v-model="editableRecord.date" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm bg-contrast
               dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base
               dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="edit-net-profit"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Ganancia Neta
                            ($):</label>
                        <input type="text" inputmode="decimal" id="edit-net-profit" v-model="formattedNetProfit"
                            required placeholder="0.00"
                            class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>

                    <div class="flex items-center">
                        <input type="checkbox" id="edit-is-sold" v-model="editableRecord.isSold"
                            class="h-4 w-4 text-accent-600 border-neutral-300 rounded focus:ring-accent-500
                 dark:border-dark-neutral-600 dark:bg-dark-neutral-700 dark:focus:ring-dark-accent-500 dark:checked:bg-dark-accent-500" />
                        <label for="edit-is-sold" class="ml-2 block text-sm text-text-base dark:text-dark-text-base">
                            Lote Vendido
                        </label>
                    </div>
                    <div class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3
                dark:border-dark-neutral-700">
                        <button type="button" @click="closeModal" class="px-4 py-2 cursor-pointer bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400
                 dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                            Cancelar
                        </button>
                        <button type="submit"
                            class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
                 dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            Guardar Cambios
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>