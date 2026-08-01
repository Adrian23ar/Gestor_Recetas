<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    },
    eyebrow: {
        type: String,
        default: 'Confirmar acción'
    },
    title: {
        type: String,
        default: 'Confirmación'
    },
    message: {
        type: String,
        required: true
    },
    details: {
        type: String,
        default: null
    },
    // Si viene, exige escribir esta frase exacta (trim + lowercase) para habilitar el botón.
    confirmPhrase: {
        type: String,
        default: null
    },
    confirmButtonText: {
        type: String,
        default: 'Confirmar'
    },
    cancelButtonText: {
        type: String,
        default: 'Cancelar'
    },
});
const emit = defineEmits(['close', 'confirm']);

const typedPhrase = ref('');

watch(() => props.show, (isOpen) => {
    if (isOpen) typedPhrase.value = '';
});

const isConfirmDisabled = computed(() => {
    if (!props.confirmPhrase) return false;
    return typedPhrase.value.trim().toLowerCase() !== props.confirmPhrase.trim().toLowerCase();
});

function closeModal() {
    emit('close');
}

function confirmAction() {
    if (isConfirmDisabled.value) return;
    emit('confirm');
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-md">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">{{ eyebrow }}</p>
                        <h3 class="mt-0.5 text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
                            {{ title }}
                        </h3>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <div class="mt-4 space-y-3">
                    <p class="text-sm text-stone-600 dark:text-stone-300">{{ message }}</p>
                    <p v-if="details" class="rounded-box bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-400">
                        {{ details }}
                    </p>
                    <div v-if="confirmPhrase">
                        <label class="ui-label">
                            Escribe <strong class="text-stone-800 dark:text-stone-100">{{ confirmPhrase }}</strong> para confirmar
                        </label>
                        <input v-model="typedPhrase" type="text" class="ui-input" autocomplete="off"
                            @keyup.enter="confirmAction" />
                    </div>
                </div>

                <div class="mt-6 flex items-center justify-between gap-3">
                    <button type="button" @click="closeModal" class="ui-btn-outline">
                        {{ cancelButtonText }}
                    </button>
                    <button type="button" @click="confirmAction" :disabled="isConfirmDisabled"
                        :class="isConfirmDisabled ? 'ui-btn-disabled' : 'ui-btn-primary'">
                        {{ confirmButtonText }}
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>
