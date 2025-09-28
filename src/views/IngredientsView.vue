<script setup>
import { computed, ref, watch } from 'vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditIngredientModal from '../components/EditIngredientModal.vue';
import IngredientsTable from '../components/IngredientsTable.vue';
import EditStockModal from '../components/EditStockModal.vue';
import ErrorMessage from '../components/ErrorMessage.vue';

import { useIngredients } from '../composables/useIngredients.js';
import { useToast } from "vue-toastification";

const toast = useToast();

const {
    ingredients,
    confirmDelete,
    dataLoading,
    dataError,
    loading,
    error,

    showDeleteModal,
    ingredientToDelete,
    showEditModal,
    editingIngredient,
    showEditStockModal,
    editingStockIngredient,

    openDeleteModal,
    closeDeleteModal,
    openEditModal,
    closeEditModal,
    openEditStockModal,
    closeEditStockModal,

    addNewIngredient,
    saveIngredientChanges,
    saveStockChanges,
} = useIngredients();

const units = ['Gr', 'Kg', 'Ml', 'L', 'Uni'];

const newIngredient = ref({
    name: '',
    cost: null,
    presentationSize: null,
    unit: 'Gr',
    initialStock: null,
});

// Estado modal y control eliminación
const showConfirmDeleteIngredientModal = ref(false);
const ingredientToDeleteId = ref(null);

// Computed para mostrar el nombre del ingrediente en el modal
const selectedIngredientName = computed(() => {
    if (!ingredientToDeleteId.value) return '';
    const ingredient = ingredients.value.find(i => i.id === ingredientToDeleteId.value);
    return ingredient ? ingredient.name : '';
});

function resetNewIngredient() {
    newIngredient.value = {
        name: '',
        cost: null,
        presentationSize: null,
        unit: 'Gr',
        initialStock: null,
    };
}

watch(error, (val) => {
    if (val) toast.error('Error inesperado: ' + val.message || val);
});

async function handleAddIngredient() {
    if (!newIngredient.value.name || newIngredient.value.cost === null || newIngredient.value.presentationSize === null) {
        toast.warning('Por favor, completa todos los campos del ingrediente.');
        return;
    }
    if (newIngredient.value.cost <= 0 || newIngredient.value.presentationSize <= 0) {
        toast.warning('El costo y el tamaño deben ser mayores a cero.');
        return;
    }

    const toAdd = {
        ...newIngredient.value,
        currentStock: Number(newIngredient.value.initialStock) || 0,
    };

    const success = await addNewIngredient(toAdd);
    if (success) {
        resetNewIngredient();
    }
}

// Función para abrir modal y asignar ID a eliminar
function handleDeleteIngredient(id) {
    const ingredient = ingredients.value.find(i => i.id === id);
    if (!ingredient) {
        toast.error(`Ingrediente con ID ${id} no encontrado.`);
        return;
    }
    openDeleteModal(ingredient);  // sincroniza el ingrediente a eliminar
}


// Función para cancelar eliminación
function cancelIngredientDeletion() {
    showConfirmDeleteIngredientModal.value = false;
    ingredientToDeleteId.value = null;
}

// Función para confirmar y ejecutar eliminación
async function confirmIngredientDeletion() {
    if (!ingredientToDelete.value) {
        toast.error('No hay ingrediente seleccionado para eliminar.');
        return;
    }

    try {
        await confirmDelete();  // usa esta función para eliminar
    } catch (error) {
        toast.error('Error al eliminar ingrediente.');
        console.error(error);
    }
}


function handleEditIngredient(ingredient) {
    openEditModal(ingredient);
}

function handleCloseEditModal() {
    closeEditModal();
}

async function handleSaveIngredient(updatedIngredient) {
    await saveIngredientChanges(updatedIngredient);
}

// ** Corregido: Buscar ingrediente en la lista y abrir modal **
function handleEditStock(ingredientId) {
    const ingredient = ingredients.value.find(i => i.id === ingredientId);
    if (!ingredient) {
        toast.error("No se encontró el ingrediente para editar stock.");
        return;
    }
    openEditStockModal(ingredient);
}


function handleCloseEditStockModal() {
    closeEditStockModal();
}

async function handleSaveStock(newStockValue) {
    if (!editingStockIngredient.value) {
        toast.error("No se encontró el ingrediente para actualizar.");
        return;
    }

    const updatedIngredient = {
        ...editingStockIngredient.value,
        currentStock: Number(newStockValue),
    };

    const success = await saveStockChanges(updatedIngredient);
    if (success) {
        handleCloseEditStockModal();
    }
}

function getStockLevel(ingredient) {
    const currentStock = Number(ingredient.currentStock) || 0;
    const presentationSize = Number(ingredient.presentationSize) || 0;
    if (presentationSize <= 0) return 'unknown';
    const percentage = (currentStock / presentationSize) * 100;
    if (percentage <= 25) return 'low';
    if (percentage <= 60) return 'medium';
    return 'high';
}

