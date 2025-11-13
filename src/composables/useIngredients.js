// src/composables/useIngredients.js
import { ref, computed } from 'vue';
import { useUserData } from './useUserData';
import { useToast } from 'vue-toastification';
import { useAsyncHandler } from './useAsyncHandler';

export function useIngredients() {
    // Corregido: usamos globalIngredients (no ingredients)
    const {
        globalIngredients,
        recipes,
        addIngredient,
        deleteIngredient,
        saveIngredient,
        dataLoading,
        dataError,
    } = useUserData();

    const toast = useToast();
    const { loading, error, runAsync } = useAsyncHandler();

    // Modales y estado
    const showDeleteModal = ref(false);
    const ingredientToDelete = ref(null);

    const showEditModal = ref(false);
    const editingIngredient = ref(null);

    const showEditStockModal = ref(false);
    const editingStockIngredient = ref(null);

    // Funciones para abrir/cerrar modales
    function openDeleteModal(ingredient) {
        if (!ingredient || !ingredient.id) {
            toast.error("Error: No se pudo identificar el ingrediente a eliminar.");
            return;
        }

        const ingredienteId = ingredient.id;

        // 1. Buscar el ingrediente en las recetas
        const recetasQueLoUsan = recipes.value.filter(receta =>
            Array.isArray(receta.ingredients) && // Asegurarse de que la receta tenga un array de ingredientes
            receta.ingredients.some(ing => ing.ingredientId === ingredienteId)
        );

        // 2. Comprobar si se encontró en alguna receta
        if (recetasQueLoUsan.length > 0) {
            // 3. Si se usa, mostrar error y NO abrir el modal
            // Muestra la primera receta que lo usa como ejemplo
            toast.error(`No se puede eliminar: el ingrediente está en uso en la receta "${recetasQueLoUsan[0].name}" (y posiblemente en ${recetasQueLoUsan.length - 1} más).`);
        } else {
            // 4. Si no se usa, proceder a abrir el modal de confirmación como antes
            ingredientToDelete.value = ingredient;
            showDeleteModal.value = true;
        }
    }

    function closeDeleteModal() {
        showDeleteModal.value = false;
        ingredientToDelete.value = null;
    }

    function openEditModal(ingredient) {
        editingIngredient.value = { ...ingredient }; // copia para evitar mutar directo
        showEditModal.value = true;
    }

    function closeEditModal() {
        showEditModal.value = false;
        editingIngredient.value = null;
    }

    function openEditStockModal(ingredient) {
        editingStockIngredient.value = { ...ingredient };
        showEditStockModal.value = true;
    }

    function closeEditStockModal() {
        showEditStockModal.value = false;
        editingStockIngredient.value = null;
    }


    // Validación ingrediente
    function validateIngredient(ingredient) {
        if (!ingredient.name || ingredient.name.trim() === '') {
            toast.warning('El nombre del ingrediente es obligatorio.');
            return false;
        }
        if (ingredient.cost == null || isNaN(ingredient.cost) || ingredient.cost < 0) {
            toast.warning('El costo debe ser un número positivo.');
            return false;
        }
        if (!ingredient.unit || ingredient.unit.trim() === '') {
            toast.warning('La unidad es obligatoria.');
            return false;
        }
        if (ingredient.presentationSize == null || isNaN(ingredient.presentationSize) || ingredient.presentationSize <= 0) {
            toast.warning('El tamaño debe ser un número mayor a cero.');
            return false;
        }
        if (ingredient.currentStock == null || isNaN(ingredient.currentStock) || ingredient.currentStock < 0) {
            toast.warning('El stock inicial debe ser un número igual o mayor a cero.');
            return false;
        }
        return true;
    }

    // Agregar ingrediente
    async function addNewIngredient(newIngredient) {
        if (!validateIngredient(newIngredient)) return false;

        return await runAsync(async () => {
            const success = await addIngredient(newIngredient);
            if (success) {
                toast.success(`Ingrediente '${newIngredient.name}' agregado exitosamente.`);
            }
            return success;
        }, "No se pudo agregar el ingrediente.");
    }

    // Guardar cambios ingrediente
    async function saveIngredientChanges(ingredient) {
        if (!validateIngredient(ingredient)) return false;

        return await runAsync(async () => {
            await saveIngredient(ingredient);
            toast.success(`Ingrediente '${ingredient.name}' actualizado.`);
            closeEditModal();
            return true;
        }, "No se pudo actualizar el ingrediente.");
    }

    // Guardar cambios stock
    async function saveStockChanges(ingredient) {
        if (ingredient.currentStock == null || isNaN(ingredient.currentStock) || ingredient.currentStock < 0) {
            toast.warning('El stock debe ser un número igual o mayor a cero.');
            return false;
        }

        return await runAsync(async () => {
            await saveIngredient(ingredient);
            toast.success(`Stock actualizado para '${ingredient.name}'.`);
            closeEditStockModal();
            return true;
        }, "No se pudo actualizar el stock.");
    }


    // Confirmar eliminación
    async function confirmDelete() {
        if (!ingredientToDelete.value) return;

        const id = ingredientToDelete.value.id;
        const name = ingredientToDelete.value.name;

        closeDeleteModal();

        await runAsync(async () => {
            await deleteIngredient(id);
            toast.success(`Ingrediente '${name}' eliminado.`);
        }, "No se pudo eliminar el ingrediente.");
    }

    // Computed para stock status (alto, medio, bajo)
    const stockStatus = computed(() => {
        return globalIngredients.value.map(ing => {
            let status = 'alto';
            if (ing.currentStock <= 5) status = 'bajo';
            else if (ing.currentStock <= 15) status = 'medio';
            return { ...ing, stockStatus: status };
        });
    });

    return {
        ingredients: stockStatus,
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
        confirmDelete,
    };
}