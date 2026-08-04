<script setup>
// src/components/TransactionModal.vue
import { ref, watch, computed, nextTick } from 'vue';
import { useAccountingDataStore } from '../stores/accountingData';
import DateField from './ui/DateField.vue';
import { storeToRefs } from 'pinia';
import { useToast } from 'vue-toastification';
import Multiselect from '@vueform/multiselect';
import { multiselectTheme } from '../utils/multiselectTheme.js';
import { CURRENCIES, DEFAULT_CURRENCY, currencySymbol, requiredRateKeys, toUsdBcv } from '../utils/currency.js';

const currencyOptions = CURRENCIES.map(c => ({ value: c.code, label: `${c.code} · ${c.name}` }));

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
    getRatesForExactDate,
    getLatestRateDataBefore,
    fetchRateForSpecificDateFromAPI,
    updateDailyRate
} = accountingStore;

// --- Estado para manejar la elección de tasa obsoleta ---
const showStaleRateChoice = ref(false);
const staleRateInfo = ref(null);

const showManualRateInput = ref(false);
// Un input por tasa: si el movimiento va en EUR o USDT hacen falta DOS tasas
// (la propia de la moneda y la del BCV, que es el denominador de la unidad
// canónica), así que la carga manual no puede ser un solo campo.
const manualRateInputs = ref({ bcv: null, eur: null, binance: null });

const RATE_META = {
    bcv: { label: 'Tasa BCV (Bs. por USD)', unit: 'Bs/USD' },
    eur: { label: 'Tasa BCV (Bs. por EUR)', unit: 'Bs/EUR' },
    binance: { label: 'Tasa USDT (Bs. por USDT)', unit: 'Bs/USDT' },
};

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
        amountOriginal: null,
        currencyOriginal: DEFAULT_CURRENCY,
        notes: '',
    };
};

const formData = ref(defaultFormData());
// Juego de tasas resuelto para la fecha elegida. Reemplaza al `applicableRate`
// suelto de cuando todo era en bolívares.
const applicableRates = ref(null);
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
        manualRateInputs.value = { bcv: null, eur: null, binance: null };
        showStaleRateChoice.value = false;
        staleRateInfo.value = null;

        if (props.transactionData) {
            formData.value = JSON.parse(JSON.stringify(props.transactionData));
            formData.value.amountOriginal = Number(formData.value.amountOriginal);
            formData.value.currencyOriginal = formData.value.currencyOriginal || DEFAULT_CURRENCY;
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
        applicableRates.value = null;
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
        manualRateInputs.value = { bcv: null, eur: null, binance: null };
        showStaleRateChoice.value = false;
        staleRateInfo.value = null;
        actualDateOfRate.value = null;
        applicableRates.value = null;
        isRateLoadingInModal.value = true;
        rateErrorMessageForModal.value = '';
        dateChangeDebounceTimer.value = setTimeout(async () => {
            await attemptFetchRateForSelectedDate(newDate, false);
        }, 500);
    } else if (!newDate) {
        applicableRates.value = null;
        actualDateOfRate.value = null;
        rateErrorMessageForModal.value = 'Selecciona una fecha válida.';
        isRateLoadingInModal.value = false;
    }
});

// Cascada de resolución de tasas: API -> exactas guardadas -> anteriores con
// elección -> manual. INVARIANTE: conservar los cuatro escalones y su orden.
// Lo único que cambió con la multimoneda es QUÉ se resuelve: antes un número
// (la del BCV), ahora el juego {bcv, eur, binance}.
async function attemptFetchRateForSelectedDate(selectedDate) {
    isRateLoadingInModal.value = true;
    rateErrorMessageForModal.value = '';
    actualDateOfRate.value = null;
    applicableRates.value = null;
    showManualRateInput.value = false;
    showStaleRateChoice.value = false;
    staleRateInfo.value = null;
    if (specificDateRateError) specificDateRateError.value = null;

    // 1. Intento API
    const apiResult = await fetchRateForSpecificDateFromAPI(selectedDate);
    if (apiResult && apiResult.rates && apiResult.rates.bcv) {
        applyRates(apiResult.rates, apiResult.dateFound, `Tasas de API para ${formatDate(apiResult.dateFound)} aplicadas.`);
        isRateLoadingInModal.value = false;
        return;
    }

    // 2. Fallo API -> Intento Local Exacto
    const exactRates = getRatesForExactDate(selectedDate);
    if (exactRates && exactRates.bcv) {
        applyRates(exactRates, selectedDate, "API no disponible. Se usaron las tasas guardadas para esta fecha.");
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
        const { rates, date } = staleRateInfo.value;
        applyRates(rates, date, `Tasas del ${formatDate(date)} aplicadas.`);
        showStaleRateChoice.value = false;
        rateErrorMessageForModal.value = '';
    }
}

