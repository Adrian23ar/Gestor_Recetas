<script setup>
import { ref, computed, watch } from 'vue';
import Multiselect from '@vueform/multiselect';
import { multiselectTheme } from '../utils/multiselectTheme.js';

const props = defineProps({
    show: { type: Boolean, required: true },
    ingredient: { type: Object, default: null }, // null = alta
});

const emit = defineEmits(['close', 'save', 'adjust-stock']);

const units = ['Gr', 'Kg', 'Ml', 'L', 'Uni'];
const isEditMode = computed(() => !!props.ingredient);

const form = ref({ name: '', cost: null, presentationSize: null, unit: 'Gr', initialStock: null });
const touched = ref({ name: false, cost: false, presentationSize: false, initialStock: false });

watch([() => props.show, () => props.ingredient], ([show, ingredient]) => {
    if (!show) return;
    touched.value = { name: false, cost: false, presentationSize: false, initialStock: false };
    if (ingredient) {
        form.value = {
            name: ingredient.name || '',
            cost: Number(ingredient.cost) || 0,
            presentationSize: Number(ingredient.presentationSize) || 0,
            unit: ingredient.unit || 'Gr',
            initialStock: null,
        };
    } else {
        form.value = { name: '', cost: null, presentationSize: null, unit: 'Gr', initialStock: null };
    }
}, { immediate: true });

const errors = computed(() => {
    const e = {};
    if (!form.value.name || !form.value.name.trim()) e.name = 'El nombre es obligatorio.';
    if (form.value.cost === null || isNaN(form.value.cost) || form.value.cost <= 0) {
        e.cost = 'Debe ser mayor a cero.';
    }
    if (form.value.presentationSize === null || isNaN(form.value.presentationSize) || form.value.presentationSize <= 0) {
        e.presentationSize = 'Debe ser mayor a cero.';
    }
    if (!isEditMode.value && form.value.initialStock !== null && (isNaN(form.value.initialStock) || form.value.initialStock < 0)) {
        e.initialStock = 'Debe ser cero o mayor.';
    }
    return e;
});
const isValid = computed(() => Object.keys(errors.value).length === 0);

function touch(field) {
    touched.value[field] = true;
}

function closeModal() {
    emit('close');
}

function handleSubmit() {
    touched.value = { name: true, cost: true, presentationSize: true, initialStock: true };
    if (!isValid.value) return;

    if (isEditMode.value) {
        emit('save', {
            ...props.ingredient,
            name: form.value.name.trim(),
            cost: Number(form.value.cost),
            presentationSize: Number(form.value.presentationSize),
            unit: form.value.unit,
        });
    } else {
        emit('save', {
            name: form.value.name.trim(),
            cost: Number(form.value.cost),
            presentationSize: Number(form.value.presentationSize),
            unit: form.value.unit,
            currentStock: Number(form.value.initialStock) || 0,
        });
    }
}

function requestAdjustStock() {
    emit('adjust-stock', props.ingredient);
}
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-lg">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Ingrediente</p>
                        <h3 class="mt-0.5 text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
                            {{ isEditMode ? 'Editar ingrediente' : 'Nuevo ingrediente' }}
                        </h3>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <form class="mt-5 space-y-4" @submit.prevent="handleSubmit">
                    <div>
                        <label class="ui-label" for="ing-modal-name">Nombre</label>
                        <input id="ing-modal-name" v-model="form.name" type="text" :class="['ui-input', errors.name && touched.name && 'ui-input-error']"
                            @blur="touch('name')" />
                        <p v-if="errors.name && touched.name" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.name }}</p>
                    </div>

                    <div class="grid grid-cols-3 gap-3 max-[640px]:grid-cols-1">
                        <div>
                            <label class="ui-label" for="ing-modal-cost">Costo presentación ($)</label>
                            <input id="ing-modal-cost" v-model.number="form.cost" type="number" min="0.01" step="0.01"
                                :class="['ui-input', errors.cost && touched.cost && 'ui-input-error']" @blur="touch('cost')" />
                            <p v-if="errors.cost && touched.cost" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.cost }}</p>
                        </div>
                        <div>
                            <label class="ui-label" for="ing-modal-size">Tamaño presentación</label>
                            <input id="ing-modal-size" v-model.number="form.presentationSize" type="number" min="0.01" step="any"
                                :class="['ui-input', errors.presentationSize && touched.presentationSize && 'ui-input-error']"
                                @blur="touch('presentationSize')" />
                            <p v-if="errors.presentationSize && touched.presentationSize" class="mt-1 text-xs text-red-600 dark:text-red-400">
                                {{ errors.presentationSize }}
                            </p>
                        </div>
                        <div>
                            <label class="ui-label" for="ing-modal-unit">Unidad</label>
                            <Multiselect id="ing-modal-unit" v-model="form.unit" :options="units" :searchable="false"
                                :canClear="false" :canDeselect="false" :classes="multiselectTheme" />
                        </div>
                    </div>

                    <div v-if="!isEditMode">
                        <label class="ui-label" for="ing-modal-initial-stock">Stock inicial (opcional)</label>
                        <input id="ing-modal-initial-stock" v-model.number="form.initialStock" type="number" min="0" step="any"
                            placeholder="Ej: 1000" :class="['ui-input', errors.initialStock && touched.initialStock && 'ui-input-error']"
                            @blur="touch('initialStock')" />
                        <p v-if="errors.initialStock && touched.initialStock" class="mt-1 text-xs text-red-600 dark:text-red-400">
                            {{ errors.initialStock }}
                        </p>
                        <p v-else class="mt-1 text-xs text-stone-400">Cantidad actual que tienes. Si se deja vacío, será 0.</p>
                    </div>

                    <div v-else class="ui-panel px-3.5 py-3">
                        <p class="ui-label !mb-1">Stock actual</p>
                        <p class="text-sm text-stone-700 dark:text-stone-200">
                            <span class="tabular-nums font-semibold">{{ ingredient.currentStock }}</span> {{ ingredient.unit }}
                        </p>
                        <button type="button" @click="requestAdjustStock"
                            class="mt-1.5 cursor-pointer text-xs font-semibold text-accent-600 hover:text-accent-700 dark:text-accent-400 dark:hover:text-accent-300">
                            Ajustar stock →
                        </button>
                    </div>

                    <div class="mt-2 flex items-center justify-between gap-3">
                        <button type="button" @click="closeModal" class="ui-btn-outline">Cancelar</button>
                        <button type="submit" :class="!isValid ? 'ui-btn-disabled' : 'ui-btn-primary'">
                            {{ isEditMode ? 'Guardar cambios' : 'Añadir ingrediente' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>
