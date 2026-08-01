// src/composables/useDataTable.js
import { ref, computed, watch, toValue } from 'vue';

/**
 * Reemplaza a DataTables: búsqueda + orden + paginación en cliente sobre un array reactivo.
 * @param {import('vue').Ref<Array>|(() => Array)|Array} rows
 * @param {{ searchFields?: string[], pageSize?: number, defaultSort?: { key: string, dir?: 'asc'|'desc' } }} options
 */
export function useDataTable(rows, options = {}) {
    const {
        searchFields = [],
        pageSize: initialPageSize = 10,
        defaultSort = null,
    } = options;

    const query = ref('');
    const page = ref(1);
    const pageSize = ref(initialPageSize);
    const sortKey = ref(defaultSort?.key ?? null);
    const sortDir = ref(defaultSort?.dir ?? 'asc');

    function getFieldValue(row, key) {
        return key.split('.').reduce((acc, part) => (acc == null ? acc : acc[part]), row);
    }

    const filtered = computed(() => {
        const allRows = toValue(rows) || [];
        const q = query.value.trim().toLowerCase();

        let result = allRows;
        if (q && searchFields.length > 0) {
            result = allRows.filter(row =>
                searchFields.some((field) => {
                    const value = getFieldValue(row, field);
                    return value != null && String(value).toLowerCase().includes(q);
                })
            );
        }

        if (sortKey.value) {
            const key = sortKey.value;
            const dir = sortDir.value === 'desc' ? -1 : 1;
            // decorate-sort-undecorate: orden estable garantizado incluso si el motor no lo asegura.
            result = result
                .map((row, index) => ({ row, index }))
                .sort((a, b) => {
                    const va = getFieldValue(a.row, key);
                    const vb = getFieldValue(b.row, key);
                    if (va == null && vb == null) return a.index - b.index;
                    if (va == null) return 1;
                    if (vb == null) return -1;
                    if (va < vb) return -1 * dir;
                    if (va > vb) return 1 * dir;
                    return a.index - b.index;
                })
                .map(entry => entry.row);
        }

        return result;
    });

    const total = computed(() => filtered.value.length);
    const totalPages = computed(() => Math.max(1, Math.ceil(total.value / pageSize.value)));

    const paged = computed(() => {
        const start = (page.value - 1) * pageSize.value;
        return filtered.value.slice(start, start + pageSize.value);
    });

    const rangeFrom = computed(() => (total.value === 0 ? 0 : (page.value - 1) * pageSize.value + 1));
    const rangeTo = computed(() => Math.min(page.value * pageSize.value, total.value));

    watch(query, () => {
        page.value = 1;
    });

    // Si el filtrado reduce el total de páginas por debajo de la página actual, la reencauza.
    watch(totalPages, (newTotalPages) => {
        if (page.value > newTotalPages) page.value = newTotalPages;
    });

    function next() {
        if (page.value < totalPages.value) page.value += 1;
    }

    function prev() {
        if (page.value > 1) page.value -= 1;
    }

    function toggleSort(key) {
        if (sortKey.value !== key) {
            sortKey.value = key;
            sortDir.value = 'asc';
        } else if (sortDir.value === 'asc') {
            sortDir.value = 'desc';
        } else {
            sortKey.value = null;
            sortDir.value = 'asc';
        }
        page.value = 1;
    }

    return {
        query,
        page,
        pageSize,
        sortKey,
        sortDir,
        filtered,
        paged,
        total,
        totalPages,
        rangeFrom,
        rangeTo,
        next,
        prev,
        toggleSort,
    };
}
