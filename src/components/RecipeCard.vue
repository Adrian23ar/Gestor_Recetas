<script setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { formatCurrency } from '../utils/utils.js';
import { useRecipeCosts } from '../composables/useRecipeCosts.js';

const props = defineProps({
  recipe: {
    type: Object,
    required: true
  },
  globalIngredients: {
    type: Array,
    required: true
  }
});

const emit = defineEmits(['delete-recipe', 'edit-recipe']);
const router = useRouter();

const costs = useRecipeCosts(() => props.recipe, () => props.globalIngredients);
const ingredientCount = computed(() => (Array.isArray(props.recipe.ingredients) ? props.recipe.ingredients.length : 0));
const isHighMargin = computed(() => Number(props.recipe.profitMarginPercent || 0) >= 45);

function handleEdit() {
  emit('edit-recipe', props.recipe);
}

function handleProduce() {
  router.push({ path: '/register', query: { recipe: props.recipe.id } });
}
</script>

<template>
  <div class="ui-card flex flex-col p-5">
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <h2 class="truncate text-[17px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">{{ recipe.name }}</h2>
        <p class="mt-0.5 truncate text-xs text-stone-400">
          <span class="tabular-nums">{{ recipe.itemsPerBatch || 1 }}</span> items por lote ·
          <span class="tabular-nums">{{ ingredientCount }}</span> ingredientes
        </p>
      </div>
      <span v-if="costs.isComplete" :class="isHighMargin ? 'ui-badge-success' : 'ui-badge-neutral'" class="shrink-0">
        <span class="tabular-nums">{{ Math.round(recipe.profitMarginPercent || 0) }}</span>% margen
      </span>
      <span v-else class="ui-badge-danger shrink-0">Incompleta</span>
    </div>

    <template v-if="costs.isComplete">
      <div class="mt-4">
        <p class="text-xs font-medium text-stone-400">PVP final por item</p>
        <p class="text-[34px] font-semibold tabular-nums tracking-[-0.03em] text-stone-800 dark:text-stone-100">
          {{ formatCurrency(costs.finalPrice) }}
        </p>
        <p class="text-xs tabular-nums text-stone-400">costo {{ formatCurrency(costs.totalCostPerIndividualItem) }}</p>
      </div>

      <div class="mt-4">
        <div class="flex h-2 w-full overflow-hidden rounded-full bg-stone-100 dark:bg-stone-700">
          <span class="h-full bg-stone-800 dark:bg-stone-500" :style="{ width: (costs.breakdown.ingredientsPct * 100) + '%' }"></span>
          <span class="h-full bg-stone-400" :style="{ width: (costs.breakdown.laborPct * 100) + '%' }"></span>
          <span class="h-full bg-amber-500" :style="{ width: (costs.breakdown.profitPct * 100) + '%' }"></span>
        </div>
        <div class="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-stone-500 dark:text-stone-400">
          <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-[2px] bg-stone-800 dark:bg-stone-500"></span>Ingredientes</span>
          <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-[2px] bg-stone-400"></span>Mano de obra</span>
          <span class="flex items-center gap-1.5"><span class="h-1.5 w-1.5 rounded-[2px] bg-amber-500"></span>Ganancia</span>
        </div>
      </div>

      <div class="mt-5 flex items-center gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
        <button type="button" class="ui-btn-dark flex-1" @click="handleEdit">Ver receta</button>
        <button type="button" class="ui-btn-primary flex-1" @click="handleProduce">Producir</button>
        <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-recipe', recipe.id)">Eliminar</button>
      </div>
    </template>

    <template v-else>
      <div class="ui-panel mt-4 p-3.5">
        <p class="text-xs font-semibold text-stone-600 dark:text-stone-300">Faltan datos para calcular el precio:</p>
        <ul class="mt-1.5 space-y-0.5 text-xs text-stone-500 dark:text-stone-400">
          <li v-if="costs.missingIngredients.length === 0">Añade al menos un ingrediente y define items por lote.</li>
          <li v-for="missing in costs.missingIngredients" :key="missing.id">{{ missing.name }}</li>
        </ul>
      </div>
      <div class="mt-5 flex items-center gap-2 border-t border-stone-100 pt-4 dark:border-stone-800">
        <button type="button" class="ui-btn-outline flex-1" @click="handleEdit">Completar datos</button>
        <button type="button" class="ui-btn-danger-ghost" @click="emit('delete-recipe', recipe.id)">Eliminar</button>
      </div>
    </template>
  </div>
</template>
