// src/utils/currency.js
// Motor multimoneda del módulo de contabilidad. Funciones puras, sin estado.
//
// UNIDAD CANÓNICA: todo movimiento se guarda además convertido a "USD a tasa
// BCV" (`amountUsdBcv`). TODAS las sumas y comparaciones se hacen sobre ese
// campo — es lo único que permite totalizar movimientos cargados en monedas
// distintas. El monto que tecleó el usuario se conserva aparte
// (`amountOriginal` + `currencyOriginal`) y es lo que se muestra en la tabla.
//
// Las tasas son siempre "Bs. por 1 unidad de la moneda":
//   bcv     → Bs. por 1 USD    (API: bcvUsd.rate)
//   eur     → Bs. por 1 EUR    (API: bcvEur.rate)
//   binance → Bs. por 1 USDT   (API: promedio de binanceBuy.rate y binanceSell.rate)

export const CURRENCIES = [
    { code: 'VES', symbol: 'Bs.', name: 'Bolívares' },
    { code: 'USD', symbol: '$', name: 'Dólares' },
    { code: 'EUR', symbol: '€', name: 'Euros' },
    { code: 'USDT', symbol: 'USDT', name: 'Tether' },
];

export const CURRENCY_CODES = CURRENCIES.map(c => c.code);
export const DEFAULT_CURRENCY = 'VES';

export function currencySymbol(code) {
    return CURRENCIES.find(c => c.code === code)?.symbol || code || '';
}

export function isValidCurrency(code) {
    return CURRENCY_CODES.includes(code);
}

/**
 * Tasas que hacen falta para convertir esta moneda a la unidad canónica.
 * USD no necesita ninguna (ya ES la unidad); VES sólo la del BCV; EUR y USDT
 * necesitan su propia tasa MÁS la del BCV, porque el paso intermedio es Bs.
 * @returns {Array<'bcv'|'eur'|'binance'>}
 */
export function requiredRateKeys(currency) {
    if (currency === 'USD') return [];
    if (currency === 'VES') return ['bcv'];
    if (currency === 'EUR') return ['bcv', 'eur'];
    if (currency === 'USDT') return ['bcv', 'binance'];
    return ['bcv'];
}

function usableRate(value) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : null;
}

/** ¿Están todas las tasas necesarias para operar en esta moneda? */
export function hasRatesFor(currency, rates) {
    return requiredRateKeys(currency).every(key => usableRate(rates?.[key]) !== null);
}

/**
 * Monto en su moneda original → USD a tasa BCV (la unidad canónica).
 * Devuelve null si falta alguna tasa necesaria: quien llama decide qué hacer,
 * en vez de recibir un 0 silencioso que contaminaría un total.
 */
export function toUsdBcv(amount, currency, rates) {
    const value = Number(amount);
    if (!Number.isFinite(value)) return null;
    if (currency === 'USD') return value;

    const bcv = usableRate(rates?.bcv);
    if (!bcv) return null;

    if (currency === 'VES') return value / bcv;

    // EUR y USDT pasan primero a Bs. (multiplicando por su propia tasa) y de ahí
    // a USD. No se dividen directo: su tasa NO está expresada en dólares.
    if (currency === 'EUR') {
        const eur = usableRate(rates?.eur);
        return eur ? (value * eur) / bcv : null;
    }
    if (currency === 'USDT') {
        const binance = usableRate(rates?.binance);
        return binance ? (value * binance) / bcv : null;
    }
    return null;
}

/**
 * USD a tasa BCV → cualquier moneda. Es la inversa exacta de toUsdBcv() y es lo
 * que usa el selector de moneda de la vista para mostrar los totales.
 */
export function fromUsdBcv(amountUsd, currency, rates) {
    const value = Number(amountUsd);
    if (!Number.isFinite(value)) return null;
    if (currency === 'USD') return value;

    const bcv = usableRate(rates?.bcv);
    if (!bcv) return null;

    if (currency === 'VES') return value * bcv;
    if (currency === 'EUR') {
        const eur = usableRate(rates?.eur);
        return eur ? (value * bcv) / eur : null;
    }
    if (currency === 'USDT') {
        const binance = usableRate(rates?.binance);
        return binance ? (value * bcv) / binance : null;
    }
    return null;
}

/**
 * Respuesta de https://dolarflashve.eu/api/rates/all → nuestro juego de tasas.
 * USDT no viene dado: la API expone compra y venta de Binance por separado y
 * acá se toma el PROMEDIO de ambas. Si sólo viene una de las dos, se usa esa.
 */
export function parseApiRates(data) {
    const bcv = usableRate(data?.bcvUsd?.rate);
    const eur = usableRate(data?.bcvEur?.rate);

    const buy = usableRate(data?.binanceBuy?.rate);
    const sell = usableRate(data?.binanceSell?.rate);
    let binance = null;
    if (buy && sell) binance = (buy + sell) / 2;
    else binance = buy || sell;

    return { bcv, eur, binance };
}

/**
 * Un documento de tasas guardado (o uno viejo, de cuando sólo existía el BCV)
 * → el juego de tasas normalizado. Los documentos anteriores a la multimoneda
 * sólo tienen `rate`, que era la del BCV; el resto queda en null y las funciones
 * de arriba se encargan de no inventar conversiones con datos que no existen.
 */
export function normalizeRateEntry(raw) {
    if (!raw) return { bcv: null, eur: null, binance: null };
    return {
        bcv: usableRate(raw.rateBcv ?? raw.rate),
        eur: usableRate(raw.rateEur),
        binance: usableRate(raw.rateBinance),
    };
}

/**
 * Una transacción guardada → forma canónica, resolviendo en la LECTURA los
 * documentos anteriores a la multimoneda (que traen amountBs/exchangeRate/
 * amountUsd y son, por definición, movimientos en bolívares). No se reescribe
 * nada en Firestore: un movimiento viejo se interpreta, no se migra.
 */
export function normalizeTransaction(raw) {
    if (!raw) return raw;

    const isLegacy = raw.currencyOriginal === undefined;
    if (!isLegacy) return raw;

    const amountBs = Number(raw.amountBs) || 0;
    const rateBcv = usableRate(raw.exchangeRate);

    return {
        ...raw,
        amountOriginal: amountBs,
        currencyOriginal: 'VES',
        rateBcvApplied: rateBcv,
        rateEurApplied: null,
        rateBinanceApplied: null,
        // Se prefiere el amountUsd ya guardado (es el que el usuario vio en su
        // momento) antes que recalcularlo, aunque venga redondeado a 2 decimales.
        amountUsdBcv: Number(raw.amountUsd) || (rateBcv ? amountBs / rateBcv : 0),
    };
}

/** Las tasas con las que se registró un movimiento (su snapshot). */
export function transactionRates(tx) {
    return {
        bcv: usableRate(tx?.rateBcvApplied),
        eur: usableRate(tx?.rateEurApplied),
        binance: usableRate(tx?.rateBinanceApplied),
    };
}
