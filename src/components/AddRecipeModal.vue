<script setup>
import { ref, watch } from 'vue';

const props = defineProps({
    show: {
        type: Boolean,
        required: true,
    }
});
const emit = defineEmits(['close', 'add']);

const newRecipeName = ref('');
const touched = ref(false);

watch(() => props.show, (newValue) => {
    if (newValue) {
        newRecipeName.value = '';
        touched.value = false;
    }
});

const errorMessage = ref(null);
watch(newRecipeName, () => {
    errorMessage.value = newRecipeName.value.trim() ? null : 'Introduce un nombre para la receta.';
}, { immediate: true });

function closeModal() {
    emit('close');
}

function submitAddRecipe() {
    touched.value = true;
    const trimmedName = newRecipeName.value.trim();
    if (!trimmedName) return;
    emit('add', trimmedName);
    closeModal();
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-md">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Receta</p>
                        <h3 class="mt-0.5 text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
                            Nueva receta
                        </h3>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <form class="mt-5" @submit.prevent="submitAddRecipe">
                    <label class="ui-label" for="new-recipe-name">Nombre de la receta</label>
                    <input id="new-recipe-name" v-model="newRecipeName" type="text" placeholder="Ej: Torta de chocolate"
                        autofocus :class="['ui-input', errorMessage && touched && 'ui-input-error']" @blur="touched = true" />
                    <p v-if="errorMessage && touched" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errorMessage }}</p>

                    <div class="mt-6 flex items-center justify-between gap-3">
                        <button type="button" @click="closeModal" class="ui-btn-outline">Cancelar</button>
                        <button type="submit" :class="errorMessage && touched ? 'ui-btn-disabled' : 'ui-btn-primary'">
                            Añadir receta
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>
