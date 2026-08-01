<script setup>
import { computed, ref } from 'vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import IngredientModal from '../components/IngredientModal.vue';
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

    showDeleteModal,
    ingredientToDelete,
    showEditStockModal,
    editingStockIngredient,

    openDeleteModal,
    closeDeleteModal,
    openEditStockModal,
    closeEditStockModal,

    addNewIngredient,
    saveIngredientChanges,
    saveStockChanges,
} = useIngredients();

// --- Modal de alta/edición (fusiona el formulario inline + EditIngredientModal) ---
const showIngredientModal = ref(false);
const editingIngredient = ref(null); // null = alta

function openAddModal() {
    editingIngredient.value = null;
    showIngredientModal.value = true;
}

function openEditModal(ingredient) {
    editingIngredient.value = ingredient;
    showIngredientModal.value = true;
}

function closeIngredientModal() {
    showIngredientModal.value = false;
    editingIngredient.value = null;
}

async function handleSaveIngredient(payload) {
    const success = editingIngredient.value
        ? await saveIngredientChanges(payload)
        : await addNewIngredient(payload);
    if (success) closeIngredientModal();
}

function handleAdjustStockFromModal(ingredient) {
    closeIngredientModal();
    openEditStockModal(ingredient);
}

// --- Eliminar ---
function handleDeleteIngredient(id) {
    const ingredient = ingredients.value.find(i => i.id === id);
    if (!ingredient) {
        toast.error(`Ingrediente con ID ${id} no encontrado.`);
        return;
    }
    openDeleteModal(ingredient);
}

async function confirmIngredientDeletion() {
    if (!ingredientToDelete.value) {
        toast.error('No hay ingrediente seleccionado para eliminar.');
        return;
    }
    await confirmDelete();
}

// --- Stock ---
function handleEditStock(ingredientId) {
    const ingredient = ingredients.value.find(i => i.id === ingredientId);
    if (!ingredient) {
        toast.error("No se encontró el ingrediente para editar stock.");
        return;
    }
    openEditStockModal(ingredient);
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
    await saveStockChanges(updatedIngredient);
}

// --- Métricas ---
const totalIngredientCount = computed(() => ingredients.value.length);
const highStockCount = computed(() => ingredients.value.filter(i => i.stockStatus === 'high').length);
const mediumStockCount = computed(() => ingredients.value.filter(i => i.stockStatus === 'medium').length);
const lowStockCount = computed(() => ingredients.value.filter(i => i.stockStatus === 'low').length);
const unknownStockCount = computed(() => ingredients.value.filter(i => i.stockStatus === 'unknown').length);
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="ui-h1">Inventario</h1>
                <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {{ totalIngredientCount }} ingredientes registrados
                </p>
            </div>
            <button type="button" class="ui-btn-primary" @click="openAddModal">Nuevo ingrediente</button>
        </div>

        <ErrorMessage v-if="dataError" :message="`Error al cargar ingredientes: ${dataError}`" />

        <template v-else>
            <div class="grid gap-4" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));">
                <div class="ui-stat">
                    <p class="ui-label !mb-2">Total ingredientes</p>
                    <p class="text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-stone-800 dark:text-stone-100">
                        {{ totalIngredientCount }}
                    </p>
                </div>
                <div class="ui-stat">
                    <p class="ui-label !mb-2 flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>Stock alto
                    </p>
                    <p class="text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-emerald-700 dark:text-emerald-400">
                        {{ highStockCount }}
                    </p>
                </div>
                <div class="ui-stat">
                    <p class="ui-label !mb-2 flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full bg-amber-500"></span>Stock medio
                    </p>
                    <p class="text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-amber-700 dark:text-amber-400">
                        {{ mediumStockCount }}
                    </p>
                </div>
                <div class="ui-stat">
                    <p class="ui-label !mb-2 flex items-center gap-1.5">
                        <span class="h-1.5 w-1.5 rounded-full bg-red-500"></span>Stock bajo
                    </p>
                    <p class="text-[30px] font-semibold tabular-nums tracking-[-0.03em] text-red-700 dark:text-red-400">
                        {{ lowStockCount }}
                    </p>
                </div>
            </div>
            <p v-if="unknownStockCount > 0" class="text-xs text-stone-400">
                {{ unknownStockCount }} ingrediente(s) con nivel desconocido por falta de tamaño de presentación.
            </p>

            <IngredientsTable :ingredients="ingredients" :loading="dataLoading" @edit-ingredient="openEditModal"
                @delete-ingredient="handleDeleteIngredient" @edit-stock-click="handleEditStock" />
        </template>

        <IngredientModal :show="showIngredientModal" :ingredient="editingIngredient" @close="closeIngredientModal"
            @save="handleSaveIngredient" @adjust-stock="handleAdjustStockFromModal" />

        <EditStockModal :show="showEditStockModal" :ingredient="editingStockIngredient"
            @close="closeEditStockModal" @save="handleSaveStock" />

        <ConfirmationModal :show="showDeleteModal" eyebrow="Eliminar ingrediente" title="¿Eliminar ingrediente?"
            :message="`¿Estás seguro de que deseas eliminar '${ingredientToDelete?.name || ''}'?`"
            details="Esta acción podría afectar recetas existentes y no se puede deshacer."
            confirm-button-text="Sí, eliminar" @close="closeDeleteModal" @confirm="confirmIngredientDeletion" />
    </div>
</template>