function handleEnterManualInstead() {
    showStaleRateChoice.value = false;
    rateErrorMessageForModal.value = "Por favor, ingrese las tasas para el " + formatDate(formData.value.date);
    showManualRateInput.value = true;
}

function applyRates(rates, dateFound, message = '') {
    applicableRates.value = { ...rates };
    actualDateOfRate.value = dateFound;
    if (message) toast.success(message, { timeout: 4000 });
}

// Tasas que le faltan a la moneda elegida. Es lo que decide si se puede guardar
// y qué inputs muestra la carga manual.
const missingRateKeys = computed(() => {
    const rates = applicableRates.value || {};
    return requiredRateKeys(formData.value.currencyOriginal)
        .filter(key => !(Number(rates[key]) > 0));
});

async function applyManualRates() {
    const entered = {};
    for (const key of missingRateKeys.value) {
        const value = Number(manualRateInputs.value[key]);
        if (!value || value <= 0) {
            toast.error(`Ingresa un número positivo para la ${RATE_META[key].unit}.`);
            return;
        }
        entered[key] = value;
    }
    if (Object.keys(entered).length === 0) return;

    applyRates({ ...(applicableRates.value || {}), ...entered }, formData.value.date, 'Tasas manuales aplicadas.');
    showManualRateInput.value = false;
    rateErrorMessageForModal.value = '';
    manualRateInputs.value = { bcv: null, eur: null, binance: null };

    await updateDailyRate(entered, formData.value.date);
}

