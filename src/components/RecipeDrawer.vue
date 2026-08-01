<script setup>
import { ref, computed, watch } from 'vue';
import Multiselect from '@vueform/multiselect';
import { formatCurrency } from '../utils/utils.js';
import { useRecipeCosts } from '../composables/useRecipeCosts.js';
import { multiselectTheme } from '../utils/multiselectTheme.js';

const props = defineProps({
    recipe: { type: Object, default: null },
    globalIngredients: { type: Array, required: true },
    show: { type: Boolean, required: true },
});
const emit = defineEmits(['close', 'save']);

const editableRecipe = ref(null);
const activeTab = ref('ingredients');

const selectedIngredientId = ref('');
const newIngredientQuantity = ref(null);
const editIngredientId = ref(null);
const ingredientFormError = ref(null);

watch(() => props.recipe, (newRecipe) => {
    if (newRecipe) {
        editableRecipe.value = JSON.parse(JSON.stringify(newRecipe));
        editableRecipe.value.packagingCostPerBatch = Number(editableRecipe.value.packagingCostPerBatch) || 0;
        editableRecipe.value.laborCostPerBatch = Number(editableRecipe.value.laborCostPerBatch) || 0;
        editableRecipe.value.itemsPerBatch = Number(editableRecipe.value.itemsPerBatch) || 1;
        editableRecipe.value.profitMarginPercent = Number(editableRecipe.value.profitMarginPercent) || 0;
        editableRecipe.value.lossBufferPercent = Number(editableRecipe.value.lossBufferPercent) || 0;
        if (!Array.isArray(editableRecipe.value.ingredients)) {
            editableRecipe.value.ingredients = [];
        }
    } else {
        editableRecipe.value = null;
    }
    activeTab.value = 'ingredients';
    clearForm();
}, { immediate: true });

function clearForm() {
    selectedIngredientId.value = '';
    newIngredientQuantity.value = null;
    editIngredientId.value = null;
    ingredientFormError.value = null;
}

function startEdit(recipeIng) {
    selectedIngredientId.value = recipeIng.ingredientId;
    newIngredientQuantity.value = recipeIng.quantity;
    editIngredientId.value = recipeIng.ingredientId;
    ingredientFormError.value = null;
}

function saveRecipeIngredient() {
    ingredientFormError.value = null;

    if (newIngredientQuantity.value === null || newIngredientQuantity.value <= 0) {
        ingredientFormError.value = 'Especifica una cantidad válida mayor a cero.';
        return;
    }

    if (editIngredientId.value) {
        const ingredientToUpdate = editableRecipe.value.ingredients.find(
            (ing) => ing.ingredientId === editIngredientId.value
        );
        if (ingredientToUpdate) {
            ingredientToUpdate.quantity = parseFloat(newIngredientQuantity.value);
        }
    } else {
        if (!selectedIngredientId.value) {
            ingredientFormError.value = 'Selecciona un ingrediente.';
            return;
        }
        const existing = editableRecipe.value.ingredients.find(
            (ing) => ing.ingredientId === selectedIngredientId.value
        );
        if (existing) {
            ingredientFormError.value = 'Este ingrediente ya está en la receta. Usa "Editar" para modificar su cantidad.';
            return;
        }
        editableRecipe.value.ingredients.push({
            ingredientId: selectedIngredientId.value,
            quantity: parseFloat(newIngredientQuantity.value),
        });
    }

    clearForm();
}

function removeRecipeIngredient(ingredientIdToRemove) {
    editableRecipe.value.ingredients = editableRecipe.value.ingredients.filter(
        (ing) => ing.ingredientId !== ingredientIdToRemove
    );
    if (ingredientIdToRemove === editIngredientId.value) {
        clearForm();
    }
}

function getIngredientDetails(recipeIngredient) {
    const global = props.globalIngredients.find(g => g.id === recipeIngredient.ingredientId);
    return global ? { ...global, quantityInRecipe: recipeIngredient.quantity } : null;
}

function remainingStockWarning(recipeIng) {
    const details = getIngredientDetails(recipeIng);
    if (!details) return null;
    const stock = Number(details.currentStock) || 0;
    if (recipeIng.quantity > stock) {
        return `solo quedan ${stock} ${details.unit} en stock`;
    }
    return null;
}

// --- Costos (useRecipeCosts.js — misma fórmula que useProductionRecords espera) ---
const costs = useRecipeCosts(editableRecipe, () => props.globalIngredients);

