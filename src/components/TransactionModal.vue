<script setup>
// src/components/TransactionModal.vue
import { ref, watch, computed, nextTick } from 'vue';
import { useAccountingDataStore } from '../stores/accountingData';
import DateField from './ui/DateField.vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'vue-toastification';

const props = defineProps({
    show: { type: Boolean, required: true },
    transactionData: { type: Object, default: null },
});
const emit = defineEmits(['close', 'save']);
const toast = useToast();

const accountingStore = useAccountingDataStore();

// Estado (refs) que usas en el script/template
const { specificDateRateError } = storeToRefs(accountingStore);

// Acciones (funciones)
const {
    getRateForExactDate,
    getLatestRateDataBefore,
    fetchRateForSpecificDateFromAPI,
    updateDailyRate
} = accountingStore;

// --- Estado para manejar la elección de tasa obsoleta ---
const showStaleRateChoice = ref(false);
const staleRateInfo = ref(null);

const showManualRateInput = ref(false);
const manualRateInput = ref(null);

const defaultFormData = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localTodayString = `${year}-${month}-${day}`;

    return {
        id: null,
        type: 'income',
        date: localTodayString,
        description: '',
        category: '',
        amountBs: null,
        exchangeRate: null,
        amountUsd: 0,
        notes: '',
    };
};

const formData = ref(defaultFormData());
const applicableRate = ref(null);
const rateErrorMessageForModal = ref('');
const isRateLoadingInModal = ref(false);
const actualDateOfRate = ref(null);
const dateChangeDebounceTimer = ref(null);

const isEditing = computed(() => !!props.transactionData?.id);

watch(() => props.show, async (newShow) => {
    if (newShow) {
        // Limpiar todo al abrir
        clearTimeout(dateChangeDebounceTimer.value);
        rateErrorMessageForModal.value = '';
        actualDateOfRate.value = null;
        if (specificDateRateError) specificDateRateError.value = null;
        isRateLoadingInModal.value = false;
        showManualRateInput.value = false;
        manualRateInput.value = null;
        showStaleRateChoice.value = false;
        staleRateInfo.value = null;

        if (props.transactionData) {
            formData.value = JSON.parse(JSON.stringify(props.transactionData));
            formData.value.amountBs = Number(formData.value.amountBs);
            if (formData.value.date) {
                await attemptFetchRateForSelectedDate(formData.value.date, true);
            }
        } else {
            formData.value = defaultFormData();
            if (formData.value.date) {
                await attemptFetchRateForSelectedDate(formData.value.date, false);
            }
        }
        nextTick(() => document.getElementById('tx-description')?.focus());
    } else {
        // Limpieza completa al cerrar
        formData.value = defaultFormData();
        applicableRate.value = null;
        rateErrorMessageForModal.value = '';
        isRateLoadingInModal.value = false;
        actualDateOfRate.value = null;
        showManualRateInput.value = false;
        showStaleRateChoice.value = false;
        staleRateInfo.value = null;
        clearTimeout(dateChangeDebounceTimer.value);
    }
});

watch(() => formData.value.date, (newDate, oldDate) => {
    clearTimeout(dateChangeDebounceTimer.value);

    if (newDate && newDate !== oldDate) {
        showManualRateInput.value = false;
        manualRateInput.value = null;
        showStaleRateChoice.value = false;
        staleRateInfo.value = null;
        actualDateOfRate.value = null;
        applicableRate.value = null;
        isRateLoadingInModal.value = true;
        rateErrorMessageForModal.value = '';
        dateChangeDebounceTimer.value = setTimeout(async () => {
            await attemptFetchRateForSelectedDate(newDate, false);
        }, 500);
    } else if (!newDate) {
        applicableRate.value = null;
        formData.value.exchangeRate = null;
        formData.value.amountUsd = 0;
        actualDateOfRate.value = null;
        rateErrorMessageForModal.value = 'Selecciona una fecha válida.';
        isRateLoadingInModal.value = false;
    }
});

