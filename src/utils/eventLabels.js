// src/utils/eventLabels.js
// Única fuente de etiqueta/tono por tipo de evento — antes duplicado en
// EventHistoryView.vue y EventDetailsModal.vue con dos redacciones distintas.

const EVENT_META = {
    RECIPE_CREATED: { label: 'Nueva Receta', tone: 'success' },
    RECIPE_EDITED: { label: 'Receta Editada', tone: 'warning' },
    RECIPE_DELETED: { label: 'Receta Eliminada', tone: 'danger' },

    INGREDIENT_CREATED: { label: 'Nuevo Ingrediente', tone: 'success' },
    INGREDIENT_EDITED: { label: 'Ingrediente Editado', tone: 'warning' },
    INGREDIENT_DELETED: { label: 'Ingrediente Eliminado', tone: 'danger' },

    PRODUCTION_RECORD_CREATED: { label: 'Nuevo Registro de Producción', tone: 'success' },
    PRODUCTION_RECORD_EDITED: { label: 'Registro de Producción Editado', tone: 'warning' },
    PRODUCTION_RECORD_DELETED: { label: 'Registro de Producción Eliminado', tone: 'danger' },

    STOCK_MANUAL_EDIT: { label: 'Stock Editado Manualmente', tone: 'neutral' },
    STOCK_ADJUST_BY_PRODUCTION_ADD: { label: 'Stock Descontado por Producción', tone: 'neutral' },
    STOCK_ADJUST_BY_PRODUCTION_DELETE: { label: 'Stock Restaurado (Prod. Eliminada)', tone: 'neutral' },
    STOCK_ADJUST_BY_PRODUCTION_EDIT: { label: 'Stock Ajustado por Edición de Prod.', tone: 'neutral' },

    TRANSACTION_CREATED: { label: 'Transacción Creada', tone: 'success' },
    TRANSACTION_EDITED: { label: 'Transacción Editada', tone: 'warning' },
    TRANSACTION_DELETED: { label: 'Transacción Eliminada', tone: 'danger' },

    EXCHANGE_RATE_UPDATED: { label: 'Tasa de Cambio Actualizada', tone: 'neutral' },
    EXCHANGE_RATE_CREATED: { label: 'Tasa de Cambio Creada', tone: 'neutral' },
    EXCHANGE_RATE_EDITED: { label: 'Tasa de Cambio Editada', tone: 'neutral' },
};

/**
 * @param {string} eventType
 * @returns {{ label: string, tone: 'success' | 'warning' | 'danger' | 'neutral' }}
 */
export function getEventMeta(eventType) {
    return EVENT_META[eventType] || { label: eventType || 'Evento', tone: 'neutral' };
}

// Traducción de nombres de campo mostrados en "Cambios detallados". Antes vivía
// solo en src/stores/userData.js (usada al escribir `change.label`) — se movió
// acá para poder usarla también como fallback al LEER entradas históricas que
// se guardaron con un `label` ausente o en inglés (ver EventDetailsModal.vue /
// EventHistoryView.vue), sin duplicar el diccionario.
const FIELD_LABELS = {
    name: 'Nombre',
    cost: 'Costo de Presentación',
    presentationSize: 'Tamaño de Presentación',
    unit: 'Unidad',
    currentStock: 'Stock Actual',
    ingredients: 'Ingredientes',
    packagingCostPerBatch: 'Costo de Empaque/Lote',
    laborCostPerBatch: 'Mano de Obra/Lote',
    itemsPerBatch: 'Items por Lote',
    profitMarginPercent: '% Margen de Ganancia',
    lossBufferPercent: '% Margen de Pérdida',
    productName: 'Nombre del Producto',
    batchSize: 'Tamaño del Lote (Cantidad)',
    date: 'Fecha',
    netProfit: 'Ganancia Neta',
    recipeId: 'Receta Asociada',
    totalRevenue: 'Ingresos Totales',
    totalCost: 'Costo Total de Producción',
    operatingCostRecipeOnly: 'Gastos Op. (Ingr. + Emp.)',
    laborCostForBatch: 'Costo Mano de Obra (Lote)',
    isSold: 'Vendido',
    calculatedRecipeOnlyCost: 'Costo Base de Receta (Calculado)',
    calculatedTotalBatchCostAllIncluded: 'Costo Total del Lote (Calculado)',
    calculatedFinalPrice: 'Precio Final (Calculado)',
    // Etiquetas para cambios de ingredientes (de getIngredientChangeDetails)
    'ingredient_removed': 'Ingrediente Eliminado',
    'ingredient_added': 'Ingrediente Añadido',
    'ingredient_quantity_updated': 'Cantidad de Ingrediente',
    'ingredient_unit_updated': 'Unidad de Ingrediente',
};

/**
 * @param {string} key
 * @returns {string}
 */
export function getFieldLabel(key) {
    return FIELD_LABELS[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
}
