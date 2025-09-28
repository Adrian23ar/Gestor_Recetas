<script setup>
import { useDashboard } from '../composables/useDashboard.js';
// Importar componentes usados en template
import RecipeCard from '../components/RecipeCard.vue';
import AddRecipeModal from '../components/AddRecipeModal.vue';
import EditRecipeModal from '../components/EditRecipeModal.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import ErrorMessage from '../components/ErrorMessage.vue';

// Desestructuramos todo desde el composable para usar en template y lógica
const {
  recipes,
  globalIngredients,
  dataLoading,
  dataError,

  isEditModalOpen,
  editingRecipe,
  isAddModalOpen,

  showDeleteRecipeModal,
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
} = useDashboard();
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
    <div v-else-if="dataError" class="mt-4">
      <ErrorMessage :message="dataError" />
    </div>
    <div v-else-if="recipes.length === 0" class="text-center py-10 text-text-muted italic
                dark:text-dark-text-muted">
      No hay recetas todavía. ¡Añade una!
    </div>
    <TransitionGroup v-else tag="div" name="card-list"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      <RecipeCard v-for="recipe in recipes" :key="recipe.id" :recipe="recipe" :globalIngredients="globalIngredients"
        @delete-recipe="requestDeleteRecipeConfirmation" @edit-recipe="openEditRecipeModal(recipe)" />
    </TransitionGroup>

    <AddRecipeModal :show="isAddModalOpen" @close="closeAddRecipeModal" @add="handleAddRecipe" />

    <EditRecipeModal v-if="isEditModalOpen && editingRecipe" :show="isEditModalOpen" :recipe="editingRecipe"
      :globalIngredients="globalIngredients" @close="closeEditRecipeModal" @save="handleSaveRecipe" />

    <ConfirmationModal :show="showDeleteRecipeModal" title="Confirmar Eliminación de Receta"
      :message="`¿Estás seguro de que deseas eliminar la receta '${recipeToDeleteName}'? Esta acción no se puede deshacer.`"
      confirmButtonText="Sí, Eliminar Receta"
      confirmButtonClass="bg-danger-600 hover:bg-danger-700 focus:ring-danger-500 dark:bg-danger-700 dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:text-dark-text-base"
      @close="cancelRecipeDeletion" @confirm="confirmRecipeDeletion" />
  </div>
</template>
