<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    },
    ingredient: {
        type: Object,
        required: false,
        default: null,
    }
});

const emit = defineEmits(['close', 'save']);

// --- Estado Local del Modal ---
const editableIngredient = ref(null);
const units = ['Gr', 'Kg', 'Ml', 'L', 'Uni'];

watch(() => props.ingredient, (newIngredient) => {
    if (newIngredient) {
        editableIngredient.value = JSON.parse(JSON.stringify(newIngredient));
        editableIngredient.value.cost = Number(editableIngredient.value.cost) || 0;
        editableIngredient.value.presentationSize = Number(editableIngredient.value.presentationSize) || 0;
        editableIngredient.value.unit = editableIngredient.value.unit || 'Gr';
        editableIngredient.value.currentStock = Number(editableIngredient.value.currentStock) || 0; // Asegurar que stock exista
    } else {
        editableIngredient.value = null;
    }
}, { immediate: true });

// --- Funciones del Modal ---
function closeModal() {
    emit('close');
}

function saveChanges() {
    if (!editableIngredient.value) {
        console.error("EditIngredientModal: No ingredient to save.");
        return;
    }
    if (!editableIngredient.value.name || editableIngredient.value.cost === null || editableIngredient.value.presentationSize === null || !editableIngredient.value.unit) {
        alert('Por favor, completa todos los campos del ingrediente antes de guardar.');
        return;
    }
    if (editableIngredient.value.cost <= 0 || editableIngredient.value.presentationSize <= 0) {
        alert('El costo y el tamaño deben ser mayores a cero.');
        return;
    }

    emit('save', { ...editableIngredient.value });
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show && editableIngredient" @click.self="closeModal"
            class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">

            <div class="modal-content relative mx-auto p-6 border border-neutral-300 w-full max-w-md shadow-lg rounded-md bg-contrast
                        dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4
                            dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800
                               dark:text-dark-primary-200">Editar Ingrediente: {{ editableIngredient?.name || '' }}
                    </h3>
                    <button @click="closeModal" class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
                               dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <form @submit.prevent="saveChanges" class="space-y-4">
                    <div>
                        <label for="edit-ing-name" class="block text-sm font-medium text-text-base
                                                            dark:text-dark-text-base">Nombre:</label>
                        <input type="text" id="edit-ing-name" v-model="editableIngredient.name" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label for="edit-ing-cost" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Costo Presentación
                                ($):</label>
                            <input type="number" id="edit-ing-cost" v-model.number="editableIngredient.cost" required
                                min="0.01" step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                        </div>
                        <div>
                            <label for="edit-ing-size" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Tamaño
                                Presentación:</label>
                            <input type="number" id="edit-ing-size" v-model.number="editableIngredient.presentationSize"
                                required min="0.01" step="any" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                        </div>
                    </div>
                    <div>
                        <label for="edit-ing-unit" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Unidad:</label>
                        <select id="edit-ing-unit" v-model="editableIngredient.unit" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 bg-contrast rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                            Stock Actual:
                        </label>
                        <p class="mt-1 text-lg font-semibold text-primary-700 dark:text-dark-primary-300">
                            {{ editableIngredient.currentStock }} {{ editableIngredient.unit }}
                        </p>
                        <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">
                            Para modificar el stock, usa la acción "Añadir Stock" en la tabla principal.
                        </p>
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