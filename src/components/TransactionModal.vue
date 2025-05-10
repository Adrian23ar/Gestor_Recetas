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
                            Obteniendo tasa de API para esta fecha...
                        </p>
                        <p v-if="rateErrorMessageForModal && !isRateLoadingInModal" class="text-xs mt-1"
                            :class="{ 'text-amber-600 dark:text-amber-400': actualDateOfRate && actualDateOfRate !== formData.date, 'text-danger-600 dark:text-danger-400': !actualDateOfRate || (actualDateOfRate === formData.date && !applicableRate) }">
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

                    <div class="p-2 bg-neutral-50 rounded dark:bg-dark-neutral-800/50 text-sm">
                        <p>Tasa Aplicada (Bs/USD):
                            <strong class="dark:text-dark-secondary-300">
                                {{ applicableRate ? applicableRate.toFixed(2) : (isRateLoadingInModal ? 'Cargando...' :
                                    'N/A') }}
                                <span v-if="actualDateOfRate && actualDateOfRate !== formData.date && applicableRate"
                                    class="text-xs italic">
                                    (del {{ formatDate(actualDateOfRate) }})
                                </span>
                            </strong>
                            <button v-if="!isRateLoadingInModal && !applicableRate && formData.date"
                                @click.prevent="() => attemptFetchRateForSelectedDate(formData.date)"
                                class="ml-2 text-xs text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 underline">
                                (Reintentar API)
                            </button>
                        </p>
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
                            :disabled="isRateLoadingInModal || !!rateErrorMessageForModal && !actualDateOfRate || !formData.amountBs || formData.amountBs <= 0 || !formData.date || !formData.description || (!applicableRate && !isRateLoadingInModal)"
                            class="px-4 py-2 cursor-pointer bg-accent-500 text-white font-semibold transition-all rounded-md shadow-sm hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-accent-500 disabled:opacity-50 disabled:cursor-not-allowed dark:bg-dark-accent-400 dark:text-dark-text-base dark:hover:bg-dark-accent-500 dark:focus:ring-dark-accent-400 dark:focus:ring-offset-dark-contrast">
                            {{ isEditing ? 'Guardar Cambios' : 'Añadir Movimiento' }}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    </Transition>
</template>

<script setup>
import { ref, watch, computed, nextTick } from 'vue';
import { useAccountingData } from '../composables/useAccountingData';
import { useToast } from 'vue-toastification';

const props = defineProps({
    show: { type: Boolean, required: true },
    transactionData: { type: Object, default: null },
});

const emit = defineEmits(['close', 'save']);
const toast = useToast();

const {
    getRateForDate,
    fetchRateForSpecificDateFromAPI,
    // specificDateRateFetchingLoading, // Ya no se usa directamente, se maneja con isRateLoadingInModal
    specificDateRateError,
    updateDailyRate
} = useAccountingData();

const defaultFormData = () => ({
    id: null, type: 'expense', date: new Date().toISOString().split('T')[0],
    description: '', category: '', amountBs: null,
    exchangeRate: null, amountUsd: 0, notes: '',
});

const formData = ref(defaultFormData());
const applicableRate = ref(null);
const rateErrorMessageForModal = ref('');
const isRateLoadingInModal = ref(false);
const actualDateOfRate = ref(null);
const dateChangeDebounceTimer = ref(null); // <-- Timer para el debounce

const isEditing = computed(() => !!props.transactionData?.id);

watch(() => props.show, async (newShow) => {
    if (newShow) {
        clearTimeout(dateChangeDebounceTimer.value); // Limpiar debounce si estaba activo al abrir
        rateErrorMessageForModal.value = '';
        actualDateOfRate.value = null;
        if (specificDateRateError) specificDateRateError.value = null;
        isRateLoadingInModal.value = false;

        if (props.transactionData) {
            formData.value = JSON.parse(JSON.stringify(props.transactionData));
            formData.value.amountBs = Number(formData.value.amountBs);
            if (formData.value.date) {
                await attemptFetchRateForSelectedDate(formData.value.date, true, false); // false para no debounced
            }
        } else {
            formData.value = defaultFormData();
            if (formData.value.date) {
                await attemptFetchRateForSelectedDate(formData.value.date, false, false); // false para no debounced
            }
        }
        nextTick(() => document.getElementById('tx-description')?.focus());
    } else {
        formData.value = defaultFormData();
        applicableRate.value = null;
        rateErrorMessageForModal.value = '';
        isRateLoadingInModal.value = false;
        actualDateOfRate.value = null;
        clearTimeout(dateChangeDebounceTimer.value); // Limpiar debounce al cerrar
    }
});

// Observador para la fecha con DEBOUNCE
watch(() => formData.value.date, (newDate, oldDate) => {
    clearTimeout(dateChangeDebounceTimer.value); // Limpiar el timer anterior

    if (newDate && newDate !== oldDate) {
        actualDateOfRate.value = null;
        isRateLoadingInModal.value = true; // Mostrar "Cargando..." inmediatamente
        rateErrorMessageForModal.value = ''; // Limpiar mensaje de error previo

        dateChangeDebounceTimer.value = setTimeout(async () => {
            await attemptFetchRateForSelectedDate(newDate, false, true); // true para indicar que es debounced
        }, 500); // 500ms de delay
    } else if (!newDate) {
        applicableRate.value = null;
        formData.value.exchangeRate = null;
        formData.value.amountUsd = 0;
        actualDateOfRate.value = null;
        rateErrorMessageForModal.value = 'Selecciona una fecha válida.';
        isRateLoadingInModal.value = false;
    } else if (newDate === oldDate) {
        // Si la fecha no cambió, no hacer nada, pero asegurarse que el loading no se quede en true
        // Esto puede pasar si el watch se dispara por otra reactividad interna.
        // No es estrictamente necesario si el if de arriba (newDate !== oldDate) es suficiente.
    }
});

