<script setup>
import { ref, watch, computed } from 'vue';
import TableRegister from '../components/TableRegister.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditProductionModal from '../components/EditProductionModal.vue';
import { useUserData } from '../composables/useUserData.js';
import { useToast } from "vue-toastification";
import Multiselect from '@vueform/multiselect'; // Importar Multiselect

// --- Estado y Funciones del Composable ---
// Asegúrate de obtener productionRecords del composable
const {
    productionRecords, recipes, globalIngredients, dataLoading, dataError,
    addProductionRecord, deleteProductionRecord, saveProductionRecord, saveIngredient
} = useUserData();

// --- Estado Local ---
const selectedRecipeId = ref(null); // ID de la receta seleccionada
const productionDate = ref('');     // Fecha de producción


// --- Estado para los Modales de Eliminación y Edición de Registros ---
const showDeleteModal = ref(false);
const recordToDelete = ref(null);
const showEditModal = ref(false);
const editingRecord = ref(null);
// --- Toast Instance ---
const toast = useToast();

// Watch for data errors and show a toast
watch(dataError, (errorMsg) => {
    if (errorMsg) {
        toast.error(errorMsg);
    }
});

// --- Computed Property for Delete Confirmation Message ---
const recordToDeleteName = computed(() => {
    return recordToDelete.value ? recordToDelete.value.productName : 'este registro';
});


// --- Funciones Formulario Añadir ---
async function handleAddRecord() {
    // 1. Validar Selección y Fecha
    if (!selectedRecipeId.value || !productionDate.value) {
        toast.warning('Selecciona una receta e ingresa la fecha.');
        return;
    }

    // 2. Obtener Receta Completa (asegurarse que incluye costos calculados)
    const selectedRecipe = recipes.value.find(r => r.id === selectedRecipeId.value);

    if (!selectedRecipe || selectedRecipe.calculatedRecipeOnlyCost === undefined || selectedRecipe.laborCostPerBatch === undefined || selectedRecipe.calculatedFinalPrice === undefined) {
        toast.error('Datos incompletos o no encontrados para la receta seleccionada. Edita y guarda la receta primero.');
        return;
    }

    // 3. Validar Stock y Preparar Actualizaciones
    let hasSufficientStock = true;
    const stockUpdates = []; // Guardará { ingredientId, newStock }
    const ingredientsToUpdateLocally = []; // Guardará el objeto completo para saveIngredient

    if (!Array.isArray(selectedRecipe.ingredients) || selectedRecipe.ingredients.length === 0) {
        toast.warning(`La receta '${selectedRecipe.name}' no tiene ingredientes definidos.`);
        return; // No se puede producir sin ingredientes
    }

    for (const recipeIng of selectedRecipe.ingredients) {
        const globalIng = globalIngredients.value.find(g => g.id === recipeIng.ingredientId);
        const neededQuantity = Number(recipeIng.quantity);

        if (!globalIng) {
            toast.error(`Ingrediente ID '${recipeIng.ingredientId}' no encontrado.`); hasSufficientStock = false; break;
        }
        const currentStock = Number(globalIng.currentStock) || 0;
        if (currentStock < neededQuantity) {
            toast.error(`Stock insuficiente para '${globalIng.name}'. Necesitas: ${neededQuantity} ${globalIng.unit}, Tienes: ${currentStock} ${globalIng.unit}.`); hasSufficientStock = false;
            break;
        }
        const newStock = currentStock - neededQuantity; ingredientsToUpdateLocally.push({ ...globalIng, currentStock: newStock });
    }
    // 4. Detener si no hay stock
    if (!hasSufficientStock) {
        return;
    }

    const items = Number(selectedRecipe.itemsPerBatch) || 1;
    const ingresoTotal = selectedRecipe.calculatedFinalPrice * items;
    // NUEVOS COSTOS PARA EL REGISTRO DE PRODUCCIÓN
    const recipeOnlyCostForProduction = selectedRecipe.calculatedRecipeOnlyCost; // Ingr. + Emp.
    const laborCostForProduction = selectedRecipe.laborCostPerBatch;          // Mano de Obra

    // Ganancia Neta Calculada basada en los costos separados
    const gananciaNeta = ingresoTotal - (recipeOnlyCostForProduction + laborCostForProduction);


    // 5. Crear Objeto de Registro
    const recordToAdd = {
        id: Date.now().toString(),
        recipeId: selectedRecipe.id,
        productName: selectedRecipe.name,
        batchSize: items,
        date: productionDate.value,
        totalRevenue: ingresoTotal,
        recipeOnlyCost: recipeOnlyCostForProduction, // Correcto
        laborCost: laborCostForProduction,         // Correcto (se mapea a laborCostForBatch en useUserData)
        netProfit: gananciaNeta,
    };

    try {
        const recordAddedSuccess = await addProductionRecord(recordToAdd);
        if (recordAddedSuccess) {
            console.log("RegisterView: Registro guardado en backend.");
            let stockUpdateErrors = [];
            for (const updatedIngredient of ingredientsToUpdateLocally) {
                try {
                    await saveIngredient(updatedIngredient);
                } catch (stockError) {
                    stockUpdateErrors.push(updatedIngredient.name);
                    console.error(`Error al guardar stock para ${updatedIngredient.name}:`, stockError);
                }
            }
            if (stockUpdateErrors.length > 0) {
                toast.error(`Registro guardado, PERO falló actualización de stock para: ${stockUpdateErrors.join(', ')}.`);
            } else {
                toast.success(`Producción de '${recordToAdd.productName}' registrada y stock descontado.`);
            }
            // Limpiar formulario
            selectedRecipeId.value = null;
            productionDate.value = '';
        } else {
            toast.error("Error al guardar el registro de producción.");
            // Rollback ya debería estar en useUserData
        }
    } catch (error) {
        console.error("Error handling add record:", error);
        toast.error("Ocurrió un error inesperado.");
        productionRecords.value = productionRecords.value.filter(r => r.id !== recordToAdd.id); // Rollback manual por si acaso
    }
}

