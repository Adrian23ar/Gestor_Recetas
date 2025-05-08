<script setup>
import { ref, defineProps, defineEmits, watch } from 'vue';
const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    }
});
const emit = defineEmits(['close', 'add']);

const newRecipeName = ref('');

// Limpiar el nombre cuando se abre el modal
watch(() => props.show, (newValue) => {
    if (newValue) {
        newRecipeName.value = '';
    }
});
function closeModal() {
    emit('close');
}

function submitAddRecipe() {
    const trimmedName = newRecipeName.value.trim();
    if (!trimmedName) {
        alert('Por favor, introduce un nombre para la receta.');
        return;
    }
    emit('add', trimmedName); // ✅ Emite el nombre como parámetro
    closeModal();
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" @click.self="closeModal"
            class="fixed inset-0 backdrop-brightness-50 overflow-y-auto h-full w-full z-50 flex justify-center items-center">

            <div class="modal-content relative mx-auto p-6 border border-neutral-300 w-full max-w-md shadow-lg rounded-md bg-contrast
                        dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4
                            dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800
                               dark:text-dark-primary-200">Añadir Nueva Receta</h3>
                    <button @click="closeModal" class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
                               dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <form @submit.prevent="submitAddRecipe">
                    <div>
                        <label for="new-recipe-name" class="block text-sm font-medium text-text-base
                                                            dark:text-dark-text-base">Nombre de la
                            Receta:</label>
                        <input type="text" id="new-recipe-name" v-model="newRecipeName" required ref="inputRef" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                    </div>

                    <div class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3
                                dark:border-dark-neutral-700">
                        <button type="button" @click="closeModal" class="px-4 py-2 bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400
                                   dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                            Cancelar
                        </button>
                        <button type="submit"
                            class="px-4 py-2 cursor-pointer bg-accent-500 text-white transition-all font-semibold rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
                                   dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            Añadir Receta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>