const ingredientsPerUnit = computed(() => {
    if (!editableRecipe.value || !editableRecipe.value.itemsPerBatch) return 0;
    return costs.value.totalIngredientCost / editableRecipe.value.itemsPerBatch;
});
const packagingPerUnit = computed(() => {
    if (!editableRecipe.value || !editableRecipe.value.itemsPerBatch) return 0;
    return Number(editableRecipe.value.packagingCostPerBatch || 0) / editableRecipe.value.itemsPerBatch;
});

// --- Validación en línea (sustituye los alert() de costos y márgenes) ---
const errors = computed(() => {
    const e = {};
    if (!editableRecipe.value) return e;
    if (!editableRecipe.value.name || !editableRecipe.value.name.trim()) {
        e.name = 'El nombre de la receta no puede estar vacío.';
    }
    if (editableRecipe.value.packagingCostPerBatch === null || isNaN(editableRecipe.value.packagingCostPerBatch) || editableRecipe.value.packagingCostPerBatch < 0) {
        e.packagingCostPerBatch = 'No puede ser negativo.';
    }
    if (editableRecipe.value.laborCostPerBatch === null || isNaN(editableRecipe.value.laborCostPerBatch) || editableRecipe.value.laborCostPerBatch < 0) {
        e.laborCostPerBatch = 'No puede ser negativo.';
    }
    if (editableRecipe.value.itemsPerBatch === null || isNaN(editableRecipe.value.itemsPerBatch) || editableRecipe.value.itemsPerBatch < 1) {
        e.itemsPerBatch = 'Debe ser 1 o más.';
    }
    if (editableRecipe.value.profitMarginPercent === null || isNaN(editableRecipe.value.profitMarginPercent) || editableRecipe.value.profitMarginPercent < 0) {
        e.profitMarginPercent = 'No puede ser negativo.';
    }
    if (editableRecipe.value.lossBufferPercent === null || isNaN(editableRecipe.value.lossBufferPercent) || editableRecipe.value.lossBufferPercent < 0) {
        e.lossBufferPercent = 'No puede ser negativo.';
    }
    return e;
});
const isValid = computed(() => Object.keys(errors.value).length === 0);
const firstErrorMessage = computed(() => Object.values(errors.value)[0] || null);

function closeModal() {
    emit('close');
}

function saveChanges() {
    if (!editableRecipe.value || !isValid.value) return;

    const laborCostForBatch = Number(editableRecipe.value.laborCostPerBatch || 0);
    // Invariante: useProductionRecords rechaza registrar producción si faltan estos 3 campos.
    editableRecipe.value.calculatedRecipeOnlyCost = costs.value.recipeOnlyCost;
    editableRecipe.value.calculatedTotalBatchCostAllIncluded = costs.value.recipeOnlyCost + laborCostForBatch;
    editableRecipe.value.calculatedFinalPrice = costs.value.finalPrice;

    emit('save', { ...editableRecipe.value });
}
</script>

