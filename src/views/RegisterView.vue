<script setup>
import { ref, computed } from 'vue';
import { useRoute } from 'vue-router';
import Multiselect from '@vueform/multiselect';
import DateField from '../components/ui/DateField.vue';
import TableRegister from '../components/TableRegister.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditProductionModal from '../components/EditProductionModal.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import { useProductionRecords } from '../composables/useProductionRecords.js';
import { formatCurrency } from '../utils/utils.js';
import { multiselectTheme } from '../utils/multiselectTheme.js';
import { useViewTutorial } from '../composables/useTutorial.js';
import { productionTour } from '../utils/tourSteps.js';

const route = useRoute();

const {
  productionRecords,
  recipes,
  globalIngredients,
  dataLoading,
  dataError,
  loading,
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
} = useProductionRecords();

const selectedRecipeId = ref(typeof route.query.recipe === 'string' ? route.query.recipe : null);
const productionDate = ref(null);

const selectedRecipe = computed(() => recipes.value.find(r => r.id === selectedRecipeId.value) || null);

const selectedRecipeEstimate = computed(() => {
  const recipe = selectedRecipe.value;
  if (!recipe || recipe.calculatedFinalPrice === undefined) return null;
  const items = Number(recipe.itemsPerBatch) || 1;
  const totalRevenue = (recipe.calculatedFinalPrice || 0) * items;
  const operatingCost = Number(recipe.calculatedRecipeOnlyCost || 0);
  const laborCost = Number(recipe.laborCostPerBatch || 0);
  const netProfit = totalRevenue - (operatingCost + laborCost);
  const marginOnRevenue = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  return { totalRevenue, operatingCost, laborCost, netProfit, marginOnRevenue };
});

const stockDeductions = computed(() => {
  const recipe = selectedRecipe.value;
  if (!recipe || !Array.isArray(recipe.ingredients)) return [];
  return recipe.ingredients
    .map(recipeIng => {
      const globalIng = globalIngredients.value.find(g => g.id === recipeIng.ingredientId);
      if (!globalIng) return null;
      const currentStock = Number(globalIng.currentStock) || 0;
      const remaining = currentStock - Number(recipeIng.quantity);
      return {
        id: recipeIng.ingredientId,
        name: globalIng.name,
        quantity: recipeIng.quantity,
        unit: globalIng.unit,
        remaining: Math.max(0, remaining),
        insufficient: remaining < 0,
      };
    })
    .filter(Boolean);
});

useViewTutorial(
  {
    id: 'produccion',
    getSteps: () => productionTour({
      hasRecipeSelected: !!selectedRecipeEstimate.value,
      hasRecords: productionRecords.value.length > 0,
    }),
  },
  () => !dataLoading.value && !dataError.value,
);

async function handleAddRecord() {
  const success = await addRecord(selectedRecipeId.value, productionDate.value);
  if (success) {
    selectedRecipeId.value = null;
    productionDate.value = null;
  }
}

function handleDeleteRecord(record) {
  openDeleteModal(record);
}

