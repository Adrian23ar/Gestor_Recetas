<script setup>
import { ref, onUnmounted, computed, watch } from 'vue';
import { useAuth } from '../composables/useAuth';
import { db } from '../main';
import { collection, getDocs, query, orderBy, limit, startAfter } from 'firebase/firestore';
import EventDetailsModal from '../components/EventDetailsModal.vue';
import ErrorMessage from '../components/ErrorMessage.vue';
import { getEventMeta } from '../utils/eventLabels.js';

const { user } = useAuth();
const localHistoryEntries = ref([]);
const historyLoading = ref(true);
const historyError = ref(null);
const isDetailsModalVisible = ref(false);
const selectedEventEntry = ref(null);
const PAGE_SIZE = 100;
const lastVisibleDoc = ref(null);
const allDataLoaded = ref(false);
const searchQuery = ref('');

let isCurrentlyLoading = false;

const showDetails = (eventEntry) => {
    selectedEventEntry.value = eventEntry;
    isDetailsModalVisible.value = true;
};
const closeDetailsModal = () => {
    isDetailsModalVisible.value = false;
    selectedEventEntry.value = null;
};

function toDate(timestamp) {
    if (!timestamp) return null;
    if (typeof timestamp.toDate === 'function') return timestamp.toDate();
    if (typeof timestamp === 'string') return new Date(timestamp);
    if (typeof timestamp === 'number') return new Date(timestamp);
    return null;
}

function formatTime(timestamp) {
    const date = toDate(timestamp);
    if (!date) return '--:--';
    return date.toLocaleTimeString('es-VE', { hour: '2-digit', minute: '2-digit', hour12: false });
}

const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getDateGroupLabel(date) {
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const dayMonth = `${date.getDate()} de ${MONTHS[date.getMonth()]}`;
    if (isSameDay(date, now)) return `Hoy · ${dayMonth}`;
    if (isSameDay(date, yesterday)) return `Ayer · ${dayMonth}`;
    return dayMonth;
}

function summarizeValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'object') return Array.isArray(value) ? `(${value.length})` : '(objeto)';
    if (typeof value === 'number') return value.toLocaleString('es-VE', { maximumFractionDigits: 2 });
    return String(value);
}

function buildDescription(entry) {
    const entityPart = entry.entityName || entry.entityType || '';
    if (Array.isArray(entry.changes) && entry.changes.length > 0) {
        const first = entry.changes[0];
        const label = first.label || first.field;
        const summary = `${label} ${summarizeValue(first.oldValue)} → ${summarizeValue(first.newValue)}`;
        return entityPart ? `${entityPart} — ${summary}` : summary;
    }
    return entry.description || entityPart || 'Sin detalles adicionales.';
}

function badgeClass(eventType) {
    const tone = getEventMeta(eventType).tone;
    if (tone === 'success') return 'ui-badge-success';
    if (tone === 'warning') return 'ui-badge-warning';
    if (tone === 'danger') return 'ui-badge-danger';
    return 'ui-badge-neutral';
}

const filteredEntries = computed(() => {
    const q = searchQuery.value.trim().toLowerCase();
    if (!q) return localHistoryEntries.value;
    return localHistoryEntries.value.filter(entry =>
        buildDescription(entry).toLowerCase().includes(q) ||
        getEventMeta(entry.eventType).label.toLowerCase().includes(q) ||
        (entry.entityName || '').toLowerCase().includes(q)
    );
});

