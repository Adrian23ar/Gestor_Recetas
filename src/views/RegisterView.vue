<script setup>
import { ref, computed } from 'vue';
import Multiselect from '@vueform/multiselect';
import TableRegister from '../components/TableRegister.vue';
import ConfirmationModal from '../components/ConfirmationModal.vue';
import EditProductionModal from '../components/EditProductionModal.vue';
import { useProductionRecords } from '../composables/useProductionRecords.js';
import { formatCurrency } from '../utils/utils.js';

const {
  productionRecords,
  recipes,
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

const selectedRecipeId = ref(null);
const productionDate = ref('');

const selectedRecipeInfo = computed(() => {
  if (!selectedRecipeId.value) return null;
  const recipe = recipes.value.find(r => r.id === selectedRecipeId.value);
  if (!recipe) return null;
  const gastosOp = recipe.calculatedRecipeOnlyCost !== undefined ? formatCurrency(recipe.calculatedRecipeOnlyCost) : 'N/A';
  const manoDeObra = recipe.laborCostPerBatch !== undefined ? formatCurrency(recipe.laborCostPerBatch) : 'N/A';
  return `Lote: ${recipe.itemsPerBatch || 'N/A'} items | PVP Final: ${formatCurrency(recipe.calculatedFinalPrice || 0)} | Gastos Op. (Ingr.+Emp.): ${gastosOp} | Mano Obra: ${manoDeObra}`;
});

async function handleAddRecord() {
  const success = await addRecord(selectedRecipeId.value, productionDate.value);
  if (success) {
    selectedRecipeId.value = null;
    productionDate.value = '';
  }
}

function handleDeleteRecord(record) {
  openDeleteModal(record);
}

function cancelDelete() {
  closeDeleteModal();
}

async function confirmDeleteRecord() {
  await confirmDelete();
}

function handleEditRecord(record) {
  openEditModal(record);
}

function handleCloseEditModal() {
  closeEditModal();
}

async function handleSaveChanges(updatedRecord) {
  await saveChanges(updatedRecord);
}
</script>

<template>
  <div class="space-y-8 mt-4">
    <div class="bg-contrast p-6 rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
      <form @submit.prevent="handleAddRecord" class="space-y-4">
        <div class="grid grid-cols-2 gap-8">
          <div class="col-span-2 md:col-span-1">
            <label for="select-recipe" class="block text-sm font-medium text-text-base dark:text-dark-text-base">Receta Producida:</label>
            <Multiselect
              id="select-recipe"
              v-model="selectedRecipeId"
              :options="recipes"
              placeholder="-- Selecciona una receta --"
              :searchable="true"
              valueProp="id"
              label="name"
              trackBy="name"
              :clearOnSelect="false"
              :closeOnSelect="true"
              required
              :classes="{
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
              }"
            >
              <template #option="{ option }">
                <div>{{ option.name }}</div>
                <div class="text-xs text-text-muted dark:text-dark-text-muted ml-2">
                  (Lote: {{ option.itemsPerBatch || 'N/A' }} | PVP: {{ formatCurrency(option.calculatedFinalPrice || 0) }})
                </div>
              </template>
            </Multiselect>
            <p v-if="selectedRecipeInfo" class="ps-0.5 mt-1 text-xs text-text-muted dark:text-dark-text-muted">
              {{ selectedRecipeInfo }}
            </p>
          </div>

          <div class="col-span-2 md:col-span-1">
            <label for="production-date" class="block text-sm font-medium text-text-base dark:text-dark-text-base">Fecha Producción:</label>
            <input
              type="date"
              id="production-date"
              v-model="productionDate"
              required
              class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:text-dark-text-base dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400"
            />
          </div>
        </div>
        <div class="text-right">
          <button
            type="submit"
            :disabled="loading"
            class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-medium rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-background transition-all"
          >
            {{ loading ? 'Registrando...' : 'Registrar y Descontar Stock' }}
          </button>
        </div>
      </form>
    </div>

    <div class="col-span-2 bg-contrast rounded-lg shadow dark:bg-dark-contrast dark:shadow-lg">
      <h2 class="text-xl px-6 pt-6 pb-4 font-semibold mb-4 text-primary-800 dark:text-dark-primary-200">Historial de Producción</h2>
      <div v-if="dataLoading" class="text-center text-text-muted italic dark:text-dark-text-muted">Cargando registros...</div>
      <div v-else-if="dataError" class="text-center text-danger-600 font-medium dark:text-danger-400">Error: {{ dataError }}</div>
      <TableRegister
        v-else
        :records="productionRecords"
        @edit-record="handleEditRecord"
        @delete-record="handleDeleteRecord"
      />
    </div>

    <ConfirmationModal
      :show="showDeleteModal"
      title="Confirmar Eliminación"
      :message="`¿Eliminar registro de '${recordToDelete?.productName || ''}'?`"
      @close="cancelDelete"
      @confirm="confirmDeleteRecord"
    />

    <EditProductionModal
      :show="showEditModal"
      :record="editingRecord"
      @close="handleCloseEditModal"
      @save="handleSaveChanges"
    />
  </div>
</template>