// Cascada de resolución de tasa: API -> exacta guardada -> anterior con elección -> manual.
// INVARIANTE: no tocar esta lógica, sólo el maquetado del modal.
async function attemptFetchRateForSelectedDate(selectedDate) {
    isRateLoadingInModal.value = true;
    rateErrorMessageForModal.value = '';
    actualDateOfRate.value = null;
    applicableRate.value = null;
    showManualRateInput.value = false;
    showStaleRateChoice.value = false;
    staleRateInfo.value = null;
    if (specificDateRateError) specificDateRateError.value = null;

    // 1. Intento API
    const apiResult = await fetchRateForSpecificDateFromAPI(selectedDate);
    if (apiResult && apiResult.rate) {
        applyRate(apiResult.rate, apiResult.dateFound, `Tasa de API para ${formatDate(apiResult.dateFound)} aplicada.`);
        isRateLoadingInModal.value = false;
        return;
    }

    // 2. Fallo API -> Intento Local Exacto
    const exactRate = getRateForExactDate(selectedDate);
    if (exactRate) {
        applyRate(exactRate, selectedDate, "API no disponible. Se usó la tasa guardada para esta fecha.");
        isRateLoadingInModal.value = false;
        return;
    }

    // 3. Fallo Exacto -> Buscar cualquier tasa anterior
    const latestRateData = getLatestRateDataBefore(selectedDate);
    if (latestRateData) {
        staleRateInfo.value = latestRateData;
        showStaleRateChoice.value = true;
        rateErrorMessageForModal.value = `No hay tasa para esta fecha. La última guardada es del ${formatDate(latestRateData.date)}.`;
    } else {
        // 4. Fallo Total -> No hay ninguna tasa anterior, pedir manual.
        rateErrorMessageForModal.value = "No se encontró ninguna tasa. Por favor, ingrésela manualmente.";
        showManualRateInput.value = true;
    }

    isRateLoadingInModal.value = false;
}

function handleUseStaleRate() {
    if (staleRateInfo.value) {
        const { rate, date } = staleRateInfo.value;
        applyRate(rate, date, `Tasa obsoleta del ${formatDate(date)} aplicada.`);
        showStaleRateChoice.value = false;
        rateErrorMessageForModal.value = '';
    }
}

function handleEnterManualInstead() {
    showStaleRateChoice.value = false;
    rateErrorMessageForModal.value = "Por favor, ingrese una tasa para el " + formatDate(formData.value.date);
    showManualRateInput.value = true;
}

function applyRate(rate, dateFound, message = '') {
    applicableRate.value = rate;
    formData.value.exchangeRate = rate;
    actualDateOfRate.value = dateFound;
    recalculateUsd();
    if (message) toast.success(message, { timeout: 4000 });
}

