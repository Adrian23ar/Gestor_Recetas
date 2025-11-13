<script setup>
import { ref, computed, watch } from 'vue';
import Multiselect from '@vueform/multiselect';
import { formatCurrency } from '../utils/utils.js';

const props = defineProps({
    recipe: {
        type: Object,
        required: true,
    },
    globalIngredients: {
        type: Array,
        required: true,
    },
    show: { // Controla la visibilidad del modal desde el padre
        type: Boolean,
        required: true,
    }
});
const emit = defineEmits(['close', 'save']);

// --- Estado Local del Modal ---
const editableRecipe = ref(null);
const selectedIngredientId = ref('');
const newIngredientQuantity = ref(null);

// --- NUEVO (Fase 2.1) ---
const editIngredientId = ref(null);
// --------------------

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
    // Limpiar formulario si la receta cambia o se cierra el modal
    clearForm();
}, { immediate: true });

// --- Lógica de Ingredientes de la Receta ---

// --- NUEVO (Fase 3.1) ---
/**
 * Resetea el formulario de ingredientes y sale del modo edición.
 */
function clearForm() {
    selectedIngredientId.value = '';
    newIngredientQuantity.value = null;
    editIngredientId.value = null;
}

// --- NUEVO (Fase 2.2) ---
/**
 * Inicia el modo edición para un ingrediente de la receta.
 * @param {object} recipeIng - El ingrediente de la receta (ej. { ingredientId: 'xyz', quantity: 100 })
 */
function startEdit(recipeIng) {
    selectedIngredientId.value = recipeIng.ingredientId;
    newIngredientQuantity.value = recipeIng.quantity;
    editIngredientId.value = recipeIng.ingredientId;
}

// --- MODIFICADO (Fase 3.2) ---
/**
 * Guarda (añade o actualiza) un ingrediente en la lista de la receta.
 */
function saveRecipeIngredient() {
    if (newIngredientQuantity.value === null || newIngredientQuantity.value <= 0) {
        alert('Especifica una cantidad válida mayor a cero.');
        return;
    }

    // --- LÓGICA DE ACTUALIZACIÓN (Modo Edición) ---
    if (editIngredientId.value) {
        const ingredientToUpdate = editableRecipe.value.ingredients.find(
            (ing) => ing.ingredientId === editIngredientId.value
        );
        if (ingredientToUpdate) {
            ingredientToUpdate.quantity = parseFloat(newIngredientQuantity.value);
        }
    }
    // --- LÓGICA DE AÑADIR (Modo Añadir) ---
    else {
        if (!selectedIngredientId.value) {
            alert('Selecciona un ingrediente.');
            return;
        }
        const existing = editableRecipe.value.ingredients.find(
            (ing) => ing.ingredientId === selectedIngredientId.value
        );
        if (existing) {
            alert('Este ingrediente ya está en la receta. Usa el botón "Editar" para modificar su cantidad.');
            return;
        }
        editableRecipe.value.ingredients.push({
            ingredientId: selectedIngredientId.value,
            quantity: parseFloat(newIngredientQuantity.value),
        });
    }

    // Limpiar el formulario y salir del modo edición
    clearForm();
}

// --- MODIFICADO (Fase 4.1) ---
function removeRecipeIngredient(ingredientIdToRemove) {
    editableRecipe.value.ingredients = editableRecipe.value.ingredients.filter(
        (ing) => ing.ingredientId !== ingredientIdToRemove
    );

    // Si el ingrediente eliminado era el que se estaba editando, limpiar el formulario
    if (ingredientIdToRemove === editIngredientId.value) {
        clearForm();
    }
}
// --- FIN MODIFICACIONES DE LÓGICA ---

function getIngredientDetails(recipeIngredient) {
    const global = props.globalIngredients.find(g => g.id === recipeIngredient.ingredientId);
    return global ? { ...global, quantityInRecipe: recipeIngredient.quantity } : null;
}

