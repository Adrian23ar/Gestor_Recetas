<script setup>
import { ref, watch, computed } from 'vue';
import { useUserData } from '../composables/useUserData.js';
import { useToast } from "vue-toastification";
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditIngredientModal from '../components/EditIngredientModal.vue';
import IngredientsTable from '../components/IngredientsTable.vue';
import EditStockModal from '../components/EditStockModal.vue';


// --- State ---
const { globalIngredients, dataLoading, dataError, addIngredient, deleteIngredient, saveIngredient } = useUserData();
const newIngredient = ref({
    name: '',
    cost: null,
    presentationSize: null,
    unit: 'Gr',
    initialStock: null // <-- NUEVO campo para el formulario
});
// --- NUEVO: Estado para modal de añadir stock ---
const showEditStockModal = ref(false);
const ingredientToEditStock = ref(null);

const units = ['Gr', 'Kg', 'Ml', 'L', 'Uni'];
const showConfirmDeleteIngredientModal = ref(false);
const ingredientToDeleteId = ref(null);
const showEditIngredientModal = ref(false);
const editingIngredient = ref(null);
const toast = useToast();


// Watch for data errors and show a toast
watch(dataError, (errorMsg) => {
    if (errorMsg) {
        toast.error(errorMsg);
    }
});

const selectedIngredientName = computed(() => {
    if (!ingredientToDeleteId.value) {
        return '';
    }
    const ingredient = globalIngredients.value.find(
        (ing) => ing.id === ingredientToDeleteId.value
    );
    return ingredient ? ingredient.name : 'este ingrediente';
});

function getStockLevel(ingredient) {
    const currentStock = Number(ingredient.currentStock) || 0;
    const presentationSize = Number(ingredient.presentationSize) || 0;

    if (presentationSize <= 0) {
        return 'unknown';
    }

    const percentage = (currentStock / presentationSize) * 100;

    if (percentage <= 25) {
        return 'low';
    }
    if (percentage <= 60) {
        return 'medium';
    }
    return 'high';
}

const totalIngredientCount = computed(
    () => globalIngredients.value.length
);

const lowStockCount = computed(() =>
    globalIngredients.value.filter((ing) => getStockLevel(ing) === 'low').length
);

const mediumStockCount = computed(() =>
    globalIngredients.value.filter((ing) => getStockLevel(ing) === 'medium').length
);

const highStockCount = computed(() =>
    globalIngredients.value.filter((ing) => getStockLevel(ing) === 'high').length
);

const unknownStockCount = computed(() =>
    globalIngredients.value.filter((ing) => getStockLevel(ing) === 'unknown').length
);

// --- Funciones ---

// Función para añadir un ingrediente
async function handleAddIngredient() {
    if (!newIngredient.value.name || newIngredient.value.cost === null || newIngredient.value.presentationSize === null) {
        toast.warning('Por favor, completa todos los campos del ingrediente.');
        return;
    }
    if (newIngredient.value.cost <= 0 || newIngredient.value.presentationSize <= 0) {
        toast.warning('El costo y el tamaño deben ser mayores a cero.');
        return;
    }

    const tempId = Date.now().toString();
    // Obtén el valor inicial y asegúrate de que sea un número (o 0 si está vacío/nulo)
    const initialStockValue = Number(newIngredient.value.initialStock) || 0;
    const tempIngredient = {
        id: tempId,
        name: newIngredient.value.name.trim(),
        cost: Number(newIngredient.value.cost),
        presentationSize: Number(newIngredient.value.presentationSize),
        unit: newIngredient.value.unit,
        initialStock: initialStockValue,
        // *** AÑADE ESTA LÍNEA ***
        currentStock: initialStockValue // Asegura que currentStock exista para DataTables
    };

    // Actualización optimista del estado local
    globalIngredients.value.push(tempIngredient);

    try {
        const success = await addIngredient(tempIngredient);
        if (success) {
            toast.success(`Ingrediente '${tempIngredient.name}' añadido exitosamente.`);
            newIngredient.value = { name: '', cost: null, presentationSize: null, unit: 'Gr', initialStock: null };
        } else {
            // Si addIngredient devuelve false (indicando fallo), revierte la adición optimista
            const indexToRemove = globalIngredients.value.findIndex(ing => ing.id === tempId);
            if (indexToRemove !== -1) {
                globalIngredients.value.splice(indexToRemove, 1);
            }
            // Ya no necesitas mostrar el toast de error aquí si addIngredient ya lo hizo
            // toast.error("No se pudo añadir el ingrediente (falló la persistencia).");
        }
    } catch (error) {
        console.error("Error al añadir ingrediente:", error);
        toast.error("No se pudo añadir el ingrediente. Inténtalo de nuevo.");
        // Revierte la adición optimista en caso de error
        const indexToRemove = globalIngredients.value.findIndex(ing => ing.id === tempId);
        if (indexToRemove !== -1) {
            globalIngredients.value.splice(indexToRemove, 1);
        }
    }
}

