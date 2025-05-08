<script setup>
import { ref, watch, computed } from 'vue'; // Importa computed
import { useUserData } from '../composables/useUserData.js';
import RecipeCard from '../components/RecipeCard.vue';
import EditRecipeModal from '../components/EditRecipeModal.vue';
import AddRecipeModal from '../components/AddRecipeModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import { useToast } from "vue-toastification";

// --- Estado ---
// Asegúrate de obtener 'recipes' del composable
const { recipes, globalIngredients, dataLoading, dataError, deleteRecipe, saveRecipe, addRecipe } = useUserData();

const isEditModalOpen = ref(false);
const editingRecipe = ref(null);
const isAddModalOpen = ref(false);

// --- Estado para el Modal de Confirmación de Eliminación de Receta ---
const showDeleteRecipeModal = ref(false);
const recipeToDelete = ref(null); // To store the recipe object to be deleted

// --- Toast Instance ---
const toast = useToast();

// Watch for data errors and show a toast
watch(dataError, (errorMsg) => {
  if (errorMsg) {
    toast.error(errorMsg);
  }
});

// --- Computed property for delete confirmation message ---
// *** Corregido: Usar recipeToDelete y la lista de recipes ***
const recipeToDeleteName = computed(() => {
  if (!recipeToDelete.value) {
    return ''; // Return empty if no recipe is selected for deletion
  }
  // Find the recipe by its ID in the list of recipes from the composable
  const recipe = recipes.value.find(rec => rec.id === recipeToDelete.value.id);
  return recipe ? recipe.name : 'esta receta'; // Fallback text
});


// --- Funciones ---

// Abre el modal de añadir
function openAddRecipeModal() {
  isAddModalOpen.value = true;
}

// Cierra el modal de añadir
function handleCloseAddModal() {
  isAddModalOpen.value = false;
}

// Maneja la adición desde el modal
async function handleAddRecipe(newRecipeName) {
  if (!newRecipeName.trim()) {
    toast.warning('El nombre de la receta no puede estar vacío.');
    return;
  }

  const tempId = Date.now().toString(); // ID temporal único
  const tempRecipe = {
    id: tempId,
    name: newRecipeName,
    ingredients: [],
    packagingCostPerBatch: 0,
    laborCostPerBatch: 0,
    itemsPerBatch: 1,
    profitMarginPercent: 0,
    lossBufferPercent: 0
  };

  // ✅ Actualización optimista del estado local
  recipes.value.push(tempRecipe);

  try {
    const success = await addRecipe(tempRecipe);
    if (success) {
      toast.success(`Receta '${tempRecipe.name}' añadida exitosamente.`);
    }
  } catch (error) {
    console.error("Error al añadir receta:", error);
    toast.error("No se pudo añadir la receta. Inténtalo de nuevo.");
  }
}

// --- Funciones del Modal de Confirmación de Eliminación de Receta ---

// Solicita confirmación antes de eliminar una receta
function requestDeleteRecipeConfirmation(recipeId) {
  const recipe = recipes.value.find(r => r.id === recipeId);
  if (recipe) {
    recipeToDelete.value = recipe; // Store the recipe object
    showDeleteRecipeModal.value = true; // Show the confirmation modal
  } else {
    toast.error("Receta no encontrada para eliminar.");
  }
}

// Confirma la eliminación de la receta (llamada desde el modal)
async function confirmRecipeDeletion() {
  if (recipeToDelete.value) {
    const recipeId = recipeToDelete.value.id;
    // const recipeName = recipeToDelete.value.name; // Get name for toast BEFORE setting to null

    showDeleteRecipeModal.value = false;
    recipeToDelete.value = null; // Clear immediately

    try {
      // The composable deleteRecipe already returns the name
      const recipeName = await deleteRecipe(recipeId);
      toast.success(`Receta '${recipeName}' eliminada exitosamente.`);
    } catch (error) {
      console.error("DashboardView: Error during recipe deletion:", error);
    }
  }
}

// Cancela la eliminación de la receta (llamada desde el modal)
function cancelRecipeDeletion() {
  showDeleteRecipeModal.value = false;
  recipeToDelete.value = null; // Clear the stored recipe
}


// --- Funciones del Modal de Edición ---
function handleEditRecipe(recipeToEdit) {
  editingRecipe.value = recipeToEdit;
  isEditModalOpen.value = true;
}

function handleCloseEditModal() {
  isEditModalOpen.value = false;
  editingRecipe.value = null;
}

async function handleSaveChanges(updatedRecipe) {
  // Basic validation before saving (modal might do some)
  if (!updatedRecipe.name || !Array.isArray(updatedRecipe.ingredients)) {
    toast.warning('Datos de receta incompletos para guardar.');
    return;
  }

  // The composable saveRecipe updates the local state and saves async
  await saveRecipe(updatedRecipe); // Save via composable async

  toast.success(`Receta '${updatedRecipe.name}' actualizada exitosamente.`); // Keep toast here for component feedback

  handleCloseEditModal(); // Close modal after save attempt
}

</script>

<template>
  <div>
    <div class="flex justify-end mb-6">
      <button @click="openAddRecipeModal"
        class="px-5 py-2 cursor-pointer bg-accent-500 text-white font-semibold rounded-lg shadow-md
               hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2
               transition-all duration-200 ease-in-out transform hover:scale-105
               dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background">
        Añadir Nueva Receta
      </button>
    </div>

    <div v-if="dataLoading" class="text-center py-10 text-text-muted italic
                dark:text-dark-text-muted">
      Cargando recetas...
    </div>
    <div v-else-if="dataError" class="text-center py-10 text-danger-600 font-medium
                dark:text-danger-400">
      Error al cargar recetas: {{ dataError }}
    </div>
    <div v-else-if="recipes.length === 0" class="text-center py-10 text-text-muted italic
                dark:text-dark-text-muted">
      No hay recetas todavía. ¡Añade una!
    </div>
    <TransitionGroup v-else tag="div" name="card-list"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" :globalIngredients="globalIngredients"
        @delete-recipe="requestDeleteRecipeConfirmation" @edit-recipe="handleEditRecipe(recipe)" />
    </TransitionGroup>

    <AddRecipeModal :show="isAddModalOpen" @close="handleCloseAddModal" @add="handleAddRecipe" />

    <EditRecipeModal v-if="isEditModalOpen && editingRecipe" :show="isEditModalOpen" :recipe="editingRecipe"
      :globalIngredients="globalIngredients" @close="handleCloseEditModal" @save="handleSaveChanges" />

    <ConfirmationModal :show="showDeleteRecipeModal" title="Confirmar Eliminación de Receta"
      :message="`¿Estás seguro de que deseas eliminar la receta '${recipeToDeleteName}'? Esta acción no se puede deshacer.`"
      confirmButtonText="Sí, Eliminar Receta"
      confirmButtonClass="bg-danger-600 hover:bg-danger-700 focus:ring-danger-500 dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base"
      @close="cancelRecipeDeletion" @confirm="confirmRecipeDeletion" />

  </div>
</template>