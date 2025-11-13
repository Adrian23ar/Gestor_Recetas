<script setup>
// src/components/TransactionModal.vue
import { ref, watch, computed, nextTick } from 'vue';
import { useAccountingDataStore } from '../stores/accountingData';
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

// MODIFICADO: La función daysBetween ya no es necesaria y se puede eliminar.

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

// MODIFICADO: La lógica ahora es más simple y siempre ofrece la elección.
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
        // Si se encuentra una tasa anterior (sin importar la antigüedad), se ofrece la elección.
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
</script>

<template>
    <Transition name="modal-transition">
        <div v-if="show"
            class="fixed inset-0 bg-black/60 overflow-y-auto h-full w-full z-50 flex justify-center items-start pt-6 sm:pt-10 pb-6"
            @click.self="closeModal">
            <div
                class="modal-content relative mx-auto p-5 sm:p-6 border border-neutral-300 w-full max-w-lg shadow-lg rounded-md bg-contrast dark:border-dark-neutral-700 dark:bg-dark-contrast dark:shadow-xl">
                <div
                    class="flex justify-between items-center border-b border-neutral-200 pb-3 mb-4 dark:border-dark-neutral-700">
                    <h3 class="text-xl font-semibold text-primary-800 dark:text-dark-primary-200">
                        {{ isEditing ? 'Editar' : 'Registrar' }} Movimiento
                    </h3>
                    <button @click="closeModal"
                        class="text-neutral-400 hover:text-neutral-600 text-2xl font-bold dark:text-dark-neutral-400 dark:hover:text-dark-neutral-600">&times;</button>
                </div>

                <form @submit.prevent="save" class="space-y-4">
                    <div class="flex items-center space-x-4">
                        <span class="text-sm font-medium text-text-base dark:text-dark-text-base">Tipo:</span>
                        <label class="flex items-center">
                            <input type="radio" v-model="formData.type" value="income" name="transactionType"
                                class="form-radio">
                            <span class="ml-2 text-sm text-text-base dark:text-dark-text-base">Ingreso</span>
                        </label>
                        <label class="flex items-center">
                            <input type="radio" v-model="formData.type" value="expense" name="transactionType"
                                class="form-radio">
                            <span class="ml-2 text-sm text-text-base dark:text-dark-text-base">Egreso</span>
                        </label>
                    </div>

                    <div>
                        <label for="tx-date"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Fecha:</label>
                        <input type="date" id="tx-date" v-model="formData.date" required class="mt-1 input-field-style">
                        <p v-if="isRateLoadingInModal" class="text-xs text-blue-600 dark:text-blue-400 mt-1 italic">
                            Buscando tasa...
                        </p>
                        <p v-if="rateErrorMessageForModal && !isRateLoadingInModal" class="text-xs mt-1"
                            :class="{ 'text-amber-600 dark:text-amber-400': showStaleRateChoice, 'text-danger-600 dark:text-danger-400 transition-all': showManualRateInput && !showStaleRateChoice }">
                            {{ rateErrorMessageForModal }}
                        </p>
                    </div>

                    <div>
                        <label for="tx-description"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Descripción:</label>
                        <input type="text" id="tx-description" v-model="formData.description" required
                            placeholder="Ej: Venta torta, Compra harina" class="mt-1 input-field-style">
                    </div>

                    <div>
                        <label for="tx-category"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Categoría:</label>
                        <input type="text" id="tx-category" v-model="formData.category"
                            placeholder="Ej: Ventas, Materia Prima, Gastos Op." class="mt-1 input-field-style">
                    </div>

                    <div>
                        <label for="tx-amount-bs"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Monto
                            (Bs.):</label>
                        <input type="number" id="tx-amount-bs" v-model.number="formData.amountBs" required min="0.01"
                            step="0.01" class="mt-1 input-field-style">
                    </div>

                    <div class="p-3 bg-neutral-50 rounded dark:bg-dark-neutral-800/50 text-sm space-y-2">
                        <p>Tasa Aplicada (Bs/USD):
                            <strong class="dark:text-dark-secondary-300">
                                {{ applicableRate ? applicableRate.toFixed(2) : (isRateLoadingInModal ? 'Buscando...' :
                                    'N/A') }}
                                <span v-if="actualDateOfRate && actualDateOfRate !== formData.date && applicableRate"
                                    class="text-xs italic">
                                    (del {{ formatDate(actualDateOfRate) }})
                                </span>
                            </strong>
                        </p>

                        <div v-if="showStaleRateChoice" class="p-2 border border-amber-500 rounded-md text-center">
                            <p class="text-xs mb-2">{{ rateErrorMessageForModal }}</p>
                            <div class="flex justify-center gap-2">
                                <button @click.prevent="handleUseStaleRate"
                                    class="px-2 py-1 bg-secondary-500 text-white text-xs font-medium rounded hover:bg-secondary-600 dark:bg-dark-secondary-500 dark:hover:bg-dark-secondary-600 transition-all">
                                    Usar esta tasa ({{ staleRateInfo.rate }})
                                </button>
                                <button @click.prevent="handleEnterManualInstead"
                                    class="px-2 py-1 bg-neutral-500 text-white text-xs font-medium rounded hover:bg-neutral-600 dark:bg-dark-neutral-600 dark:hover:bg-dark-neutral-700 transition-all">
                                    Ingresar Manualmente
                                </button>
                            </div>
                        </div>

                        <div v-if="showManualRateInput && !isRateLoadingInModal && !showStaleRateChoice"
                            class="flex items-center gap-2">
                            <input type="number" v-model.number="manualRateInput"
                                placeholder="Tasa manual para esta fecha" min="0" step="any"
                                class="flex-grow block w-full px-2 py-1 border border-neutral-300 rounded-md shadow-sm text-sm dark:border-dark-neutral-700 dark:bg-dark-background dark:text-dark-text-base" />
                            <button @click.prevent="applyManualRate"
                                :disabled="!manualRateInput || manualRateInput <= 0"
                                class="px-2 py-1 bg-accent-500 text-white text-xs font-medium rounded-md shadow-sm hover:bg-accent-600 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:hover:bg-dark-accent-500">
                                Aplicar
                            </button>
                        </div>

                        <p>Monto USD (Calculado): <strong class="dark:text-dark-secondary-300">${{ amountUsdDisplay
                        }}</strong></p>
                    </div>

                    <div>
                        <label for="tx-notes"
                            class="block text-sm font-medium text-text-base dark:text-dark-text-base">Notas
                            (Opcional):</label>
                        <textarea id="tx-notes" v-model="formData.notes" rows="2"
                            class="mt-1 input-field-style"></textarea>
                    </div>

                    <div
                        class="flex justify-end pt-4 border-t border-neutral-200 mt-4 space-x-3 dark:border-dark-neutral-700">
                        <button type="button" @click="closeModal"
                            class="px-4 py-2 bg-neutral-300 text-text-base transition-all rounded-md hover:bg-neutral-400 dark:bg-dark-neutral-700 dark:text-dark-text-base dark:hover:bg-dark-neutral-600">
                            Cancelar
                        </button>
                        <button type="submit"
                            :disabled="isRateLoadingInModal || showStaleRateChoice || !applicableRate || !formData.amountBs || formData.amountBs <= 0 || !formData.date || !formData.description"
                            class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            {{ isEditing ? 'Guardar Cambios' : 'Añadir Movimiento' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>

<style scoped>
.fixed.inset-0 {
    overflow-y: auto;
}
</style>