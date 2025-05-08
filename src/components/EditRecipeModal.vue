<script setup>
import { ref, computed, watch } from 'vue';
import Multiselect from '@vueform/multiselect';

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
// Creamos una copia profunda reactiva de la receta para editarla sin afectar la original hasta guardar.
const editableRecipe = ref(null);
// Estado para el selector de ingredientes
const selectedIngredientId = ref('');
const newIngredientQuantity = ref(null);

// Observamos cambios en la prop 'recipe' para inicializar/reiniciar el estado editable
watch(() => props.recipe, (newRecipe) => {
    if (newRecipe) {
        editableRecipe.value = JSON.parse(JSON.stringify(newRecipe));
        // Asegurar valores numéricos y añadir defaults para nuevos campos si no existen
        editableRecipe.value.packagingCostPerBatch = Number(editableRecipe.value.packagingCostPerBatch) || 0;
        editableRecipe.value.laborCostPerBatch = Number(editableRecipe.value.laborCostPerBatch) || 0;
        editableRecipe.value.itemsPerBatch = Number(editableRecipe.value.itemsPerBatch) || 1;
        editableRecipe.value.profitMarginPercent = Number(editableRecipe.value.profitMarginPercent) || 0; // Default 0%
        editableRecipe.value.lossBufferPercent = Number(editableRecipe.value.lossBufferPercent) || 0;     // Default 0%
        if (!Array.isArray(editableRecipe.value.ingredients)) {
            editableRecipe.value.ingredients = [];
        }
    } else {
        editableRecipe.value = null;
    }
}, { immediate: true }); // immediate: true para ejecutar al montar

// --- Lógica de Ingredientes de la Receta ---
function addRecipeIngredient() {
    if (!selectedIngredientId.value || newIngredientQuantity.value === null || newIngredientQuantity.value <= 0) {
        alert('Selecciona un ingrediente y especifica una cantidad válida mayor a cero.');
        return;
    }
    // Evitar duplicados (opcional, podrías permitir añadir el mismo ingrediente varias veces si tiene sentido)
    const existing = editableRecipe.value.ingredients.find(ing => ing.ingredientId === selectedIngredientId.value);
    if (existing) {
        alert('Este ingrediente ya está en la receta. Puedes modificar su cantidad o eliminarlo.');
        return;
    }

    editableRecipe.value.ingredients.push({
        ingredientId: selectedIngredientId.value,
        quantity: parseFloat(newIngredientQuantity.value),
    });

    // Resetear campos del formulario de añadir ingrediente
    selectedIngredientId.value = '';
    newIngredientQuantity.value = null;
}

function removeRecipeIngredient(ingredientIdToRemove) {
    editableRecipe.value.ingredients = editableRecipe.value.ingredients.filter(
        (ing) => ing.ingredientId !== ingredientIdToRemove
    );
}

// Obtener detalles completos de un ingrediente de la receta para mostrar
function getIngredientDetails(recipeIngredient) {
    const global = props.globalIngredients.find(g => g.id === recipeIngredient.ingredientId);
    return global ? { ...global, quantityInRecipe: recipeIngredient.quantity } : null;
}

