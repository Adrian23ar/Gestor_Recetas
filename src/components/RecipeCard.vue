<script setup>
import { computed } from 'vue';
import { formatCurrency } from '../utils/utils.js';

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

function handleEdit() {
  emit('edit-recipe', props.recipe);
}

const displayInfo = computed(() => {
  if (!props.recipe || !props.globalIngredients || !Array.isArray(props.recipe.ingredients)) { return "Datos incompletos."; }
  let totalIngredientCost = 0;
  let calculationPossible = true;
  let hasIngredients = props.recipe.ingredients.length > 0;
  props.recipe.ingredients.forEach(recipeIng => {
    const globalIng = props.globalIngredients.find(g => g.id === recipeIng.ingredientId);
    if (globalIng && globalIng.presentationSize > 0) {
      const costPerBaseUnit = globalIng.cost / globalIng.presentationSize;
      totalIngredientCost += costPerBaseUnit * recipeIng.quantity;
    } else { calculationPossible = false; }
  });
  if (!hasIngredients) { return "Sin ingredientes."; }
  if (!calculationPossible) { return "Faltan datos."; }
  const packagingCost = Number(props.recipe.packagingCostPerBatch || 0);
  const laborCost = Number(props.recipe.laborCostPerBatch || 0);
  const items = Number(props.recipe.itemsPerBatch || 1);
  const profitMargin = Number(props.recipe.profitMarginPercent || 0);
  const lossBuffer = Number(props.recipe.lossBufferPercent || 0);
  if (items <= 0) { return "Items/Lote > 0."; }
  const totalBatchCost = totalIngredientCost + packagingCost + laborCost;
  const costPerItem = totalBatchCost / items;
  const sellingPrice = costPerItem * (1 + profitMargin / 100);
  const finalPrice = sellingPrice * (1 + lossBuffer / 100);
  return `PVP Final: ${formatCurrency(finalPrice)}`;
});

</script>

<template>
  <div class="bg-stone-100 rounded-lg shadow-md p-4 flex flex-col justify-between
              transition-all duration-300 ease-in-out
              hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02]
              dark:bg-dark-contrast dark:shadow-xl dark:hover:shadow-2xl">
    <div class="flex-grow">
      <h2 class="text-lg font-semibold text-primary-800 mb-1
                 dark:text-dark-primary-200">{{ recipe.name }}</h2>
      <p class="text-secondary-700 text-sm font-semibold mb-2
                dark:text-dark-secondary-300">
        {{ displayInfo }}
      </p>
      <div class="space-y-0.5 text-xs text-text-muted
                  dark:text-dark-text-muted">
        <p>Items por Lote: {{ recipe.itemsPerBatch || 1 }}</p>
        <p>Ganancia: {{ recipe.profitMarginPercent || 0 }}% | Buffer: {{ recipe.lossBufferPercent || 0 }}%</p>
      </div>
    </div>

    <div class="mt-4 pt-3 border-t border-neutral-200 flex justify-end space-x-2
                dark:border-dark-neutral-700">
      <button @click="handleEdit"
        class="px-3 py-1 cursor-pointer bg-secondary-600 text-white text-xs font-medium rounded hover:bg-secondary-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-secondary-500 transition-all dark:bg-dark-secondary-600 dark:text-dark-text-base dark:hover:bg-dark-secondary-700 dark:focus:ring-dark-secondary-600 dark:focus:ring-offset-dark-contrast">
        Detalles
      </button>
      <button @click="$emit('delete-recipe', recipe.id)"
        class="px-3 py-1 cursor-pointer bg-danger-600 text-white text-xs font-medium rounded hover:bg-danger-700 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-danger-500 transition-colors duration-200 dark:bg-danger-700 dark:text-dark-text-base dark:hover:bg-danger-800 dark:focus:ring-danger-600 dark:focus:ring-offset-dark-contrast">
        Eliminar
      </button>
    </div>
  </div>
</template>