async function applyManualRate() {
    const rate = Number(manualRateInput.value);
    if (!rate || rate <= 0) {
        toast.error("Por favor, ingrese un número positivo para la tasa.");
        return;
    }
    applyRate(rate, formData.value.date, `Tasa manual (${rate}) aplicada.`);
    showManualRateInput.value = false;
    rateErrorMessageForModal.value = '';
    manualRateInput.value = null;

    await updateDailyRate(rate, formData.value.date);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function recalculateUsd() {
    if (formData.value.amountBs && applicableRate.value && applicableRate.value > 0) {
        formData.value.amountUsd = formData.value.amountBs / applicableRate.value;
    } else {
        formData.value.amountUsd = 0;
    }
}

watch(() => formData.value.amountBs, () => {
    if (applicableRate.value) {
        recalculateUsd();
    }
});

const closeModal = () => {
    clearTimeout(dateChangeDebounceTimer.value);
    emit('close');
};

const save = () => {
    if (!formData.value.description.trim()) {
        toast.warning("La descripción no puede estar vacía.");
        return;
    }
    if (!formData.value.amountBs || formData.value.amountBs <= 0) {
        toast.warning("El monto en Bs. debe ser mayor a cero.");
        return;
    }
    if (!applicableRate.value || applicableRate.value <= 0) {
        toast.error(rateErrorMessageForModal.value || "Falta la tasa de cambio o es inválida para la fecha seleccionada.");
        return;
    }
    const dataToSave = {
        ...formData.value,
        exchangeRate: applicableRate.value,
        amountUsd: parseFloat(amountUsdDisplay.value)
    };
    emit('save', dataToSave);
};

const amountUsdDisplay = computed(() => {
    if (formData.value.amountBs && applicableRate.value && applicableRate.value > 0) {
        return (formData.value.amountBs / applicableRate.value).toFixed(2);
    }
    return '0.00';
});

// INVARIANTE: no simplificar — el submit debe seguir deshabilitado en cualquiera de estos casos.
const isSubmitDisabled = computed(() =>
    isRateLoadingInModal.value || showStaleRateChoice.value || !applicableRate.value ||
    !formData.value.amountBs || formData.value.amountBs <= 0 || !formData.value.date || !formData.value.description
);
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show" class="ui-backdrop flex items-center justify-center p-4" @click.self="closeModal">
            <div class="ui-modal-box modal-content max-w-lg">
                <div class="flex items-start justify-between gap-4">
                    <div class="min-w-0">
                        <p class="text-[11px] font-semibold uppercase tracking-wide text-stone-400">Movimiento</p>
                        <h3 class="mt-0.5 text-[19px] font-semibold tracking-[-0.01em] text-stone-800 dark:text-stone-100">
                            {{ isEditing ? 'Editar movimiento' : 'Registrar movimiento' }}
                        </h3>
                    </div>
                    <button type="button" @click="closeModal" aria-label="Cerrar"
                        class="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-control text-2xl leading-none text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-600 dark:text-stone-500 dark:hover:bg-stone-700 dark:hover:text-stone-300">
                        &times;
                    </button>
                </div>

                <form class="mt-5 max-h-[75vh] space-y-4 overflow-y-auto pr-1" @submit.prevent="save">
                    <div class="ui-seg-track w-fit">
                        <button type="button" :class="formData.type === 'income' ? 'ui-seg-active' : 'ui-seg'" @click="formData.type = 'income'">
                            Ingreso
                        </button>
                        <button type="button" :class="formData.type === 'expense' ? 'ui-seg-active' : 'ui-seg'" @click="formData.type = 'expense'">
                            Egreso
                        </button>
                    </div>

                    <div class="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                        <div>
                            <label class="ui-label" for="tx-date">Fecha</label>
                            <DateField id="tx-date" v-model="formData.date" />
                            <p v-if="isRateLoadingInModal" class="mt-1 text-xs italic text-stone-400">Buscando tasa…</p>
                            <p v-else-if="rateErrorMessageForModal" class="mt-1 text-xs"
                                :class="showStaleRateChoice ? 'text-amber-700 dark:text-amber-400' : 'text-red-600 dark:text-red-400'">
                                {{ rateErrorMessageForModal }}
                            </p>
                        </div>
                        <div>
                            <label class="ui-label" for="tx-category">Categoría</label>
                            <input id="tx-category" v-model="formData.category" type="text" placeholder="Ej: Ventas, Materia prima" class="ui-input" />
                        </div>
                    </div>

                    <div>
                        <label class="ui-label" for="tx-description">Descripción</label>
                        <input id="tx-description" v-model="formData.description" type="text" required
                            placeholder="Ej: Venta torta, Compra harina" class="ui-input" />
                    </div>

                    <div>
                        <label class="ui-label" for="tx-amount-bs">Monto (Bs.)</label>
                        <input id="tx-amount-bs" v-model.number="formData.amountBs" type="number" required min="0.01" step="0.01" class="ui-input" />
                    </div>

                    <div class="ui-panel space-y-3 p-4">
                        <div>
                            <p class="ui-label !mb-1">Equivale a</p>
                            <p class="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-stone-800 dark:text-stone-100">
                                ${{ amountUsdDisplay }}
                            </p>
                            <p class="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                Tasa:
                                <span class="tabular-nums font-medium text-stone-700 dark:text-stone-300">
                                    {{ applicableRate ? applicableRate.toFixed(2) : (isRateLoadingInModal ? 'Buscando…' : 'N/A') }}
                                </span>
                                <span v-if="actualDateOfRate && actualDateOfRate !== formData.date && applicableRate">
                                    (BCV del {{ formatDate(actualDateOfRate) }})
                                </span>
                            </p>
                        </div>

                        <div v-if="showStaleRateChoice" class="rounded-box border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-500/25 dark:bg-amber-500/10">
                            <p class="text-xs text-amber-800 dark:text-amber-300">{{ rateErrorMessageForModal }}</p>
                            <div class="mt-2 flex flex-wrap justify-center gap-2">
                                <button type="button" @click.prevent="handleUseStaleRate" class="ui-btn-subtle">
                                    Usar esta tasa ({{ staleRateInfo.rate }})
                                </button>
                                <button type="button" @click.prevent="handleEnterManualInstead" class="ui-btn-outline">
                                    Ingresar manualmente
                                </button>
                            </div>
                        </div>

                        <div v-if="showManualRateInput && !isRateLoadingInModal && !showStaleRateChoice" class="flex items-center gap-2">
                            <input v-model.number="manualRateInput" type="number" placeholder="Tasa manual para esta fecha" min="0" step="any"
                                class="ui-input-sm flex-1" />
                            <button type="button" @click.prevent="applyManualRate" :disabled="!manualRateInput || manualRateInput <= 0"
                                class="cursor-pointer rounded-control bg-accent-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-accent-700 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 dark:bg-accent-500 dark:hover:bg-accent-600 dark:disabled:bg-stone-700 dark:disabled:text-stone-500">
                                Aplicar
                            </button>
                        </div>
                    </div>

                    <div>
                        <label class="ui-label" for="tx-notes">Notas (opcional)</label>
                        <textarea id="tx-notes" v-model="formData.notes" rows="2" class="ui-textarea"></textarea>
                    </div>

                    <div class="mt-2 flex items-center justify-between gap-3">
                        <button type="button" @click="closeModal" class="ui-btn-outline">Cancelar</button>
                        <button type="submit" :disabled="isSubmitDisabled" :class="isSubmitDisabled ? 'ui-btn-disabled' : 'ui-btn-primary'">
                            {{ isEditing ? 'Guardar cambios' : 'Añadir movimiento' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>