// --- Cálculos Reactivos de Costos (Computed Properties) ---
const calculatedCosts = computed(() => {
    const defaults = { totalIngredientCost: 0, totalBatchCost: 0, costPerItem: 0, sellingPrice: 0, finalPrice: 0, ingredientCosts: {} };
    if (!editableRecipe.value || !props.globalIngredients) {
        return defaults;
    }

    let totalIngredientCost = 0;
    const ingredientCosts = {};

    editableRecipe.value.ingredients.forEach(recipeIng => {
        const globalIng = props.globalIngredients.find(g => g.id === recipeIng.ingredientId);
        if (globalIng && globalIng.presentationSize > 0) {
            const costPerBaseUnit = globalIng.cost / globalIng.presentationSize;
            const ingredientCost = costPerBaseUnit * recipeIng.quantity;
            totalIngredientCost += ingredientCost;
            ingredientCosts[recipeIng.ingredientId] = ingredientCost;
        } else {
            // If ingredient not found or presentation size is 0, treat its cost contribution as 0
            ingredientCosts[recipeIng.ingredientId] = 0;
        }
    });

    const packagingCost = Number(editableRecipe.value.packagingCostPerBatch || 0);
    const laborCost = Number(editableRecipe.value.laborCostPerBatch || 0);
    const itemsPerBatch = Number(editableRecipe.value.itemsPerBatch || 1);
    const profitMargin = Number(editableRecipe.value.profitMarginPercent || 0);
    const lossBuffer = Number(editableRecipe.value.lossBufferPercent || 0);

    const totalBatchCost = totalIngredientCost + packagingCost + laborCost;
    const costPerItem = itemsPerBatch > 0 ? totalBatchCost / itemsPerBatch : 0;

    // Calcular Precio de Venta (costo + ganancia)
    const sellingPrice = costPerItem * (1 + profitMargin / 100);

    // Calcular Precio Final (precio de venta + margen de pérdida/buffer)
    const finalPrice = sellingPrice * (1 + lossBuffer / 100);

    return {
        totalIngredientCost,    // Sumatoria de costos individuales de los ingredientes (ingredientCosts)
        totalBatchCost, // Es el monto total de la receta
        costPerItem,    // Es el costo de cada item que sale de la receta
        sellingPrice,   // Es el precio sugerido, que es el costo de cada item + el % de ganancia
        finalPrice,     // Es el precio final, que es el precio sugerido + el % de pérdida/buffer
        ingredientCosts // Es un objeto que contiene los costos individuales de cada ingrediente
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
    // Basic validation for costs and margins
    if (editableRecipe.value.packagingCostPerBatch === null || editableRecipe.value.laborCostPerBatch === null || editableRecipe.value.profitMarginPercent === null || editableRecipe.value.lossBufferPercent === null) {
        alert("Por favor, completa todos los campos numéricos de costos y márgenes.");
        return;
    }
    if (editableRecipe.value.packagingCostPerBatch < 0 || editableRecipe.value.laborCostPerBatch < 0 || editableRecipe.value.profitMarginPercent < 0 || editableRecipe.value.lossBufferPercent < 0) {
        alert("Los valores de costos y márgenes no pueden ser negativos.");
        return;
    }

    if (editableRecipe.value && calculatedCosts.value) {
         editableRecipe.value.calculatedTotalCost = calculatedCosts.value.totalBatchCost;
         editableRecipe.value.calculatedFinalPrice = calculatedCosts.value.finalPrice;
         // Puedes añadir costPerItem también si lo necesitas en otro lado
         // editableRecipe.value.calculatedCostPerItem = calculatedCosts.value.costPerItem;
    }


    // Emitimos el evento 'save' con la copia modificada de la receta
    emit('save', { ...editableRecipe.value });
    closeModal(); // Cerramos el modal después de guardar
}

// --- Helper para formato ---
function formatCurrency(value) {
    return `$${Number(value).toFixed(2)}`;
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
                                    noResultsText="No se encontraron ingredientes" :classes="{ /* Aquí puedes sobreescribir clases de Tailwind si es necesario */
                                        container: 'relative mx-auto w-full flex items-center justify-end box-border cursor-pointer border border-neutral-300 rounded-md bg-contrast text-base leading-snug outline-none mt-1 dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                        containerActive: 'ring-2 ring-accent-500/50 border-accent-500 dark:ring-dark-accent-400/50 dark:border-dark-accent-400', // Añadir anillo de foco
                                        singleLabelText: 'overflow-ellipsis overflow-hidden block whitespace-nowrap max-w-full text-text-base dark:text-dark-text-base',
                                        placeholder: 'flex items-center h-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 text-text-muted dark:text-dark-text-muted',
                                        dropdown: 'absolute -left-px -right-px bottom-0 transform translate-y-full border border-neutral-300 -mt-px overflow-y-auto z-50 bg-contrast flex flex-col rounded-b-md dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                        dropdownHidden: 'hidden',
                                        option: 'flex items-center justify-start box-border text-left cursor-pointer text-base leading-snug py-2 px-3 text-text-base dark:text-dark-text-base',
                                        optionPointed: 'text-neutral-800 bg-neutral-200 dark:text-dark-neutral-100 dark:bg-dark-neutral-700', // Hover/focused option
                                        optionSelected: 'text-accent-700 bg-accent-100 dark:text-dark-accent-100 dark:bg-dark-accent-600',
                                        optionDisabled: 'text-neutral-400 cursor-not-allowed dark:text-dark-neutral-500',
                                        noOptions: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                        noResults: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                        search: 'w-full absolute inset-0 outline-none focus:ring-0 appearance-none box-border border-0 text-base font-sans bg-white  dark:bg-dark-contrast rounded pl-3.5 rtl:pl-0 rtl:pr-3.5',

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
                                <button @click="addRecipeIngredient" class="w-full px-4 py-2 bg-secondary-500 text-white font-medium rounded-md shadow-sm transition-all hover:bg-secondary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary-500
                                           dark:bg-dark-secondary-600 dark:text-dark-text-base dark:hover:bg-dark-secondary-700
                                           dark:focus:ring-dark-secondary-600 dark:focus:ring-offset-dark-neutral-800">
                                    Añadir
                                </button>
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
                                    <button @click="removeRecipeIngredient(recipeIng.ingredientId)" class="bg-danger-600 text-white px-2 py-1 rounded hover:bg-danger-700 text-xs transition-all font-medium
                                               dark:bg-danger-700 dark:text-dark-text-base dark:hover:bg-danger-800">
                                        Quitar
                                    </button>
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
                                                               dark:text-dark-text-base">Costo Empaque ($):</label>
                                <input type="number" id="packaging-cost"
                                    v-model.number="editableRecipe.packagingCostPerBatch" min="0" step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                           dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                           dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            </div>
                            <div>
                                <label for="labor-cost" class="block text-sm font-medium text-text-base
                                                               dark:text-dark-text-base">Mano de Obra ($):</label>
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
                            <p>Costo Total Ingredientes: <span class="font-semibold">{{
                                formatCurrency(calculatedCosts.totalIngredientCost)
                                    }}</span></p>
                            <p>Costo Total Empaque: <span class="font-semibold">{{
                                formatCurrency(editableRecipe.packagingCostPerBatch || 0)
                                    }}</span></p>
                            <p>Costo Total Mano de Obra: <span class="font-semibold">{{
                                formatCurrency(editableRecipe.laborCostPerBatch ||
                                    0) }}</span></p>
                            <p class="border-t border-neutral-200 pt-1 mt-1
                                      dark:border-dark-neutral-700">Costo Total por Receta: <span
                                    class="font-semibold">{{
                                        formatCurrency(calculatedCosts.totalBatchCost) }}</span></p>
                            <hr class="my-2 border-neutral-200
                                       dark:border-dark-neutral-700">
                            <p>Costo Base por Item Individual: <span class="font-semibold">{{
                                formatCurrency(calculatedCosts.costPerItem)
                                    }}</span></p>
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