const totalIngredientCount = computed(() => ingredients.value.length);
const lowStockCount = computed(() => ingredients.value.filter((i) => getStockLevel(i) === 'low').length);
const mediumStockCount = computed(() => ingredients.value.filter((i) => getStockLevel(i) === 'medium').length);
const highStockCount = computed(() => ingredients.value.filter((i) => getStockLevel(i) === 'high').length);
const unknownStockCount = computed(() => ingredients.value.filter((i) => getStockLevel(i) === 'unknown').length);


</script>

<template>
    <div class="space-y-8 mt-4">
        <div class="bg-contrast p-6 rounded-lg shadow-md dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">
                Añadir Nuevo Ingrediente
            </h2>
            <form @submit.prevent="handleAddIngredient" class="space-y-4">
                <div>
                    <label for="ing-name" class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                        Nombre:
                    </label>
                    <input id="ing-name" v-model="newIngredient.name" type="text" required class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
              dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
              dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                </div>
                <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                        <label for="ing-cost" class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                            Costo Presentación ($):
                        </label>
                        <input id="ing-cost" v-model.number="newIngredient.cost" type="number" required min="0.01"
                            step="0.01" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="ing-size" class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                            Tamaño Presentación:
                        </label>
                        <input id="ing-size" v-model.number="newIngredient.presentationSize" type="number" required
                            min="0.01" step="any" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                    <div>
                        <label for="ing-unit" class="block text-sm font-medium text-text-base dark:text-dark-text-base">
                            Unidad:
                        </label>
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
                    <input id="ing-initial-stock" v-model.number="newIngredient.initialStock" type="number" min="0"
                        step="any" placeholder="Ej: 1000" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
              dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
              dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    <p class="mt-1 text-xs text-text-muted dark:text-dark-text-muted">
                        Cantidad actual que tienes de este ingrediente (en la 'Unidad' seleccionada). Si se deja vacío,
                        será 0.
                    </p>
                </div>
                <div class="text-right">
                    <button type="submit" :disabled="loading"
                        class="px-4 py-2 transition-all cursor-pointer bg-accent-500 text-white font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
            dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background">
                        {{ loading ? 'Guardando...' : 'Añadir Ingrediente' }}
                    </button>
                </div>
            </form>
        </div>

        <div class="bg-contrast p-6 rounded-lg shadow-md dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Resumen de Inventario
            </h2>

            <div v-if="dataLoading" class="text-text-muted dark:text-dark-text-muted italic">Cargando resumen...</div>
            <div v-else-if="dataError" class="p-4">
                <ErrorMessage :message="`Error al cargar ingredientes: ${dataError}`" />
            </div>
            <div v-else class="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div>
                    <span class="block text-2xl font-bold text-primary-700 dark:text-dark-primary-300">
                        {{ totalIngredientCount }}
                    </span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Total Ingredientes</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-success-600 dark:text-success-400">
                        {{ highStockCount }}
                    </span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Stock Alto (&gt;60%)</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-warning-600 dark:text-warning-400">
                        {{ mediumStockCount }}
                    </span>
                    <span class="text-sm text-text-muted dark:text-dark-text-muted">Stock Medio (26-60%)</span>
                </div>
                <div>
                    <span class="block text-2xl font-bold text-danger-600 dark:text-danger-400">
                        {{ lowStockCount }}
                    </span>
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
                Ingredientes Guardados
            </h2>

            <div v-if="dataLoading" class="text-center py-10 text-text-muted dark:text-dark-text-muted">Cargando
                datos...</div>
            <div v-else-if="dataError && !dataLoading"
                class="text-center py-10 text-danger-600 font-medium dark:text-danger-400">
                Error al cargar ingredientes: {{ dataError }}
            </div>
            <div v-else-if="ingredients.length === 0"
                class="text-center py-10 text-text-muted dark:text-dark-text-muted">
                No hay ingredientes guardados.
            </div>
            <IngredientsTable v-if="!dataLoading && !dataError && ingredients.length > 0" :ingredients="ingredients"
                @edit-ingredient="handleEditIngredient" @delete-ingredient="handleDeleteIngredient"
                @edit-stock-click="handleEditStock" />
        </div>

        <ConfirmationModal :show="showDeleteModal" title="Confirmar Eliminación de Ingrediente"
            :message="`¿Estás seguro de que deseas eliminar el ingrediente '${ingredientToDelete?.name || ''}'? Esta acción podría afectar recetas existentes.`"
            confirmButtonText="Sí, Eliminar"
            confirmButtonClass="bg-danger-600 hover:bg-danger-700 focus:ring-danger-500 dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base"
            @close="closeDeleteModal" @confirm="confirmIngredientDeletion" />


        <EditIngredientModal :show="showEditModal" :ingredient="editingIngredient" @close="handleCloseEditModal"
            @save="handleSaveIngredient" />

        <EditStockModal :show="showEditStockModal" :ingredient="editingStockIngredient"
            @close="handleCloseEditStockModal" @save="handleSaveStock" />

    </div>
</template>
