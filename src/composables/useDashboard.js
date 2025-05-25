// src/composables/useDashboard.js
import { ref, computed, watch } from 'vue';
import { useUserData } from './useUserData.js';
import { useToast } from 'vue-toastification';

export function useDashboard() {
  const {
    recipes,
    globalIngredients,
    dataLoading,
    dataError,
    deleteRecipe,
    saveRecipe,
    addRecipe,
  } = useUserData();

  const toast = useToast();

  // Estado para modales y selección
  const isEditModalOpen = ref(false);
  const editingRecipe = ref(null);
  const isAddModalOpen = ref(false);

  const showDeleteRecipeModal = ref(false);
  const recipeToDelete = ref(null);

  // Mostrar toast en caso de error en la carga de datos
  watch(dataError, (errorMsg) => {
    if (errorMsg) toast.error(errorMsg);
  });

  // Nombre de receta para modal de eliminación
  const recipeToDeleteName = computed(() => {
    if (!recipeToDelete.value) return '';
    const recipe = recipes.value.find(r => r.id === recipeToDelete.value.id);
    return recipe ? recipe.name : 'esta receta';
  });

  // Abrir y cerrar modal añadir receta
  function openAddRecipeModal() {
    isAddModalOpen.value = true;
  }
  function closeAddRecipeModal() {
    isAddModalOpen.value = false;
  }

  // Añadir receta con validación y manejo optimista
  async function handleAddRecipe(newRecipeName) {
    if (!newRecipeName.trim()) {
      toast.warning('El nombre de la receta no puede estar vacío.');
      return;
    }
    const tempId = Date.now().toString();
    const tempRecipe = {
      id: tempId,
      name: newRecipeName,
      ingredients: [],
      packagingCostPerBatch: 0,
      laborCostPerBatch: 0,
      itemsPerBatch: 1,
      profitMarginPercent: 0,
      lossBufferPercent: 0,
    };
    recipes.value.push(tempRecipe); // Actualización optimista
    try {
      const success = await addRecipe(tempRecipe);
      if (success) toast.success(`Receta '${tempRecipe.name}' añadida exitosamente.`);
    } catch (error) {
      toast.error('No se pudo añadir la receta. Inténtalo de nuevo.');
      console.error('Error al añadir receta:', error);
    }
  }

  // Abrir y cerrar modal editar receta
  function openEditRecipeModal(recipe) {
    editingRecipe.value = { ...recipe }; // Mejor clonar para evitar mutaciones directas
    isEditModalOpen.value = true;
  }
  function closeEditRecipeModal() {
    editingRecipe.value = null;
    isEditModalOpen.value = false;
  }

  // Guardar cambios con validación y manejo de errores
  async function handleSaveRecipe(updatedRecipe) {
    if (!updatedRecipe.name || !Array.isArray(updatedRecipe.ingredients)) {
      toast.warning('Datos de receta incompletos para guardar.');
      return;
    }
    try {
      await saveRecipe(updatedRecipe);
      toast.success(`Receta '${updatedRecipe.name}' actualizada exitosamente.`);
      closeEditRecipeModal();
    } catch (error) {
      toast.error('Error al guardar la receta.');
      console.error(error);
    }
  }

  // Solicitar confirmación para eliminar receta
  function requestDeleteRecipeConfirmation(recipeId) {
    const recipe = recipes.value.find(r => r.id === recipeId);
    if (recipe) {
      recipeToDelete.value = recipe;
      showDeleteRecipeModal.value = true;
    } else {
      toast.error('Receta no encontrada para eliminar.');
    }
  }

  // Cancelar eliminación
  function cancelRecipeDeletion() {
    recipeToDelete.value = null;
    showDeleteRecipeModal.value = false;
  }

  // Confirmar eliminación con manejo de errores y toast
  async function confirmRecipeDeletion() {
    if (!recipeToDelete.value) return;
    const id = recipeToDelete.value.id;
    showDeleteRecipeModal.value = false;
    recipeToDelete.value = null;
    try {
      const recipeName = await deleteRecipe(id);
      toast.success(`Receta '${recipeName}' eliminada exitosamente.`);
    } catch (error) {
      toast.error('Error al eliminar receta.');
      console.error('Error durante eliminación de receta:', error);
    }
  }

  return {
    recipes,
    globalIngredients,
    dataLoading,
    dataError,

    isEditModalOpen,
    editingRecipe,
    isAddModalOpen,

    showDeleteRecipeModal,
    recipeToDelete,
    recipeToDeleteName,

    openAddRecipeModal,
    closeAddRecipeModal,
    handleAddRecipe,

    openEditRecipeModal,
    closeEditRecipeModal,
    handleSaveRecipe,

    requestDeleteRecipeConfirmation,
    cancelRecipeDeletion,
    confirmRecipeDeletion,
  };
}