<template>
    <Transition name="drawer-transition">
        <div v-if="show && editableRecipe" class="ui-backdrop flex justify-end" @click.self="closeModal">
            <div class="ui-drawer modal-content">
                <!-- Cabecera fija -->
                <div class="flex shrink-0 items-start justify-between gap-4 border-b border-stone-200 px-6 py-5 dark:border-stone-700">
                    <div class="min-w-0 flex-1">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Receta</p>
                        <input v-model="editableRecipe.name" type="text" placeholder="Nombre de la receta"
                            class="-mx-1 mt-0.5 w-full truncate rounded-md bg-transparent px-1 text-2xl font-semibold tracking-[-0.02em] text-stone-800 outline-none transition-colors hover:bg-stone-100 focus:bg-stone-100 dark:text-stone-100 dark:hover:bg-stone-700/50 dark:focus:bg-stone-700/50" />
                        <p v-if="errors.name" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.name }}</p>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <!-- Pestañas -->
                <div class="shrink-0 border-b border-stone-200 px-6 py-3 dark:border-stone-700">
                    <div class="ui-seg-track w-fit">
                        <button type="button" :class="activeTab === 'ingredients' ? 'ui-seg-active' : 'ui-seg'" @click="activeTab = 'ingredients'">
                            Ingredientes
                        </button>
                        <button type="button" :class="activeTab === 'costs' ? 'ui-seg-active' : 'ui-seg'" @click="activeTab = 'costs'">
                            Costos y márgenes
                        </button>
                    </div>
                </div>

                <!-- Contenido scrollable -->
                <div class="flex-1 overflow-y-auto px-6 py-5">
                    <div v-if="activeTab === 'ingredients'" class="space-y-5">
                        <div class="ui-panel space-y-3 p-4">
                            <div class="grid grid-cols-[1fr_140px] gap-3 max-[640px]:grid-cols-1">
                                <div>
                                    <label class="ui-label">Ingrediente</label>
                                    <Multiselect v-model="selectedIngredientId" :options="globalIngredients" :searchable="true"
                                        valueProp="id" label="name" trackBy="name" :clearOnSelect="true" :closeOnSelect="true"
                                        placeholder="Buscar…" noOptionsText="Lista vacía" noResultsText="No se encontraron ingredientes"
                                        :disabled="editIngredientId !== null" :classes="multiselectTheme">
                                        <template #option="{ option }">
                                            <div>{{ option.name }}
                                                <span class="text-xs text-stone-400">({{ formatCurrency(option.cost) }} / {{ option.presentationSize }} {{ option.unit }})</span>
                                            </div>
                                        </template>
                                    </Multiselect>
                                </div>
                                <div>
                                    <label class="ui-label">Cantidad</label>
                                    <input v-model.number="newIngredientQuantity" type="number" min="0.01" step="any"
                                        placeholder="Ej: 125" class="ui-input" />
                                </div>
                            </div>
                            <p v-if="ingredientFormError" class="text-xs text-red-600 dark:text-red-400">{{ ingredientFormError }}</p>
                            <div class="flex items-center gap-2">
                                <button type="button" @click="saveRecipeIngredient" class="ui-btn-primary !px-4 !py-2 !text-sm">
                                    {{ editIngredientId ? 'Actualizar' : 'Añadir' }}
                                </button>
                                <button v-if="editIngredientId" type="button" @click="clearForm" class="ui-btn-outline !px-4 !py-2 !text-sm">
                                    Cancelar
                                </button>
                            </div>
                        </div>

                        <p v-if="editableRecipe.ingredients.length === 0" class="text-sm text-stone-400">
                            No hay ingredientes añadidos a esta receta.
                        </p>
                        <ul v-else class="divide-y divide-stone-100 dark:divide-stone-800">
                            <li v-for="recipeIng in editableRecipe.ingredients" :key="recipeIng.ingredientId" class="py-3">
                                <template v-if="getIngredientDetails(recipeIng)">
                                    <div class="flex items-start justify-between gap-3">
                                        <div class="min-w-0">
                                            <p class="text-sm font-medium text-stone-800 dark:text-stone-100">
                                                {{ getIngredientDetails(recipeIng).name }}
                                                <span class="font-normal text-stone-400">— {{ recipeIng.quantity }} {{ getIngredientDetails(recipeIng).unit }}</span>
                                            </p>
                                            <p class="text-xs text-stone-400">
                                                Costo: {{ formatCurrency(costs.ingredientCosts[recipeIng.ingredientId] || 0) }}
                                            </p>
                                            <p v-if="remainingStockWarning(recipeIng)" class="mt-0.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                                                {{ remainingStockWarning(recipeIng) }}
                                            </p>
                                        </div>
                                        <div class="flex shrink-0 items-center gap-2">
                                            <button type="button" class="ui-btn-subtle" @click="startEdit(recipeIng)">Editar</button>
                                            <button type="button" class="ui-btn-danger-ghost" @click="removeRecipeIngredient(recipeIng.ingredientId)">Quitar</button>
                                        </div>
                                    </div>
                                </template>
                                <p v-else class="text-xs text-red-600 dark:text-red-400">
                                    Error: ingrediente no encontrado (ID: {{ recipeIng.ingredientId }})
                                </p>
                            </li>
                        </ul>
                        <div class="flex items-center justify-between border-t border-stone-200 pt-3 text-sm dark:border-stone-700">
                            <span class="font-medium text-stone-600 dark:text-stone-300">Costo total de ingredientes por lote</span>
                            <span class="font-semibold tabular-nums text-stone-800 dark:text-stone-100">{{ formatCurrency(costs.totalIngredientCost) }}</span>
                        </div>
                    </div>

                    <div v-else class="space-y-6">
                        <div class="grid grid-cols-3 gap-4 max-[640px]:grid-cols-1">
                            <div>
                                <label class="ui-label">Empaque (por lote, $)</label>
                                <input v-model.number="editableRecipe.packagingCostPerBatch" type="number" min="0" step="0.01"
                                    :class="['ui-input', errors.packagingCostPerBatch && 'ui-input-error']" />
                                <p v-if="errors.packagingCostPerBatch" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.packagingCostPerBatch }}</p>
                            </div>
                            <div>
                                <label class="ui-label">Mano de obra (por lote, $)</label>
                                <input v-model.number="editableRecipe.laborCostPerBatch" type="number" min="0" step="0.01"
                                    :class="['ui-input', errors.laborCostPerBatch && 'ui-input-error']" />
                                <p v-if="errors.laborCostPerBatch" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.laborCostPerBatch }}</p>
                            </div>
                            <div>
                                <label class="ui-label">Items por lote</label>
                                <input v-model.number="editableRecipe.itemsPerBatch" type="number" min="1" step="1"
                                    :class="['ui-input', errors.itemsPerBatch && 'ui-input-error']" />
                                <p v-if="errors.itemsPerBatch" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.itemsPerBatch }}</p>
                            </div>
                            <div>
                                <label class="ui-label">Margen de ganancia (%)</label>
                                <input v-model.number="editableRecipe.profitMarginPercent" type="number" min="0" step="0.1"
                                    :class="['ui-input', errors.profitMarginPercent && 'ui-input-error']" />
                                <p v-if="errors.profitMarginPercent" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.profitMarginPercent }}</p>
                            </div>
                            <div>
                                <label class="ui-label">Buffer de pérdida (%)</label>
                                <input v-model.number="editableRecipe.lossBufferPercent" type="number" min="0" step="0.1"
                                    :class="['ui-input', errors.lossBufferPercent && 'ui-input-error']" />
                                <p v-if="errors.lossBufferPercent" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errors.lossBufferPercent }}</p>
                            </div>
                        </div>

                        <div class="ui-card-inverted rounded-panel p-5">
                            <p class="text-[15px] font-semibold">Cómo se forma el precio</p>
                            <dl class="mt-3 space-y-2 text-sm">
                                <div class="flex items-center justify-between">
                                    <dt class="text-stone-300">Ingredientes</dt>
                                    <dd class="tabular-nums">{{ formatCurrency(ingredientsPerUnit) }}</dd>
                                </div>
                                <div class="flex items-center justify-between">
                                    <dt class="text-stone-300">+ Empaque</dt>
                                    <dd class="tabular-nums">{{ formatCurrency(packagingPerUnit) }}</dd>
                                </div>
                                <div class="flex items-center justify-between">
                                    <dt class="text-stone-300">+ Mano de obra</dt>
                                    <dd class="tabular-nums">{{ formatCurrency(costs.laborCostPerIndividualItem) }}</dd>
                                </div>
                                <div class="flex items-center justify-between border-t border-stone-700 pt-2">
                                    <dt class="font-medium text-stone-100">= Costo unitario</dt>
                                    <dd class="font-medium tabular-nums">{{ formatCurrency(costs.totalCostPerIndividualItem) }}</dd>
                                </div>
                                <div class="flex items-center justify-between">
                                    <dt class="text-stone-300">+ Ganancia ({{ editableRecipe.profitMarginPercent || 0 }}%)</dt>
                                    <dd class="tabular-nums">{{ formatCurrency(costs.sellingPrice) }}</dd>
                                </div>
                                <div class="flex items-center justify-between">
                                    <dt class="text-stone-300">+ Buffer ({{ editableRecipe.lossBufferPercent || 0 }}%)</dt>
                                    <dd class="tabular-nums">{{ formatCurrency(costs.finalPrice) }}</dd>
                                </div>
                            </dl>
                            <div class="mt-4 flex items-center justify-between border-t border-stone-700 pt-3">
                                <span class="text-sm font-medium text-stone-100">PVP final</span>
                                <span class="text-[26px] font-semibold tabular-nums tracking-[-0.02em] text-[#fcd34d]">
                                    {{ formatCurrency(costs.finalPrice) }}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Pie fijo -->
                <div class="flex shrink-0 items-center justify-between gap-3 border-t border-stone-200 px-6 py-4 dark:border-stone-700">
                    <p class="min-w-0 flex-1 truncate text-xs font-medium text-red-600 dark:text-red-400">{{ firstErrorMessage }}</p>
                    <div class="flex shrink-0 items-center gap-3">
                        <button type="button" @click="closeModal" class="ui-btn-outline">Descartar</button>
                        <button type="button" :disabled="!isValid" :class="!isValid ? 'ui-btn-disabled' : 'ui-btn-primary'" @click="saveChanges">
                            Guardar cambios
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </Transition>
</template>