async function attemptFetchRateForSelectedDate(selectedDateString, isInitialEditLoad = false, isDebouncedCall = false) {
    if (!selectedDateString) {
        isRateLoadingInModal.value = false; // Asegurar que el loading se quite
        return;
    }

    // Si no es una llamada debounced (ej. carga inicial o reintento manual),
    // y ya se está cargando por un debounce, no hacer nada para evitar llamadas múltiples.
    if (!isDebouncedCall && isRateLoadingInModal.value && dateChangeDebounceTimer.value) {
        console.log("TransactionModal: Debounce en progreso, omitiendo llamada directa concurrente.");
        return;
    }

    // Si no es una llamada debounced, asegurarse que el loading se active si no lo está.
    if (!isDebouncedCall) {
        isRateLoadingInModal.value = true;
    }
    // Si es una llamada debounced, isRateLoadingInModal ya se puso en true antes del setTimeout.

    rateErrorMessageForModal.value = '';
    actualDateOfRate.value = null;
    if (specificDateRateError) specificDateRateError.value = null;

    const apiResult = await fetchRateForSpecificDateFromAPI(selectedDateString);

    if (apiResult && apiResult.rate !== null) {
        applicableRate.value = apiResult.rate;
        formData.value.exchangeRate = apiResult.rate;
        actualDateOfRate.value = apiResult.dateFound;

        if (apiResult.dateFound !== selectedDateString) {
            const friendlySelectedDate = formatDate(selectedDateString);
            const friendlyFoundDate = formatDate(apiResult.dateFound);
            rateErrorMessageForModal.value = `Tasa para ${friendlySelectedDate} no disponible (API). Se usó tasa de ${friendlyFoundDate}: ${apiResult.rate.toFixed(2)} Bs.`;
            if (!isInitialEditLoad) toast.info(rateErrorMessageForModal.value, { timeout: 2000 });
        } else {
            if (!isInitialEditLoad) toast.success(`Tasa (${apiResult.rate.toFixed(2)} Bs) aplicada para ${formatDate(selectedDateString)}.`, { timeout: 3000 });
        }
    } else {
        console.warn(`TransactionModal: API (con reintentos) no devolvió tasa para ${selectedDateString}. (Error: ${apiResult?.error || specificDateRateError?.value}). Intentando con tasa local.`);
        const rateFromLocal = getRateForDate(selectedDateString);
        if (rateFromLocal !== null && rateFromLocal > 0) {
            applicableRate.value = rateFromLocal;
            formData.value.exchangeRate = rateFromLocal;
            actualDateOfRate.value = selectedDateString;
            rateErrorMessageForModal.value = `Tasa de API no disponible. Se usó tasa local guardada para ${formatDate(selectedDateString)}.`;
            if (!isInitialEditLoad) toast.info(rateErrorMessageForModal.value, { timeout: 3000 });
        } else {
            if (isInitialEditLoad && props.transactionData?.exchangeRate > 0) {
                applicableRate.value = Number(props.transactionData.exchangeRate);
                formData.value.exchangeRate = Number(props.transactionData.exchangeRate);
                actualDateOfRate.value = props.transactionData.date;
                rateErrorMessageForModal.value = `API y local no disponibles. Se mantuvo tasa original de la transacción.`;
                if (!isInitialEditLoad) toast.warn(rateErrorMessageForModal.value, { timeout: 3000 });
            } else {
                applicableRate.value = null;
                formData.value.exchangeRate = null;
                rateErrorMessageForModal.value = apiResult?.error || specificDateRateError?.value || `No se encontró tasa (API o local) para ${formatDate(selectedDateString)}.`;
            }
        }
    }
    recalculateUsd();
    isRateLoadingInModal.value = false;
}

function formatDate(dateString) { // Función helper para mostrar fechas amigables en mensajes
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
    clearTimeout(dateChangeDebounceTimer.value); // Limpiar debounce al cerrar
    emit('close');
};

const save = () => {
    if (!formData.value.description.trim()) {
        toast.warning("La descripción no puede estar vacía."); return;
    }
    if (!formData.value.amountBs || formData.value.amountBs <= 0) {
        toast.warning("El monto en Bs. debe ser mayor a cero."); return;
    }
    // Permitir guardar si hay un mensaje informativo sobre tasa de día anterior, pero no si es un error real de "no tasa"
    const isErrorPreventingSave = rateErrorMessageForModal.value && (!actualDateOfRate.value || !applicableRate.value);
    if (isErrorPreventingSave || (!applicableRate.value && !isRateLoadingInModal.value)) {
        toast.error(rateErrorMessageForModal.value || "Falta la tasa de cambio o es inválida para la fecha seleccionada.");
        return;
    }
    if (!applicableRate.value || applicableRate.value <= 0) {
        toast.error("La tasa aplicada es inválida o no se ha podido determinar.");
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

// Ya no necesitamos el watcher para specificDateRateFetchingLoading,
// isRateLoadingInModal lo maneja localmente de forma más directa.

</script>

<style scoped>
.fixed.inset-0 {
    overflow-y: auto;
}
</style>