// --- Cálculos Reactivos de Costos (Computed Properties) ---
const calculatedCosts = computed(() => {
    // ... (lógica de computed existente sin cambios)
    const defaults = {
        totalIngredientCost: 0,
        recipeOnlyCost: 0,
        laborCostPerIndividualItem: 0,
        baseCostPerIndividualItem: 0,
        totalCostPerIndividualItem: 0,
        sellingPrice: 0,
        finalPrice: 0,
        ingredientCosts: {}
    };

    if (!editableRecipe.value || !props.globalIngredients) {
        return defaults;
    }

    let calculatedTotalIngredientCost = 0;
    const calculatedIngredientCosts = {};

    editableRecipe.value.ingredients.forEach(recipeIng => {
        const globalIng = props.globalIngredients.find(g => g.id === recipeIng.ingredientId);
        if (globalIng && globalIng.presentationSize > 0) {
            const costPerBaseUnit = globalIng.cost / globalIng.presentationSize;
            const ingredientCostForRecipe = costPerBaseUnit * recipeIng.quantity;
            calculatedTotalIngredientCost += ingredientCostForRecipe;
            calculatedIngredientCosts[recipeIng.ingredientId] = ingredientCostForRecipe;
        } else {
            calculatedIngredientCosts[recipeIng.ingredientId] = 0;
        }
    });

    const packagingCostPerBatch = Number(editableRecipe.value.packagingCostPerBatch || 0);
    const laborCostPerBatch = Number(editableRecipe.value.laborCostPerBatch || 0);
    const itemsPerBatch = Number(editableRecipe.value.itemsPerBatch || 1);
    const profitMarginPercent = Number(editableRecipe.value.profitMarginPercent || 0);
    const lossBufferPercent = Number(editableRecipe.value.lossBufferPercent || 0);

    const currentRecipeOnlyCost = calculatedTotalIngredientCost + packagingCostPerBatch;
    const currentLaborCostPerIndividualItem = itemsPerBatch > 0 ? laborCostPerBatch / itemsPerBatch : 0;
    const currentBaseCostPerIndividualItem = itemsPerBatch > 0 ? currentRecipeOnlyCost / itemsPerBatch : 0;
    const currentTotalCostPerIndividualItem = currentBaseCostPerIndividualItem + currentLaborCostPerIndividualItem;
    const currentSellingPrice = currentTotalCostPerIndividualItem * (1 + profitMarginPercent / 100);
    const currentFinalPrice = currentSellingPrice * (1 + lossBufferPercent / 100);

    return {
        totalIngredientCost: calculatedTotalIngredientCost,
        recipeOnlyCost: currentRecipeOnlyCost,
        laborCostPerIndividualItem: currentLaborCostPerIndividualItem,
        baseCostPerIndividualItem: currentBaseCostPerIndividualItem,
        totalCostPerIndividualItem: currentTotalCostPerIndividualItem,
        sellingPrice: currentSellingPrice,
        finalPrice: currentFinalPrice,
        ingredientCosts: calculatedIngredientCosts
    };
});


// --- Funciones del Modal ---
function closeModal() {
    emit('close');
}

function saveChanges() {
    if (!editableRecipe.value) {
        console.error("EditRecipeModal: No hay receta para guardar.");
        return;
    }
    if (editableRecipe.value.itemsPerBatch <= 0) {
        alert("El número de items por batch debe ser mayor a cero.");
        return;
    }
    if (!editableRecipe.value.name.trim()) {
        alert("El nombre de la receta no puede estar vacío.");
        return;
    }
    if (editableRecipe.value.packagingCostPerBatch === null || editableRecipe.value.laborCostPerBatch === null || editableRecipe.value.profitMarginPercent === null || editableRecipe.value.lossBufferPercent === null) {
        alert("Por favor, completa todos los campos numéricos de costos y márgenes.");
        return;
    }
    if (editableRecipe.value.packagingCostPerBatch < 0 || editableRecipe.value.laborCostPerBatch < 0 || editableRecipe.value.profitMarginPercent < 0 || editableRecipe.value.lossBufferPercent < 0) {
        alert("Los valores de costos y márgenes no pueden ser negativos.");
        return;
    }

    if (editableRecipe.value && calculatedCosts.value) {
        const laborCostForBatch = Number(editableRecipe.value.laborCostPerBatch || 0);
        // "Costo Total por Receta (Ingr. + Emp. por Lote)"
        editableRecipe.value.calculatedRecipeOnlyCost = calculatedCosts.value.recipeOnlyCost; // NUEVO CAMPO GUARDADO

        // "Costo Mano de Obra (por Lote)" ya está en editableRecipe.value.laborCostPerBatch

        // "Costo Total del Lote (Ingr. + Emp. + M.O.)"
        editableRecipe.value.calculatedTotalBatchCostAllIncluded = calculatedCosts.value.recipeOnlyCost + laborCostForBatch; // RENOMBRADO PARA CLARIDAD

        // "Precio Final por Item"
        editableRecipe.value.calculatedFinalPrice = calculatedCosts.value.finalPrice;
    }

    emit('save', { ...editableRecipe.value });
    closeModal();
}