// --- Funciones Modal de Eliminación (Mantener como estaban) ---
function handleDeleteRecord(recordId) {
    const record = productionRecords.value.find(r => r.id === recordId);
    if (record) {
        recordToDelete.value = record;
        showDeleteModal.value = true;
    } else {
        toast.error("Registro no encontrado para eliminar.");
    }
}

async function confirmProductionDeletion() {
    if (recordToDelete.value) {
        const recordId = recordToDelete.value.id;
        const recordName = recordToDelete.value.productName; // Get name for toast BEFORE setting to null

        showDeleteModal.value = false;
        recordToDelete.value = null; // Clear immediately

        try {
            // The composable deleteProductionRecord should return the name
            const deletedName = await deleteProductionRecord(recordId);
            toast.success(`Registro de '${deletedName || recordName}' eliminado exitosamente.`);
        } catch (error) {
            console.error("RegisterView: Error during production record deletion:", error);
            // The watcher on dataError should handle showing a toast if there's a server error
        }
    }
}

function cancelProductionDeletion() {
    showDeleteModal.value = false;
    recordToDelete.value = null;
}

// --- Funciones Modal de Edición (Mantener como estaban) ---
function handleEditRecord(record) {
    editingRecord.value = record;
    showEditModal.value = true;
}

function handleCloseEditModal() {
    showEditModal.value = false;
    editingRecord.value = null;
}

async function handleSaveChanges(updatedRecord) {
    if (!updatedRecord.productName || updatedRecord.batchSize === null || !updatedRecord.date || updatedRecord.netProfit === null) {
        toast.warning('Por favor, completa todos los campos antes de guardar.');
        return;
    }
    if (updatedRecord.batchSize <= 0) {
        toast.warning('El lote debe ser mayor a cero.');
        return;
    }
    if (updatedRecord.netProfit === null || isNaN(updatedRecord.netProfit)) {
        toast.warning('La ganancia neta debe ser un número válido.');
        return;
    }

    // Call the composable function to save changes
    await saveProductionRecord(updatedRecord);

    // Toast success (composable might also do this, but component toast provides direct feedback)
    toast.success(`Registro de '${updatedRecord.productName}' actualizado exitosamente.`);

    handleCloseEditModal(); // Close modal after save attempt
}

// Helper para formato de moneda (local, podría ir a utils)
function formatCurrency(value) {
    const num = Number(value);
    if (isNaN(num)) { return '$0.00'; }
    return `$${num.toFixed(2)}`;
}

// En la información que se muestra debajo del selector de recetas:
const selectedRecipeInfo = computed(() => {
    if (!selectedRecipeId.value) return null;
    const recipe = recipes.value.find(r => r.id === selectedRecipeId.value);
    if (!recipe) return null;

    const gastosOp = recipe.calculatedRecipeOnlyCost !== undefined ? formatCurrency(recipe.calculatedRecipeOnlyCost) : 'N/A';
    const manoDeObra = recipe.laborCostPerBatch !== undefined ? formatCurrency(recipe.laborCostPerBatch) : 'N/A';

    return `Lote: ${recipe.itemsPerBatch || 'N/A'} items | PVP Final: ${formatCurrency(recipe.calculatedFinalPrice || 0)} | Gastos Op. (Ingr.+Emp.): ${gastosOp} | Mano Obra: ${manoDeObra}`;
});
</script>