const groupedHistory = computed(() => {
    const groups = [];
    let currentKey = null;
    let currentGroup = null;
    for (const entry of filteredEntries.value) {
        const date = toDate(entry.timestamp);
        const key = date ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` : 'unknown';
        if (key !== currentKey) {
            currentKey = key;
            currentGroup = { label: date ? getDateGroupLabel(date) : 'Fecha desconocida', entries: [] };
            groups.push(currentGroup);
        }
        currentGroup.entries.push(entry);
    }
    return groups;
});

// --- Carga (conservada): paginación por cursor de Firestore + fallback a localStorage ---
async function loadHistory(isLoadMore = false) {
    if (isCurrentlyLoading) return;
    if (isLoadMore && allDataLoaded.value) return;

    isCurrentlyLoading = true;
    historyLoading.value = true;
    historyError.value = null;

    if (!isLoadMore) {
        localHistoryEntries.value = [];
        lastVisibleDoc.value = null;
        allDataLoaded.value = false;
    }

    try {
        const currentUserId = user.value ? user.value.uid : null;
        if (currentUserId) {
            let q = query(
                collection(db, `users/${currentUserId}/eventHistory`),
                orderBy("timestamp", "desc"),
                limit(PAGE_SIZE)
            );
            if (isLoadMore && lastVisibleDoc.value) {
                q = query(
                    collection(db, `users/${currentUserId}/eventHistory`),
                    orderBy("timestamp", "desc"),
                    startAfter(lastVisibleDoc.value),
                    limit(PAGE_SIZE)
                );
            }
            const snapshot = await getDocs(q);
            const newEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            if (isLoadMore) {
                localHistoryEntries.value.push(...newEntries);
            } else {
                localHistoryEntries.value = newEntries;
            }
            lastVisibleDoc.value = snapshot.docs[snapshot.docs.length - 1] || null;
            if (newEntries.length < PAGE_SIZE) {
                allDataLoaded.value = true;
            }
        } else {
            const storedHistory = JSON.parse(localStorage.getItem('eventHistoryLog') || '[]');
            localHistoryEntries.value = storedHistory.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            allDataLoaded.value = true;
        }
    } catch (e) {
        console.error("Error cargando historial:", e);
        historyError.value = "No se pudo cargar el historial.";
        allDataLoaded.value = true;
    } finally {
        historyLoading.value = false;
        isCurrentlyLoading = false;
    }
}

// Único watcher responsable de la carga inicial y de los cambios de usuario.
// oldUser === undefined SÓLO ocurre en la llamada sintética de `immediate` —
// debe cargar siempre esa primera vez, incluso sin usuario (newUid null),
// porque si no, "null !== null" nunca dispara loadHistory y el skeleton
// queda cargando para siempre cuando no hay sesión iniciada.
watch(user, (newUser, oldUser) => {
    const newUid = newUser ? newUser.uid : null;
    const oldUid = oldUser ? oldUser.uid : null;
    if (oldUser === undefined || newUid !== oldUid) {
        loadHistory(false);
    }
}, { deep: true, immediate: true });

onUnmounted(() => {
    isCurrentlyLoading = false;
});
</script>

<template>
    <div class="space-y-6">
        <div class="flex flex-wrap items-end justify-between gap-4">
            <div>
                <h1 class="ui-h1">Historial</h1>
                <p class="mt-1 text-sm text-stone-500 dark:text-stone-400">Registro de cambios en tu cuenta</p>
            </div>
            <input v-model="searchQuery" type="search" placeholder="Buscar en el historial…" class="ui-input-sm w-full max-w-[240px]" />
        </div>

        <ErrorMessage v-if="historyError" :message="historyError" />

        <template v-else>
            <div v-if="historyLoading && localHistoryEntries.length === 0" class="ui-card divide-y divide-stone-100 dark:divide-stone-800">
                <div v-for="n in 4" :key="n" class="flex items-center gap-4 px-5 py-4">
                    <div class="ui-skeleton h-4 w-10" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.1}s infinite` }"></div>
                    <div class="ui-skeleton h-5 w-16 rounded-full" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.1}s infinite` }"></div>
                    <div class="ui-skeleton h-4 flex-1" :style="{ animation: `shimmer 1.4s ease-in-out ${(n - 1) * 0.1}s infinite` }"></div>
                </div>
            </div>

            <div v-else-if="groupedHistory.length === 0" class="ui-empty">
                <h3 class="text-base font-semibold text-stone-700 dark:text-stone-200">Sin eventos</h3>
                <p class="mt-1.5 max-w-sm text-sm text-stone-500 dark:text-stone-400">
                    {{ searchQuery ? 'Ningún evento coincide con tu búsqueda.' : 'Todavía no hay eventos registrados.' }}
                </p>
            </div>

            <div v-else class="ui-card overflow-hidden">
                <template v-for="group in groupedHistory" :key="group.label">
                    <div class="bg-surface-muted px-5 py-2 text-xs font-semibold text-stone-500 dark:bg-stone-900/60 dark:text-stone-400">
                        {{ group.label }}
                    </div>
                    <div v-for="entry in group.entries" :key="entry.id"
                        class="flex flex-wrap items-center gap-3 border-t border-stone-100 px-5 py-3.5 max-[640px]:items-start dark:border-stone-800">
                        <span class="w-[56px] shrink-0 tabular-nums text-xs text-stone-400">{{ formatTime(entry.timestamp) }}</span>
                        <span :class="badgeClass(entry.eventType)" class="shrink-0">{{ getEventMeta(entry.eventType).label }}</span>
                        <span class="min-w-0 flex-1 truncate text-sm text-stone-700 max-[640px]:order-last max-[640px]:w-full max-[640px]:basis-full max-[640px]:whitespace-normal dark:text-stone-300">
                            {{ buildDescription(entry) }}
                        </span>
                        <button type="button" class="ui-btn-subtle shrink-0" @click="showDetails(entry)">Ver detalle</button>
                    </div>
                </template>
            </div>

            <div v-if="!allDataLoaded && !historyLoading && groupedHistory.length > 0" class="flex justify-center">
                <button type="button" class="ui-btn-outline" @click="loadHistory(true)">Cargar más eventos</button>
            </div>
            <p v-else-if="allDataLoaded && groupedHistory.length > 0" class="text-center text-xs text-stone-400">
                Todos los eventos han sido cargados.
            </p>
        </template>

        <EventDetailsModal :show="isDetailsModalVisible" :event-entry="selectedEventEntry" @close="closeDetailsModal" />
    </div>
</template>