async function confirmDeleteRecord() {
  await confirmDelete();
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="ui-h1">Producción</h1>
      <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Registra un lote y descuenta el stock automáticamente</p>
    </div>

    <ErrorMessage v-if="dataError" :message="`Error: ${dataError}`" />

    <template v-else>
      <div class="grid grid-cols-[1.15fr_.85fr] items-start gap-5 max-[980px]:grid-cols-1">
        <div class="ui-card p-5">
          <h2 class="text-base font-semibold text-stone-800 dark:text-stone-100">Nuevo lote</h2>
          <form class="mt-4 space-y-4" @submit.prevent="handleAddRecord">
            <div data-tour="production-recipe">
              <label class="ui-label" for="select-recipe">Receta a producir</label>
              <Multiselect id="select-recipe" v-model="selectedRecipeId" :options="recipes" placeholder="-- Selecciona una receta --"
                :searchable="true" valueProp="id" label="name" trackBy="name" :clearOnSelect="false" :closeOnSelect="true"
                :classes="multiselectTheme">
                <template #option="{ option }">
                  <div>{{ option.name }}
                    <span class="text-xs text-stone-400">(Lote: {{ option.itemsPerBatch || 'N/A' }} | PVP: {{ formatCurrency(option.calculatedFinalPrice || 0) }})</span>
                  </div>
                </template>
              </Multiselect>
            </div>

            <div data-tour="production-date" class="grid grid-cols-2 gap-3">
              <div>
                <label class="ui-label" for="production-date">Fecha de producción</label>
                <DateField id="production-date" v-model="productionDate" />
              </div>
              <div>
                <label class="ui-label">Items del lote</label>
                <input :value="selectedRecipe?.itemsPerBatch ?? '—'" type="text" readonly disabled
                  class="ui-input cursor-not-allowed opacity-70" />
              </div>
            </div>

            <div v-if="stockDeductions.length > 0" data-tour="production-deductions" class="rounded-box border border-amber-200 bg-amber-50 p-3.5 dark:border-amber-500/25 dark:bg-amber-500/10">
              <p class="text-xs font-semibold text-amber-800 dark:text-amber-300">Al registrar se descontará del inventario:</p>
              <ul class="mt-1.5 space-y-1 text-xs text-amber-700 dark:text-amber-400">
                <li v-for="d in stockDeductions" :key="d.id">
                  {{ d.quantity }} {{ d.unit }} de {{ d.name }} — quedará en
                  <strong class="tabular-nums" :class="d.insufficient ? 'text-red-700 dark:text-red-400' : ''">{{ d.remaining }} {{ d.unit }}</strong>
                </li>
              </ul>
            </div>

            <button type="submit" data-tour="production-submit" :disabled="loading || !selectedRecipeId || !productionDate"
              :class="(loading || !selectedRecipeId || !productionDate) ? 'ui-btn-disabled w-full' : 'ui-btn-primary w-full'">
              {{ loading ? 'Registrando…' : 'Registrar lote y descontar stock' }}
            </button>
          </form>
        </div>

        <div data-tour="production-estimate" class="ui-card-inverted rounded-card p-6">
          <template v-if="selectedRecipeEstimate">
            <p class="text-sm text-stone-300">Ganancia neta estimada</p>
            <p class="mt-1 text-[36px] font-semibold tabular-nums tracking-[-0.03em]">{{ formatCurrency(selectedRecipeEstimate.netProfit) }}</p>
            <dl class="mt-5 space-y-2.5 border-t ui-card-inverted-divider pt-4 text-sm">
              <div class="flex items-center justify-between">
                <dt class="text-stone-300">Ingreso total</dt>
                <dd class="tabular-nums">{{ formatCurrency(selectedRecipeEstimate.totalRevenue) }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-stone-300">Gastos op. (ingr.+emp.)</dt>
                <dd class="tabular-nums">{{ formatCurrency(selectedRecipeEstimate.operatingCost) }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-stone-300">Mano de obra</dt>
                <dd class="tabular-nums">{{ formatCurrency(selectedRecipeEstimate.laborCost) }}</dd>
              </div>
              <div class="flex items-center justify-between">
                <dt class="text-stone-300">Margen sobre ingreso</dt>
                <dd class="tabular-nums">{{ selectedRecipeEstimate.marginOnRevenue.toFixed(1) }}%</dd>
              </div>
            </dl>
          </template>
          <div v-else class="flex min-h-[220px] items-center justify-center text-center text-sm text-stone-400">
            Selecciona una receta para ver la estimación de ganancia.
          </div>
        </div>
      </div>

      <TableRegister data-tour="production-table" :records="productionRecords" :loading="dataLoading" @edit-record="openEditModal" @delete-record="handleDeleteRecord" />
    </template>

    <ConfirmationModal :show="showDeleteModal" eyebrow="Eliminar registro" title="¿Eliminar registro?"
      :message="`¿Eliminar el registro de producción de '${recordToDelete?.productName || ''}'?`"
      confirm-button-text="Sí, eliminar" @close="closeDeleteModal" @confirm="confirmDeleteRecord" />

    <EditProductionModal :show="showEditModal" :record="editingRecord" @close="closeEditModal" @save="saveChanges" />
  </div>
</template>
