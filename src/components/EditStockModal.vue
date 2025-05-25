<script setup>
import { ref, watch, defineProps, defineEmits } from 'vue';
import { useToast } from "vue-toastification";

const props = defineProps({
  show: { type: Boolean, required: true },
  ingredient: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save']);

const newStockValue = ref(null);
const toast = useToast();

// Actualiza el input cuando cambia el ingrediente o el modal se abre/cierra
watch(() => props.ingredient, (currentIngredient) => {
  if (props.show && currentIngredient) {
    newStockValue.value = currentIngredient.currentStock !== undefined ? Number(currentIngredient.currentStock) : 0;
  } else if (!props.show) {
    newStockValue.value = null;
  }
}, { immediate: true });

watch(() => props.show, (val) => {
  if (val && props.ingredient) {
    newStockValue.value = Number(props.ingredient.currentStock) || 0;
  }
});

function closeModal() {
  emit('close');
}

function saveStockChange() {
  if (newStockValue.value === null || isNaN(newStockValue.value) || newStockValue.value < 0) {
    toast.warning('Por favor, ingresa un valor de stock válido (número mayor o igual a cero).');
    return;
  }
  emit('save', newStockValue.value);
}

</script>

<template>
  <Transition name="modal-transition">
    <div v-if="show && ingredient" @click.self="closeModal"
      class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-10">
      <div class="modal-content relative mx-auto p-6 border border-neutral-300 w-full max-w-sm shadow-lg rounded-md bg-contrast
                  dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
        <div class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4
                      dark:border-dark-neutral-700">
          <h3 class="text-xl font-semibold text-primary-800 dark:text-dark-primary-200">
            Editar Stock de: <span class="text-accent-600 dark:text-dark-accent-300">{{ ingredient?.name }}</span>
          </h3>
          <button @click="closeModal" class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold
                         dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
        </div>

        <form @submit.prevent="saveStockChange" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-text-muted dark:text-dark-text-muted">Stock Actual:</label>
            <p class="mt-1 text-base text-text-base dark:text-dark-text-base">
              {{ ingredient?.currentStock !== undefined ? ingredient.currentStock : 'N/A' }} {{ ingredient?.unit || ''
              }}
            </p>
          </div>
          <hr class="border-neutral-200 dark:border-dark-neutral-700" />
          <div>
            <label :for="'edit-stock-value-' + ingredient?.id"
              class="block text-sm font-medium text-text-base dark:text-dark-text-base">
              Nuevo Stock Total (en {{ ingredient?.unit || '' }}):
            </label>
            <input :id="'edit-stock-value-' + ingredient?.id" type="number" v-model.number="newStockValue" required
              min="0" step="any" placeholder="Ej: 800" class="mt-1 block w-full px-3 py-2 border border-neutral-300 rounded-md shadow-sm focus:outline-none focus:ring-accent-500 focus:border-accent-500 sm:text-sm
                          dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base
                          dark:focus:ring-dark-accent-400 dark:focus:border-dark-accent-400" />
          </div>

          <div class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3
                      dark:border-dark-neutral-700">
            <button type="button" @click="closeModal" class="px-4 py-2 cursor-pointer bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400
                     dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
              Cancelar
            </button>
            <button type="submit"
              class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500
                     dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
              Actualizar Stock
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>
