<script setup>
import { ref, computed, watch } from 'vue';

const props = defineProps({
  show: { type: Boolean, required: true },
  ingredient: { type: Object, default: null }
});

const emit = defineEmits(['close', 'save']);

const newStockValue = ref(null);
const touched = ref(false);

watch([() => props.show, () => props.ingredient], ([show, ingredient]) => {
  if (show && ingredient) {
    newStockValue.value = Number(ingredient.currentStock) || 0;
    touched.value = false;
  }
}, { immediate: true });

const stockPercent = computed(() => {
  if (!props.ingredient) return null;
  const size = Number(props.ingredient.presentationSize) || 0;
  if (size <= 0) return null;
  return (Number(props.ingredient.currentStock) || 0) / size * 100;
});

const stockTone = computed(() => {
  if (stockPercent.value === null) return 'ui-badge-neutral';
  if (stockPercent.value <= 25) return 'ui-badge-danger';
  if (stockPercent.value <= 60) return 'ui-badge-warning';
  return 'ui-badge-success';
});

const difference = computed(() => {
  if (!props.ingredient || newStockValue.value === null || isNaN(newStockValue.value)) return 0;
  return newStockValue.value - (Number(props.ingredient.currentStock) || 0);
});

const errorMessage = computed(() => {
  if (newStockValue.value === null || newStockValue.value === '' || isNaN(newStockValue.value)) {
    return 'Ingresa un valor de stock.';
  }
  if (newStockValue.value < 0) return 'El stock no puede ser negativo.';
  return null;
});

function addToStock(amount) {
  newStockValue.value = (Number(newStockValue.value) || 0) + amount;
  touched.value = true;
}

function setToPresentation() {
  newStockValue.value = Number(props.ingredient?.presentationSize) || 0;
  touched.value = true;
}

function closeModal() {
  emit('close');
}

function saveStockChange() {
  touched.value = true;
  if (errorMessage.value) return;
  emit('save', newStockValue.value); // Number crudo — IngredientsView reconstruye el objeto
}
</script>

<template>
  <Transition name="modal-transition">
    <div v-if="show && ingredient" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
      <div class="ui-modal-box modal-content max-w-sm">
        <div class="flex items-start justify-between gap-4">
          <div class="min-w-0">
            <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Stock</p>
            <h3 class="mt-0.5 truncate text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
              {{ ingredient?.name }}
            </h3>
          </div>
          <button type="button" @click="closeModal" aria-label="Cerrar"
            class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
            &times;
          </button>
        </div>

        <form class="mt-5 space-y-4" @submit.prevent="saveStockChange">
          <div class="ui-panel flex items-center justify-between px-3.5 py-3">
            <div>
              <p class="ui-label !mb-1">Stock actual</p>
              <p class="text-[22px] font-semibold tabular-nums text-stone-800 dark:text-stone-100">
                {{ ingredient?.currentStock }} <span class="text-sm font-normal text-stone-400">{{ ingredient?.unit }}</span>
              </p>
            </div>
            <span v-if="stockPercent !== null" :class="stockTone">{{ Math.round(stockPercent) }}%</span>
          </div>

          <div>
            <label class="ui-label" :for="'edit-stock-value-' + ingredient?.id">
              Nuevo stock total (en {{ ingredient?.unit || '' }})
            </label>
            <input :id="'edit-stock-value-' + ingredient?.id" v-model.number="newStockValue" type="number" min="0"
              step="any" placeholder="Ej: 800" :class="['ui-input', errorMessage && touched && 'ui-input-error']"
              @blur="touched = true" />
            <p v-if="errorMessage && touched" class="mt-1 text-xs text-red-600 dark:text-red-400">{{ errorMessage }}</p>
          </div>

          <div class="flex flex-wrap gap-1.5">
            <button type="button" @click="addToStock(100)"
              class="cursor-pointer rounded-chip border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              +100
            </button>
            <button type="button" @click="addToStock(250)"
              class="cursor-pointer rounded-chip border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              +250
            </button>
            <button type="button" @click="addToStock(500)"
              class="cursor-pointer rounded-chip border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              +500
            </button>
            <button type="button" @click="setToPresentation"
              class="cursor-pointer rounded-chip border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:border-stone-300 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300">
              1 pres.
            </button>
          </div>

          <p class="text-xs text-stone-500 dark:text-stone-400">
            Diferencia registrada en el historial:
            <span class="font-semibold tabular-nums" :class="difference > 0 ? 'text-emerald-600 dark:text-emerald-400' : difference < 0 ? 'text-red-600 dark:text-red-400' : ''">
              {{ difference > 0 ? '+' : '' }}{{ difference }}
            </span>
          </p>

          <div class="mt-2 flex items-center justify-between gap-3">
            <button type="button" @click="closeModal" class="ui-btn-outline">Cancelar</button>
            <button type="submit" :class="errorMessage && touched ? 'ui-btn-disabled' : 'ui-btn-primary'">
              Actualizar stock
            </button>
          </div>
        </form>
      </div>
    </div>
  </Transition>
</template>
