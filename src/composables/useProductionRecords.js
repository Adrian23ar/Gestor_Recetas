// src/composables/useProductionRecords.js
import { ref } from 'vue';
import { useUserData } from './useUserData';
import { useToast } from 'vue-toastification';
import { useAsyncHandler } from './useAsyncHandler';

export function useProductionRecords() {
    const {
        productionRecords,
        recipes,
        globalIngredients,
        addProductionRecord,
        deleteProductionRecord,
        saveProductionRecord, // This function will implicitly handle the new isSold field
        saveIngredient,
        dataLoading,
        dataError,
    } = useUserData();

    const toast = useToast();
    const { loading, error, runAsync } = useAsyncHandler();

    // Estados para modales
    const showDeleteModal = ref(false);
    const recordToDelete = ref(null);
    const showEditModal = ref(false);
    const editingRecord = ref(null);

    function validateStock(selectedRecipe) {
        if (!Array.isArray(selectedRecipe.ingredients) || selectedRecipe.ingredients.length === 0) {
            toast.warning(`La receta '${selectedRecipe.name}' no tiene ingredientes definidos.`);
            return { valid: false };
        }

        let hasSufficientStock = true;
        const ingredientsToUpdateLocally = [];

        for (const recipeIng of selectedRecipe.ingredients) {
            const globalIng = globalIngredients.value.find(g => g.id === recipeIng.ingredientId);
            const neededQuantity = Number(recipeIng.quantity);

            if (!globalIng) {
                toast.error(`Ingrediente ID '${recipeIng.ingredientId}' no encontrado.`);
                hasSufficientStock = false;
                break;
            }

            const currentStock = Number(globalIng.currentStock) || 0;

            if (currentStock < neededQuantity) {
                toast.error(`Stock insuficiente para '${globalIng.name}'. Necesitas: ${neededQuantity} ${globalIng.unit}, Tienes: ${currentStock} ${globalIng.unit}.`);
                hasSufficientStock = false;
                break;
            }

            const newStock = currentStock - neededQuantity;
            ingredientsToUpdateLocally.push({ ...globalIng, currentStock: newStock });
        }

        return { valid: hasSufficientStock, ingredientsToUpdateLocally };
    }

    async function addRecord(selectedRecipeId, productionDate) {
        if (!selectedRecipeId || !productionDate) {
            toast.warning('Selecciona una receta e ingresa la fecha.');
            return false;
        }

        return await runAsync(async () => {
            const selectedRecipe = recipes.value.find(r => r.id === selectedRecipeId);

            if (!selectedRecipe || selectedRecipe.calculatedRecipeOnlyCost === undefined || selectedRecipe.laborCostPerBatch === undefined || selectedRecipe.calculatedFinalPrice === undefined) {
                toast.error('Datos incompletos o no encontrados para la receta seleccionada. Edita y guarda la receta primero.');
                return false;
            }

            const { valid, ingredientsToUpdateLocally } = validateStock(selectedRecipe);

            if (!valid) return false;

            const items = Number(selectedRecipe.itemsPerBatch) || 1;
            const ingresoTotal = selectedRecipe.calculatedFinalPrice * items;
            const recipeOnlyCostForProduction = selectedRecipe.calculatedRecipeOnlyCost;
            const laborCostForProduction = selectedRecipe.laborCostPerBatch;
            const gananciaNeta = ingresoTotal - (recipeOnlyCostForProduction + laborCostForProduction);

            const recordToAdd = {
                id: Date.now().toString(),
                recipeId: selectedRecipe.id,
                productName: selectedRecipe.name,
                batchSize: items,
                date: productionDate,
                totalRevenue: ingresoTotal,
                recipeOnlyCost: recipeOnlyCostForProduction,
                laborCost: laborCostForProduction,
                netProfit: gananciaNeta,
                isSold: false, // NUEVO: Inicializar isSold para nuevos registros
            };

            const recordAddedSuccess = await addProductionRecord(recordToAdd);
            if (!recordAddedSuccess) {
                toast.error("Error al guardar el registro de producción.");
                return false;
            }

            const stockUpdateResults = await Promise.all(
                ingredientsToUpdateLocally.map(updatedIngredient =>
                    saveIngredient(updatedIngredient).catch(() => updatedIngredient.name)
                )
            );

            const stockUpdateErrors = stockUpdateResults.filter(result => typeof result === 'string');

            if (stockUpdateErrors.length > 0) {
                toast.error(`Registro guardado, PERO falló actualización de stock para: ${stockUpdateErrors.join(', ')}.`);
            } else {
                toast.success(`Producción de '${recordToAdd.productName}' registrada y stock descontado.`);
            }

            return true;
        }, "No se pudo registrar la producción.");
    }


    async function confirmDelete() {
        if (!recordToDelete.value) return;

        const id = recordToDelete.value.id;
        const name = recordToDelete.value.productName;

        closeDeleteModal();

        await runAsync(async () => {
            const deletedName = await deleteProductionRecord(id);
            toast.success(`Registro de '${deletedName || name}' eliminado exitosamente.`);
        }, "No se pudo eliminar el registro.");
    }

    async function saveChanges(updatedRecord) { // updatedRecord ya contendrá isSold desde el modal
        if (!updatedRecord.productName || updatedRecord.batchSize === null || !updatedRecord.date || updatedRecord.netProfit === null) {
            toast.warning('Por favor, completa todos los campos antes de guardar.');
            return false;
        }
        if (updatedRecord.batchSize <= 0) {
            toast.warning('El lote debe ser mayor a cero.');
            return false;
        }
        if (isNaN(updatedRecord.netProfit)) {
            toast.warning('La ganancia neta debe ser un número válido.');
            return false;
        }
        // No es necesaria una validación específica para updatedRecord.isSold aquí,
        // ya que es un booleano y su valor (true/false) es siempre válido.

        return await runAsync(async () => {
            await saveProductionRecord(updatedRecord); // saveProductionRecord debe estar preparado para guardar el campo isSold
            toast.success(`Registro de '${updatedRecord.productName}' actualizado exitosamente.`);
            closeEditModal();
            return true;
        }, "No se pudo guardar el registro editado.");
    }

    // Modales eliminar y editar
    function openDeleteModal(record) {
        recordToDelete.value = record;
        showDeleteModal.value = true;
    }
    function closeDeleteModal() {
        showDeleteModal.value = false;
        recordToDelete.value = null;
    }
    function openEditModal(record) {
        editingRecord.value = record; // record ya podría tener isSold si fue previamente guardado
        showEditModal.value = true;
    }
    function closeEditModal() {
        showEditModal.value = false;
        editingRecord.value = null;
    }

    console.log(productionRecords.value);

    return {
        productionRecords, // Estos registros ahora deben incluir isSold
        recipes,
        dataLoading,
        dataError,
        loading,
        error,
        showDeleteModal,
        recordToDelete,
        showEditModal,
        editingRecord,
        addRecord,
        openDeleteModal,
        closeDeleteModal,
        confirmDelete,
        openEditModal,
        closeEditModal,
        saveChanges,
    };
}