</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show && editableRecipe"
            class="fixed inset-0 bg-black/80 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-4">
            <div class="modal-content relative mx-auto p-6 border border-neutral-300 w-full max-w-4xl shadow-lg rounded-md bg-contrast
                       dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4
                            dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800
                               dark:text-dark-primary-200">Editar Receta: {{ editableRecipe.name }}</h3>
                    <button @click="closeModal" class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
                               dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <div class="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
                    <div>
                        <label for="recipe-name" class="block text-sm font-medium text-text-base
                                                            dark:text-dark-text-base">Nombre de la
                            Receta:</label>
                        <input type="text" id="recipe-name" v-model="editableRecipe.name" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                    </div>

                    <div class="border border-neutral-300 rounded-md p-4
                                 dark:border-dark-neutral-700">
                        <h4 class="text-lg font-medium mb-3 text-primary-700
                                   dark:text-dark-primary-300">Ingredientes de la Receta</h4>

                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 p-3 bg-neutral-100 rounded
                                    dark:bg-dark-neutral-800">
                            <div>
                                <label for="select-ingredient" class="block text-sm font-medium text-text-base
                                           dark:text-dark-text-base">Ingrediente:</label>
                                <Multiselect id="select-ingredient" v-model="selectedIngredientId"
                                    :options="globalIngredients" :searchable="true" valueProp="id" label="name"
                                    trackBy="name" :clearOnSelect="true" :closeOnSelect="true" placeholder="Buscar..."
                                    noOptionsText="Lista vacía o no encontrada"
                                    noResultsText="No se encontraron ingredientes" :disabled="editIngredientId !== null"
                                    :classes="{
                                        container: 'relative mx-auto w-full flex items-center justify-end box-border cursor-pointer border border-neutral-300 rounded-md bg-contrast text-base leading-snug outline-none mt-1 dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                        containerActive: 'ring-2 ring-accent-500/50 border-accent-500 dark:ring-dark-accent-400/50 dark:border-dark-accent-400',
                                        singleLabelText: 'overflow-ellipsis overflow-hidden block whitespace-nowrap max-w-full text-text-base dark:text-dark-text-base',
                                        placeholder: 'flex items-center h-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 text-text-muted dark:text-dark-text-muted',
                                        dropdown: 'absolute -left-px -right-px bottom-0 transform translate-y-full border border-neutral-300 -mt-px overflow-y-auto z-50 bg-contrast flex flex-col rounded-b-md dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                        dropdownHidden: 'hidden',
                                        option: 'flex items-center justify-start box-border text-left cursor-pointer text-base leading-snug py-2 px-3 text-text-base dark:text-dark-text-base',
                                        optionPointed: 'text-neutral-800 bg-neutral-200 dark:text-dark-neutral-100 dark:bg-dark-neutral-700',
                                        optionSelected: 'text-accent-700 bg-accent-100 dark:text-dark-accent-100 dark:bg-dark-accent-600',
                                        optionDisabled: 'text-neutral-400 cursor-not-allowed dark:text-dark-neutral-500',
                                        noOptions: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                        noResults: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                        search: 'w-full absolute inset-0 outline-none focus:ring-0 appearance-none box-border border-0 text-base font-sans bg-white dark:bg-dark-contrast rounded pl-3.5 rtl:pl-0 rtl:pr-3.5',
                                    }">
                                    <template #option="{ option }">
                                        <div>{{ option.name }}</div>
                                        <div class="text-xs text-text-muted dark:text-dark-text-muted ml-2">
                                            ({{ formatCurrency(option.cost) }} / {{ option.presentationSize }} {{
                                                option.unit }})
                                        </div>
                                    </template>
                                </Multiselect>
                            </div>
                            <div>
                                <label for="ingredient-qty" class="block text-sm font-medium text-text-base
                                                              dark:text-dark-text-base">Cantidad (en Receta):</label>
                                <input type="number" id="ingredient-qty" v-model.number="newIngredientQuantity"
                                    min="0.01" step="any" placeholder="Ej: 125" class="mt-1 block w-full px-3 bg-contrast py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                                <span class="text-xs text-text-muted
                                             dark:text-dark-text-muted">Usar misma unidad base (Gr, Ml, Uni)</span>
                            </div>

                            <div class="flex items-center">
                                <div class="flex items-center space-x-2 w-full">
                                    <button @click.prevent="saveRecipeIngredient"
                                        :class="[editIngredientId ? 'bg-accent-500 hover:bg-accent-600 focus:ring-accent-500 dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400' : 'bg-secondary-500 hover:bg-secondary-600 focus:ring-secondary-500 dark:bg-dark-secondary-600 dark:hover:bg-dark-secondary-700 dark:focus:ring-dark-secondary-600']"
                                        class="w-full px-4 py-2 text-white font-medium rounded-md shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 dark:text-dark-text-base dark:focus:ring-offset-dark-neutral-800">
                                        {{ editIngredientId ? 'Actualizar' : 'Añadir' }}
                                    </button>

                                    <button v-if="editIngredientId" @click.prevent="clearForm"
                                        class="w-auto px-4 py-2 bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400
                                               dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div v-if="editableRecipe.ingredients.length === 0" class="text-text-muted text-sm
                                    dark:text-dark-text-muted">
                            No hay ingredientes añadidos a esta receta.
                        </div>
                        <ul v-else class="space-y-2">
                            <li v-for="recipeIng in editableRecipe.ingredients" :key="recipeIng.ingredientId" class="flex justify-between items-center border-b border-neutral-200 pb-1 text-sm
                                       dark:border-dark-neutral-700">
                                <template v-if="getIngredientDetails(recipeIng)">
                                    <span>
                                        <span class="font-medium text-text-base
                                                     dark:text-dark-text-base">{{ getIngredientDetails(recipeIng).name
                                                    }}</span>
                                        - {{ recipeIng.quantity }} {{ getIngredientDetails(recipeIng).unit }}
                                        <span class="text-text-muted ml-2
                                                     dark:text-dark-text-muted">
                                            (Costo: {{
                                                formatCurrency(calculatedCosts.ingredientCosts[recipeIng.ingredientId] || 0)
                                            }})
                                        </span>
                                    </span>

                                    <div class="flex items-center space-x-2 flex-shrink-0">
                                        <button @click="startEdit(recipeIng)" class="bg-secondary-600 text-white px-2 py-1 rounded hover:bg-secondary-700 text-xs transition-all font-medium
                                                   dark:bg-dark-secondary-500 dark:hover:bg-dark-secondary-600">
                                            Editar
                                        </button>
                                        <button @click="removeRecipeIngredient(recipeIng.ingredientId)"
                                            class="bg-danger-600 text-white px-2 py-1 rounded hover:bg-danger-700 text-xs transition-all font-medium
                                                     dark:bg-danger-700 dark:text-dark-text-base dark:hover:bg-danger-800">
                                            Quitar
                                        </button>
                                    </div>

                                </template>
                                <span v-else class="text-danger-600 text-xs
                                                 dark:text-danger-400">Error: Ingrediente no encontrado (ID: {{
                                                    recipeIng.ingredientId }})</span>
                            </li>
                            <li class="font-semibold text-right mt-2 text-text-base border-t border-neutral-200 pt-1
                                       dark:text-dark-text-base dark:border-dark-neutral-700">
                                Costo Total Ingredientes: {{ formatCurrency(calculatedCosts.totalIngredientCost) }}
                            </li>
                        </ul>
                    </div>

                    <div class="border border-neutral-300 rounded-md p-4
                                dark:border-dark-neutral-700">
                        <h4 class="text-lg font-medium mb-3 text-primary-700
                                   dark:text-dark-primary-300">Otros Costos, Producción y Márgenes</h4>
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                            <div>
                                <label for="packaging-cost" class="block text-sm font-medium text-text-base
                                                                 dark:text-dark-text-base">Costo Empaque (por Lote
                                    $):</label>
                                <input type="number" id="packaging-cost"
                                    v-model.number="editableRecipe.packagingCostPerBatch" min="0" step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                            <div>
                                <label for="labor-cost" class="block text-sm font-medium text-text-base
                                                               dark:text-dark-text-base">Mano de Obra (por Lote
                                    $):</label>
                                <input type="number" id="labor-cost" v-model.number="editableRecipe.laborCostPerBatch"
                                    min="0" step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                            <div>
                                <label for="items-batch" class="block text-sm font-medium text-text-base
                                                               dark:text-dark-text-base">Items por Lote:</label>
                                <input type="number" id="items-batch" v-model.number="editableRecipe.itemsPerBatch"
                                    required min="1" step="1" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                            <div>
                                <label for="profit-margin" class="block text-sm font-medium text-text-base
                                                               dark:text-dark-text-base">M. Ganancia (%):</label>
                                <input type="number" id="profit-margin"
                                    v-model.number="editableRecipe.profitMarginPercent" min="0" step="0.1" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                            <div>
                                <label for="loss-buffer" class="block text-sm font-medium text-text-base
                                                               dark:text-dark-text-base">M. Pérdida (%):</label>
                                <input type="number" id="loss-buffer" v-model.number="editableRecipe.lossBufferPercent"
                                    min="0" step="0.1" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                        </div>
                    </div>

                    <div class="border border-neutral-300 rounded-md p-4 bg-secondary-100
                                 dark:border-dark-neutral-700 dark:bg-dark-secondary-950">
                        <h4 class="text-lg font-medium mb-3 text-primary-700
                                   dark:text-dark-primary-200">Resumen Financiero Sugerido</h4>
                        <div class="space-y-1 text-sm text-text-base
                                     dark:text-dark-text-base">

                            <p>Costo Total Ingredientes (por Lote): <span class="font-semibold">{{
                                formatCurrency(calculatedCosts.totalIngredientCost)
                                    }}</span></p>
                            <p>Costo Total Empaque (por Lote): <span class="font-semibold">{{
                                formatCurrency(editableRecipe.packagingCostPerBatch || 0)
                                    }}</span></p>
                            <p>Costo Total Mano de Obra (por Lote): <span class="font-semibold">{{
                                formatCurrency(editableRecipe.laborCostPerBatch || 0) }}</span></p>

                            <p class="border-t border-neutral-200 pt-1 mt-1
                                       dark:border-dark-neutral-700">
                                <strong>Costo Total por Receta (Ingr. + Emp. por Lote):</strong>
                                <span class="font-semibold">{{ formatCurrency(calculatedCosts.recipeOnlyCost) }}</span>
                            </p>

                            <hr class="my-2 border-neutral-200 dark:border-dark-neutral-700">

                            <p>Costo Mano de Obra por Item Individual: <span class="font-semibold">{{
                                formatCurrency(calculatedCosts.laborCostPerIndividualItem)
                                    }}</span></p>

                            <p>Costo Base por Item Individual (Ingr. + Emp.): <span class="font-semibold">{{
                                formatCurrency(calculatedCosts.baseCostPerIndividualItem)
                                    }}</span></p>

                            <p class="text-text-muted dark:text-dark-text-muted">
                                (Costo Total Unitario para PVP: <span class="font-semibold">{{
                                    formatCurrency(calculatedCosts.totalCostPerIndividualItem) }}</span>)
                            </p>

                            <p>+ Margen Ganancia ({{ editableRecipe.profitMarginPercent || 0 }}%): <span
                                    class="font-semibold">{{
                                        formatCurrency(calculatedCosts.sellingPrice) }}</span> (PVP Sugerido)</p>
                            <p>+ Margen Pérdida/Buffer ({{ editableRecipe.lossBufferPercent || 0 }}%): <span class="font-bold text-lg text-primary-800
                                                dark:text-dark-primary-200">{{
                                                    formatCurrency(calculatedCosts.finalPrice)
                                                }}</span> (Precio Final)</p>
                        </div>
                    </div>
                </div>
                <div class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3
                            dark:border-dark-neutral-700">
                    <button @click="closeModal" class="cursor-pointer px-4 py-2 bg-neutral-300 transition-all text-text-base rounded-md hover:bg-neutral-400
                               dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                        Cancelar
                    </button>
                    <button @click="saveChanges"
                        class="cursor-pointer px-4 py-2 bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
                               dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                        Guardar Cambios
                    </button>
                </div>
            </div>
        </div>
    </Transition>
</template>