// src/utils/utils.js

/**
 * Formatea un valor numérico como moneda.
 * @param {number | string | null | undefined} value - El valor a formatear.
 * @param {string} symbol - El símbolo de moneda (ej: '$', 'Bs.'). El default es '$'.
 * @param {boolean} useGrouping - Usar separadores de miles. El default es true.
 * @param {string} [locale] - Opcional: forzar un 'locale' (ej: 'en-US', 'es-VE').
 */
export function formatCurrency(value, symbol = '$', useGrouping = true, locale) {
  const num = Number(value);
  if (isNaN(num)) {
    // Devuelve el símbolo con 0.00 si no es un número
    return `${symbol}0.00`;
  }

  // Define el 'locale' por defecto basado en el símbolo si no se provee uno
  const defaultLocale = (symbol === 'Bs.') ? 'es-VE' : 'en-US';
  const chosenLocale = locale || defaultLocale;

  const options = {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: useGrouping,
  };

  // Caso especial para la tasa (sin símbolo, sin agrupación)
  // como se usa en AccountingView
  if (symbol === '' && !useGrouping) {
    return num.toLocaleString('es-VE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false
    });
  }

  const formatted = num.toLocaleString(chosenLocale, options);

  // Añade el símbolo de forma manual para consistencia
  return `${symbol}${formatted}`;
}