// Function to trigger the modal for deletion
function handleDeleteIngredient(ingredientId) {
    ingredientToDeleteId.value = ingredientId;
    showConfirmDeleteIngredientModal.value = true;
}

// Function called when the user confirms deletion in the modal
async function confirmIngredientDeletion() {
    if (ingredientToDeleteId.value) {
        const idToDelete = ingredientToDeleteId.value;
        const nameToDelete = selectedIngredientName.value;

        showConfirmDeleteIngredientModal.value = false;
        ingredientToDeleteId.value = null;

        try {
            await deleteIngredient(idToDelete);
            toast.success(`Ingrediente '${nameToDelete}' eliminado exitosamente.`);
        } catch (error) {
            console.error("IngredientsView: Error during ingredient deletion:", error);
        }
    }
}

// Function called when the user cancels deletion or closes the modal
function cancelIngredientDeletion() {
    showConfirmDeleteIngredientModal.value = false;
    ingredientToDeleteId.value = null;
}

// --- New Functions for Edit Ingredient Modal ---

// Function to open the edit modal
function handleEditIngredient(ingredient) {
    editingIngredient.value = ingredient;
    showEditIngredientModal.value = true;
}

// Function to close the edit modal
function handleCloseEditModal() {
    showEditIngredientModal.value = false;
    editingIngredient.value = null;
}

// Function called when the user saves changes in the edit modal
async function handleSaveIngredient(updatedIngredient) {
    if (!updatedIngredient.name || updatedIngredient.cost === null || updatedIngredient.presentationSize === null) {
        toast.warning('Por favor, completa todos los campos antes de guardar.');
        return;
    }
    if (updatedIngredient.cost <= 0 || updatedIngredient.presentationSize <= 0) {
        toast.warning('El costo y el tamaño deben ser mayores a cero.');
        return;
    }

    await saveIngredient(updatedIngredient);

    toast.success(`Ingrediente '${updatedIngredient.name}' actualizado exitosamente.`);

    handleCloseEditModal();
}

function handleOpenEditStockModal(ingredientId) { // Renombrada
    const ingredient = globalIngredients.value.find(ing => ing.id === ingredientId);
    if (ingredient) {
        ingredientToEditStock.value = ingredient; // Renombrada variable
        showEditStockModal.value = true;          // Renombrada variable
    } else {
        toast.error("No se encontró el ingrediente para editar stock.");
    }
}

function handleCloseEditStockModal() { // Renombrada
    showEditStockModal.value = false;
    ingredientToEditStock.value = null; // Renombrada variable
}

async function handleUpdateStock(newTotalStock) { // Renombrada y lógica cambiada
    if (!ingredientToEditStock.value || newTotalStock === null || newTotalStock < 0) {
        toast.warning("Valor de stock inválido.");
        return;
    }

    const originalIngredient = ingredientToEditStock.value;

    const updatedIngredient = {
        ...originalIngredient,
        currentStock: Number(newTotalStock) // Establecer el nuevo valor total
    };

    const success = await saveIngredient(updatedIngredient);

    if (success) {
        toast.success(`Stock de '${originalIngredient.name}' actualizado a ${newTotalStock} ${originalIngredient.unit}.`);
    } else {
        toast.error(`Error al actualizar stock de '${originalIngredient.name}'.`);
    }
    handleCloseEditStockModal(); // Cerrar el modal
}
// --- Fin Funciones Editar Stock ---
3
function formatCurrency(value) {
    const num = Number(value);
    if (isNaN(num)) {
        return '$0.00';
    }
    return `$${num.toFixed(2)}`;
}
</script>