function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString + 'T00:00:00');
    return date.toLocaleDateString('es-VE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

const closeModal = () => {
    clearTimeout(dateChangeDebounceTimer.value);
    emit('close');
};

const save = () => {
    if (!formData.value.description.trim()) {
        toast.warning("La descripción no puede estar vacía.");
        return;
    }
    if (!formData.value.amountOriginal || formData.value.amountOriginal <= 0) {
        toast.warning("El monto debe ser mayor a cero.");
        return;
    }
    if (missingRateKeys.value.length > 0) {
        toast.error(rateErrorMessageForModal.value || `Faltan tasas para registrar en ${formData.value.currencyOriginal}.`);
        return;
    }
    // El juego de tasas viaja aparte del formulario: el store lo usa para
    // calcular amountUsdBcv y para guardar el snapshot, no se persiste tal cual.
    emit('save', { ...formData.value, rates: { ...(applicableRates.value || {}) } });
};

// Equivalente en la unidad canónica (USD a tasa BCV) del monto que se está
// cargando. null = falta alguna tasa; no se muestra 0, que sería mentira.
const amountUsdBcv = computed(() =>
    toUsdBcv(formData.value.amountOriginal, formData.value.currencyOriginal, applicableRates.value || {})
);

const amountUsdDisplay = computed(() =>
    amountUsdBcv.value === null ? '—' : amountUsdBcv.value.toFixed(2)
);

// Tasas que SÍ se están usando para este movimiento, para mostrarlas al usuario.
const usedRates = computed(() => {
    const rates = applicableRates.value || {};
    return requiredRateKeys(formData.value.currencyOriginal)
        .filter(key => Number(rates[key]) > 0)
        .map(key => ({ key, unit: RATE_META[key].unit, value: Number(rates[key]) }));
});

// INVARIANTE: no simplificar — el submit debe seguir deshabilitado en cualquiera de estos casos.
const isSubmitDisabled = computed(() =>
    isRateLoadingInModal.value || showStaleRateChoice.value || missingRateKeys.value.length > 0 ||
    !formData.value.amountOriginal || formData.value.amountOriginal <= 0 || !formData.value.date || !formData.value.description
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

                    <!-- Monto y moneda van en celdas de una grilla, no en un flex con anchos
                         a medida: tanto `.ui-input` como el tema compartido de Multiselect
                         traen `w-full`, y con important:true ningún ancho por-uso puede
                         ganarles (gotcha #1) — los dos pedían el 100% y se desbordaban.
                         En una grilla el ancho completo de la celda es justo lo correcto. -->
                    <div>
                        <div class="grid grid-cols-2 gap-3 max-[640px]:grid-cols-1">
                            <div>
                                <label class="ui-label" for="tx-amount">Monto</label>
                                <input id="tx-amount" v-model.number="formData.amountOriginal" type="number" required min="0.01" step="0.01"
                                    placeholder="Ej: 1500" class="ui-input" />
                            </div>
                            <div>
                                <label class="ui-label" for="tx-currency">Moneda</label>
                                <Multiselect id="tx-currency" v-model="formData.currencyOriginal" :options="currencyOptions"
                                    :searchable="false" :canClear="false" :canDeselect="false" :classes="multiselectTheme" />
                            </div>
                        </div>
                        <p class="mt-1.5 text-xs text-stone-400">
                            El monto se guarda tal cual lo escribes. El equivalente de abajo es lo que se usa para totalizar.
                        </p>
                    </div>

                    <div class="ui-panel space-y-3 p-4">
                        <div>
                            <p class="ui-label !mb-1">Equivale a</p>
                            <p class="text-[24px] font-semibold tabular-nums tracking-[-0.02em] text-stone-800 dark:text-stone-100">
                                <template v-if="isRateLoadingInModal">…</template>
                                <template v-else>${{ amountUsdDisplay }}</template>
                            </p>
                            <p v-if="usedRates.length > 0" class="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                <span v-for="(rate, i) in usedRates" :key="rate.key">
                                    <template v-if="i > 0"> · </template>
                                    {{ rate.unit }}
                                    <span class="tabular-nums font-medium text-stone-700 dark:text-stone-300">{{ rate.value.toFixed(2) }}</span>
                                </span>
                                <span v-if="actualDateOfRate && actualDateOfRate !== formData.date">
                                    (del {{ formatDate(actualDateOfRate) }})
                                </span>
                            </p>
                            <p v-else-if="formData.currencyOriginal === 'USD'" class="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                Los movimientos en dólares no necesitan conversión.
                            </p>
                        </div>

                        <div v-if="missingRateKeys.length > 0 && !isRateLoadingInModal && !showStaleRateChoice && !showManualRateInput"
                            class="rounded-box border border-red-200 bg-red-50 p-3 dark:border-red-500/25 dark:bg-red-500/10">
                            <p class="text-xs text-red-700 dark:text-red-400">
                                Falta la
                                <template v-for="(key, i) in missingRateKeys" :key="key">
                                    <template v-if="i > 0"> y la </template>{{ RATE_META[key].unit }}
                                </template>
                                para esta fecha. Sin eso no se puede convertir un movimiento en {{ formData.currencyOriginal }}.
                            </p>
                            <button type="button" @click.prevent="showManualRateInput = true" class="ui-btn-subtle mt-2">
                                Ingresar manualmente
                            </button>
                        </div>

                        <div v-if="showStaleRateChoice" class="rounded-box border border-amber-200 bg-amber-50 p-3 text-center dark:border-amber-500/25 dark:bg-amber-500/10">
                            <p class="text-xs text-amber-800 dark:text-amber-300">{{ rateErrorMessageForModal }}</p>
                            <div class="mt-2 flex flex-wrap justify-center gap-2">
                                <button type="button" @click.prevent="handleUseStaleRate" class="ui-btn-subtle">
                                    Usar esas tasas
                                </button>
                                <button type="button" @click.prevent="handleEnterManualInstead" class="ui-btn-outline">
                                    Ingresar manualmente
                                </button>
                            </div>
                        </div>

                        <div v-if="showManualRateInput && !isRateLoadingInModal && !showStaleRateChoice" class="space-y-2">
                            <div v-for="key in missingRateKeys" :key="key">
                                <label class="ui-label !mb-1" :for="`tx-manual-rate-${key}`">{{ RATE_META[key].label }}</label>
                                <input :id="`tx-manual-rate-${key}`" v-model.number="manualRateInputs[key]" type="number"
                                    :placeholder="`Ej: 748,79`" min="0" step="any" class="ui-input-sm w-full" />
                            </div>
                            <button type="button" @click.prevent="applyManualRates" class="ui-btn-subtle">
                                Aplicar tasas
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
