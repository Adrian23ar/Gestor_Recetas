<script setup>
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useDashboard } from '../composables/useDashboard.js';
import { computeRecipeCosts } from '../composables/useRecipeCosts.js';
import RecipeCard from '../components/RecipeCard.vue';
import AddRecipeModal from '../components/AddRecipeModal.vue';
import RecipeDrawer from '../components/RecipeDrawer.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import { useViewTutorial } from '../composables/useTutorial.js';
import { dashboardTour } from '../utils/tourSteps.js';

const router = useRouter();

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

const searchQuery = ref('');
const activeChip = ref('all'); // all | highMargin | incomplete

const recipesWithCosts = computed(() =>
  recipes.value.map(recipe => ({
    recipe,
    costs: computeRecipeCosts(recipe, globalIngredients.value),
  }))
);

const highMarginCount = computed(() => recipesWithCosts.value.filter(r => Number(r.recipe.profitMarginPercent || 0) >= 45).length);
const incompleteCount = computed(() => recipesWithCosts.value.filter(r => !r.costs.isComplete).length);

const filteredRecipes = computed(() => {
  let list = recipesWithCosts.value;
  if (activeChip.value === 'highMargin') list = list.filter(r => Number(r.recipe.profitMarginPercent || 0) >= 45);
  else if (activeChip.value === 'incomplete') list = list.filter(r => !r.costs.isComplete);

  const q = searchQuery.value.trim().toLowerCase();
  if (q) list = list.filter(r => r.recipe.name.toLowerCase().includes(q));

  return list.map(r => r.recipe);
});

const lowStockIngredients = computed(() =>
  globalIngredients.value.filter(ing => ing.stockPercent !== null && ing.stockPercent !== undefined && ing.stockPercent <= 60)
);

useViewTutorial(
  { id: 'recetas', getSteps: () => dashboardTour({ hasRecipes: recipes.value.length > 0 }) },
  () => !dataLoading.value && !dataError.value,
);
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 class="ui-h1">Recetas</h1>
        <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">
          {{ recipes.length }} recetas activas · precios recalculados con el costo de hoy
        </p>
      </div>
      <div class="flex items-center gap-2 max-[640px]:w-full max-[640px]:flex-col max-[640px]:items-stretch">
        <input v-model="searchQuery" type="search" placeholder="Buscar receta…"
          class="ui-input-sm w-full max-w-[200px] max-[640px]:max-w-none" />
        <button type="button" data-tour="recipes-new" class="ui-btn-primary shrink-0 max-[640px]:w-full" @click="openAddRecipeModal">Nueva receta</button>
      </div>
    </div>

    <ErrorMessage v-if="dataError" :message="dataError" />

    <template v-else>
      <div v-if="lowStockIngredients.length > 0" data-tour="recipes-lowstock" class="rounded-box border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/25 dark:bg-amber-500/10">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="text-sm font-semibold text-amber-800 dark:text-amber-300">Ingredientes con stock bajo</p>
            <div class="mt-2 flex flex-wrap gap-1.5">
              <span v-for="ing in lowStockIngredients" :key="ing.id"
                class="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-800 dark:bg-stone-800 dark:text-amber-300">
                <span class="h-1.5 w-1.5 shrink-0 rounded-full" :class="ing.stockPercent <= 25 ? 'bg-red-600' : 'bg-amber-500'"></span>
                {{ ing.name }}
              </span>
            </div>
          </div>
          <button type="button" class="ui-btn-outline shrink-0" @click="router.push('/ingredients')">Revisar inventario</button>
        </div>
      </div>

      <div data-tour="recipes-filters" class="flex flex-wrap gap-1.5">
        <button type="button" :class="activeChip === 'all' ? 'ui-chip-active' : 'ui-chip'" @click="activeChip = 'all'">
          Todas · <span class="tabular-nums">{{ recipes.length }}</span>
        </button>
        <button type="button" :class="activeChip === 'highMargin' ? 'ui-chip-active' : 'ui-chip'" @click="activeChip = 'highMargin'">
          Margen alto · <span class="tabular-nums">{{ highMarginCount }}</span>
        </button>
        <button type="button" :class="activeChip === 'incomplete' ? 'ui-chip-active' : 'ui-chip'" @click="activeChip = 'incomplete'">
          Datos incompletos · <span class="tabular-nums">{{ incompleteCount }}</span>
        </button>
      </div>

      <div v-if="dataLoading" class="grid gap-5" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
        <div v-for="n in 3" :key="n" class="ui-card p-5">
          <div class="ui-skeleton h-5 w-2/3" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.15}s infinite` }"></div>
          <div class="ui-skeleton mt-2 h-3 w-2/5" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.15}s infinite` }"></div>
          <div class="ui-skeleton mt-6 h-9 w-1/3" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.15}s infinite` }"></div>
          <div class="ui-skeleton mt-4 h-2 w-full rounded-full" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.15}s infinite` }"></div>
          <div class="ui-skeleton mt-6 h-10 w-full" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.15}s infinite` }"></div>
        </div>
      </div>

      <div v-else-if="recipes.length === 0" data-tour="recipes-empty" class="ui-empty">
        <h3 class="text-base font-semibold text-stone-700 dark:text-stone-200">Aún no tienes recetas</h3>
        <p class="mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">
          Crea tu primera receta para empezar a calcular precios y registrar producción. Si vas a usarla necesitarás
          ingredientes cargados en el inventario.
        </p>
        <div class="mt-5 flex flex-wrap items-center justify-center gap-2">
          <button type="button" class="ui-btn-primary" @click="openAddRecipeModal">Crear receta</button>
          <button type="button" class="ui-btn-outline" @click="router.push('/ingredients')">Añadir ingredientes</button>
        </div>
      </div>

      <div v-else-if="filteredRecipes.length === 0" class="ui-empty">
        <h3 class="text-base font-semibold text-stone-700 dark:text-stone-200">Ninguna receta coincide</h3>
        <p class="mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">Prueba otro filtro o término de búsqueda.</p>
      </div>

      <TransitionGroup v-else tag="div" name="card-list" class="grid gap-5" style="grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));">
        <RecipeCard v-for="(recipe, index) in filteredRecipes" :key="recipe.id" :recipe="recipe" :globalIngredients="globalIngredients"
          :data-tour="index === 0 ? 'recipes-card' : null"
          @delete-recipe="requestDeleteRecipeConfirmation" @edit-recipe="openEditRecipeModal(recipe)" />
      </TransitionGroup>
    </template>

    <AddRecipeModal :show="isAddModalOpen" @close="closeAddRecipeModal" @add="handleAddRecipe" />

    <RecipeDrawer :show="isEditModalOpen" :recipe="editingRecipe"
      :globalIngredients="globalIngredients" @close="closeEditRecipeModal" @save="handleSaveRecipe" />

    <ConfirmationModal :show="showDeleteRecipeModal" eyebrow="Eliminar receta" title="¿Eliminar receta?"
      :message="`Esta acción no se puede deshacer.`" :confirm-phrase="recipeToDeleteName"
      confirm-button-text="Sí, eliminar receta" @close="cancelRecipeDeletion" @confirm="confirmRecipeDeletion" />
  </div>
</template>