<template>
    <div class="space-y-8 mt-4">
        <div class="bg-contrast p-6 rounded-lg shadow-md
                    dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl font-semibold mb-4 text-primary-800
                       dark:text-dark-primary-200">Añadir Nuevo Ingrediente</h2>
            <form ref="ingredientForm" @submit.prevent="handleAddIngredient" class="space-y-4">
                <div>
                    <label for="ing-name" class="block text-sm font-medium text-text-base
                                                dark:text-dark-text-base">Nombre:</label>
                    <input type="text" id="ing-name" v-model="newIngredient.name" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                               dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                               dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label for="ing-cost" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Costo Presentación
                            ($):</label>
                        <input type="number" id="ing-cost" v-model.number="newIngredient.cost" required min="0.01"
                            step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="ing-size" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Tamaño
                            Presentación:</label>
                        <input type="number" id="ing-size" v-model.number="newIngredient.presentationSize" required
                            min="0.01" step="any" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="ing-unit" class="block text-sm font-medium text-text-base
                                                    dark:text-dark-text-base">Unidad:</label>
                        <select id="ing-unit" v-model="newIngredient.unit" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 bg-contrast rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400">
                            <option v-for="unit in units" :key="unit" :value="unit">{{ unit }}</option>
                        </select>
                    </div>
                </div>
                <div>
                    <label for="ing-initial-stock"
                        class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                        Stock Inicial (Opcional):
                    </label>
                    <input type="number" id="ing-initial-stock" v-model.number="newIngredient.initialStock" min="0"
                        step="any" placeholder="Ej: 1000" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                                   dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                                   dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">
                        Cantidad actual que tienes de este ingrediente (en la 'Unidad' seleccionada). Si se deja vacío,
                        será 0.
                    </p>
                </div>
                <div class="text-right">
                    <button type="submit"
                        class="px-4 py-2 transition-all cursor-pointer bg-accent-500 text-white font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
                               dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background">
                        Añadir Ingrediente
                    </button>
                </div>
            </form>
        </div>
        <div class="bg-contrast p-6 rounded-lg shadow-md dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Resumen de Inventario
            </h2>
            <div v-if="dataLoading" class="text-text-muted dark:text-dark-text-muted italic">Cargando resumen...</div>
            <div v-else-if="dataError" class="text-danger-600 dark:text-danger-400">Error al cargar datos.</div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                    <span class="block text-2xl font-bold text-primary-700 dark:text-dark-primary-300">{{
                        totalIngredientCount }}</span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Total Ingredientes</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-success-600 dark:text-success-400">{{ highStockCount
                        }}</span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Stock Alto (&gt;60%)</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-warning-600 dark:text-warning-400">{{ mediumStockCount
                        }}</span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Stock Medio (26-60%)</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-danger-600 dark:text-danger-400">{{ lowStockCount
                        }}</span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Stock Bajo (&lt;=25%)</span>
                </div>
                <div v-if="unknownStockCount > 0"
                    class="col-span-2 sm:col-span-4 text-xs text-neutral-500 dark:text-dark-neutral-400">
                    ({{ unknownStockCount }} ingredientes con nivel desconocido por falta de tamaño de presentación)
                </div>
            </div>
        </div>
        <div class="bg-contrast p-0 rounded-lg shadow-md dark:bg-dark-contrast dark:shadow-lg overflow-hidden">
            <h2 class="text-xl font-semibold mb-0 px-6 pt-6 pb-4 text-primary-800 dark:text-dark-primary-200">
                Ingredientes Guardados</h2>

            <div v-if="dataLoading" class="text-center py-10 text-text-muted dark:text-dark-text-muted"> Cargando
                datos... </div>
            <div v-else-if="dataError && !dataLoading"
                class="text-center py-10 text-danger-600 font-medium dark:text-danger-400"> Error al cargar
                ingredientes: {{ dataError }} </div>
            <div v-else-if="globalIngredients.length === 0"
                class="text-center py-10 text-text-muted dark:text-dark-text-muted"> No hay ingredientes guardados.
            </div>
            <IngredientsTable v-if="!dataLoading && !dataError && globalIngredients.length > 0"
                :ingredients="globalIngredients" @edit-ingredient="handleEditIngredient"
                @delete-ingredient="handleDeleteIngredient" @edit-stock-click="handleOpenEditStockModal" class="p-0" />
        </div>

        <ConfirmationModal :show="showConfirmDeleteIngredientModal" title="Confirmar Eliminación de Ingrediente"
            :message="`¿Estás seguro de que deseas eliminar el ingrediente '${selectedIngredientName}'? Esta acción podría afectar recetas existentes.`"
            confirmButtonText="Sí, Eliminar"
            confirmButtonClass="bg-danger-600 hover:bg-danger-700 focus:ring-danger-500 dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base"
            @close="cancelIngredientDeletion" @confirm="confirmIngredientDeletion" />

        <EditIngredientModal :show="showEditIngredientModal" :ingredient="editingIngredient"
            @close="handleCloseEditModal" @save="handleSaveIngredient" />

        <EditStockModal :show="showEditStockModal" :ingredient="ingredientToEditStock"
            @close="handleCloseEditStockModal" @save="handleUpdateStock" />
    </div>
</template>