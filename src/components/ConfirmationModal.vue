<script setup>
import { defineProps, defineEmits } from 'vue';
defineProps({
    show: {
        type: Boolean,
        required: true,
    },
    title: {
        type: String,
        default: 'Confirmación'
    },
    message: {
        type: String,
        required: true
    },
    confirmButtonText: {
        type: String,
        default: 'Confirmar'
    },
    cancelButtonText: {
        type: String,
        default: 'Cancelar'
    },
    confirmButtonClass: { // Para poder pasar clases de estilo (ej. color rojo para borrar)
        type: String,
        default: 'bg-danger-600 hover:bg-danger-700 focus:ring-danger-500'
    }
});
const emit = defineEmits(['close', 'confirm']);

function closeModal() {
    emit('close');
}

function confirmAction() {
    emit('confirm');
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
                               dark:text-dark-primary-200">{{ title }}</h3>
                     <button @click="closeModal"
                        class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
                               dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <div class="mb-4">
                     <p class="text-text-base
                              dark:text-dark-text-base">{{ message }}</p>
                </div>

                <div class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3
                            dark:border-dark-neutral-700">
                     <button type="button" @click="closeModal"
                        class="px-4 py-2 bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400
                               dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                        {{ cancelButtonText }}
                    </button>
                    <button type="button" @click="confirmAction"
                        :class="['px-4 py-2 text-white font-semibold transition-all rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2', confirmButtonClass]">
                        {{ confirmButtonText }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>