<template>
    <div class="space-y-8 mt-4">
        <div class="bg-contrast p-6 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
            <form @submit.prevent="handleAddRecord" class="space-y-4">
                <div class="grid grid-cols-2 gap-8">
                    <div class="col-span-2 md:col-span-1">
                        <label for="select-recipe"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Receta
                            Producida:</label>
                        <Multiselect id="select-recipe" v-model="selectedRecipeId" :options="recipes"
                            placeholder="-- Selecciona una receta --" :searchable="true" valueProp="id" label="name"
                            trackBy="name" :clearOnSelect="false" :closeOnSelect="true" required :classes="{
                                container: 'relative mx-auto w-full flex items-center justify-end box-border cursor-pointer border border-neutral-300 rounded-md bg-contrast text-base leading-snug outline-none mt-1 dark:border-dark-neutral-700 dark:bg-dark-contrast',
                                containerActive: 'ring-2 ring-accent-500/50 border-accent-500 dark:ring-dark-accent-400/50 dark:border-dark-accent-400',
                                singleLabelText: 'overflow-ellipsis overflow-hidden block whitespace-nowrap max-w-full text-text-base dark:text-dark-text-base',
                                placeholder: 'flex items-center h-full absolute left-0 top-0 pointer-events-none bg-transparent leading-snug pl-3.5 text-text-muted dark:text-dark-text-muted',
                                dropdown: 'absolute -left-px -right-px bottom-0 transform translate-y-full border border-neutral-300 -mt-px overflow-y-auto z-50 bg-contrast flex flex-col rounded-b-md dark:border-dark-neutral-700 dark:bg-dark-contrast ring-1 ring-black/5 dark:ring-white/5',
                                dropdownHidden: 'hidden',
                                option: 'flex items-center justify-start box-border text-left cursor-pointer text-base leading-snug py-2 px-3 text-text-base dark:text-dark-text-base',
                                optionPointed: 'text-neutral-800 bg-neutral-200 dark:text-dark-neutral-100 dark:bg-dark-neutral-700',
                                optionSelected: 'text-accent-700 bg-accent-100 dark:text-dark-accent-100 dark:bg-dark-accent-600',
                                optionDisabled: 'text-neutral-400 cursor-not-allowed dark:text-dark-neutral-500',
                                noOptions: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                noResults: 'py-2 px-3 text-text-muted text-left dark:text-dark-text-muted',
                                search: 'w-full absolute inset-0 outline-none focus:ring-0 appearance-none box-border border-0 text-base font-sans bg-white  dark:bg-dark-contrast rounded pl-3.5 rtl:pl-0 rtl:pr-3.5',
                            }">
                            <template #option="{ option }">
                                <div>{{ option.name }}</div>
                                <div class="text-xs text-text-muted dark:text-dark-text-muted ml-2">
                                    (Lote: {{ option.itemsPerBatch || 'N/A' }} | PVP: {{
                                        formatCurrency(option.calculatedFinalPrice || 0) }})
                                </div>
                            </template>
                        </Multiselect>
                        <p v-if="selectedRecipeInfo"
                            class="ps-0.5 mt-1 text-xs text-text-muted dark:text-dark-text-muted">
                            {{ selectedRecipeInfo }}
                        </p>
                    </div>

                    <div class="col-span-2 md:col-span-1">
                        <label for="production-date"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Fecha
                            Producción:</label>
                        <input type="date" id="production-date" v-model="productionDate" required
                            class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
                    </div>
                </div>
                <div class="text-right">
                    <button type="submit"
                        class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background transition-all">
                        Registrar y Descontar Stock
                    </button>
                </div>
            </form>
        </div>

        <div class="col-span-2 bg-contrast rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
            <h2 class="text-xl px-6 pt-6 pb-4 font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">
                Historial de Producción
            </h2>
            <div v-if="dataLoading" class="text-center text-text-muted italic dark:text-dark-text-muted"> Cargando
                registros...
            </div>
            <div v-else-if="dataError" class="text-center text-danger-600 font-medium dark:text-danger-400"> Error: {{
                dataError
                }} </div>
            <TableRegister v-else :records="productionRecords" @edit-record="handleEditRecord"
                @delete-record="handleDeleteRecord" />
        </div>

        <ConfirmationModal :show="showDeleteModal" title="Confirmar Eliminación"
            :message="`¿Eliminar registro de '${recordToDeleteName}'?`" @close="cancelProductionDeletion"
            @confirm="confirmProductionDeletion" />
        <EditProductionModal :show="showEditModal" :record="editingRecord" @close="handleCloseEditModal"
            @save="handleSaveChanges" />
    </div>
</template>