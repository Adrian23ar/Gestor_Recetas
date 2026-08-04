// src/composables/useTutorial.js
// Sistema de tutoriales guiados sobre driver.js.
//
// Cada vista registra su tour con useViewTutorial(): el botón "?" del header
// (App.vue) lo dispara cuando el usuario quiera, y la primera visita lo abre
// sola. El contenido de los pasos vive en src/utils/tourSteps.js.
import { nextTick, onBeforeUnmount, onMounted, shallowRef, watch } from 'vue';

const SEEN_KEY = 'tutorialSeen';
// Deja terminar la transición de ruta (fade-transition, 0.2s) antes de abrir
// el tutorial solo, para que no aparezca encima de la vista saliente.
const AUTOSTART_DELAY = 450;

// Tour de la vista montada en este momento (sólo hay una vista a la vez).
const activeTour = shallowRef(null);

let driverInstance = null;
let driverFactoryPromise = null;

function loadDriverFactory() {
    if (!driverFactoryPromise) {
        driverFactoryPromise = import('./tutorialDriver.js').then(m => m.driver);
    }
    return driverFactoryPromise;
}

function readSeen() {
    try {
        const raw = localStorage.getItem(SEEN_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

export function hasSeenTour(id) {
    return readSeen()[id] === true;
}

function markSeen(id) {
    try {
        localStorage.setItem(SEEN_KEY, JSON.stringify({ ...readSeen(), [id]: true }));
    } catch {
        // Sin localStorage disponible el tutorial se volverá a abrir solo la
        // próxima vez. Molesto, pero no rompe nada.
    }
}

// "A la vista" = ocupa espacio real. display:none no devuelve rects, y eso
// incluye las dos variantes responsive de ResponsiveTable (la tabla de
// escritorio y las tarjetas de móvil conviven en el DOM, una oculta por CSS).
function isVisible(el) {
    if (!el || !el.getClientRects().length) return false;
    return window.getComputedStyle(el).visibility !== 'hidden';
}

// Sólo se descartan los pasos marcados `optional` (su anclaje existe o no según
// los datos: estados vacíos, avisos condicionales) y los que tengan `when` en
// false. Un paso normal se conserva aunque su elemento todavía no esté en el
// DOM: en el tour de RecipeDrawer hay pasos que sólo aparecen después de que un
// paso anterior cambia de pestaña.
function resolveSteps(steps) {
    return steps.filter(step => {
        if (typeof step.when === 'function' && !step.when()) return false;
        if (!step.optional || !step.element) return true;

        const el = document.querySelector(step.element);
        if (!el && import.meta.env.DEV) {
            // Distingue "no hay datos que mostrar" (esperado, el elemento existe
            // pero está oculto) de un anclaje mal escrito: si el selector no
            // encuentra NADA, muy probablemente falte el data-tour en la plantilla.
            console.warn(`[tutorial] sin elemento para "${step.element}" — ¿falta el data-tour?`);
        }
        return isVisible(el);
    });
}

// Traduce el paso "de la app" al shape de driver.js.
// onNext/onPrev dejan que un paso prepare la UI antes de moverse (cambiar de
// pestaña, por ejemplo). OJO: driver.js NO avanza solo cuando se define
// onNextClick — hay que llamar a moveNext()/movePrevious() a mano.
function toDriverStep(step) {
    const popover = { title: step.title, description: step.description };
    if (step.side) popover.side = step.side;
    if (step.align) popover.align = step.align;

    if (step.onNext) {
        popover.onNextClick = async () => {
            await step.onNext();
            await nextTick(); // el DOM del paso siguiente ya existe acá
            driverInstance?.moveNext();
        };
    }
    if (step.onPrev) {
        popover.onPrevClick = async () => {
            await step.onPrev();
            await nextTick();
            driverInstance?.movePrevious();
        };
    }

    return step.element ? { element: step.element, popover } : { popover };
}

export async function startTour(tour) {
    if (!tour) return;

    // Se resuelve ANTES de instanciar driver para que el contador de progreso
    // ("2 de 7") cuente sólo los pasos que se van a mostrar: driver.js calcula
    // el total sobre el array completo, aunque después salte pasos.
    const steps = resolveSteps(tour.getSteps());
    if (!steps.length) return;

    markSeen(tour.id);

    const createDriver = await loadDriverFactory();
    if (driverInstance?.isActive()) driverInstance.destroy();

    driverInstance = createDriver({
        steps: steps.map(toDriverStep),
        smoothScroll: true,
        overlayColor: '#1c1917', // stone-900
        overlayOpacity: 0.62,
        stagePadding: 8,
        stageRadius: 14, // = rounded-field
        popoverOffset: 12,
        popoverClass: 'ui-tour',
        showProgress: steps.length > 1,
        progressText: '{{current}} de {{total}}',
        nextBtnText: 'Siguiente',
        prevBtnText: 'Anterior',
        doneBtnText: 'Entendido',
        // Red de seguridad por si un anclaje desaparece a mitad del recorrido.
        skipMissingElement: true,
    });
    driverInstance.drive();
}

export function stopTour() {
    if (driverInstance?.isActive()) driverInstance.destroy();
}

/**
 * Registra el tour de la vista montada y lo abre solo la primera vez.
 *
 * @param {{ id: string, getSteps: () => Array }} tour  getSteps() se evalúa al
 *   abrir el tutorial, no al registrarlo, para leer el estado real de la vista.
 * @param {import('vue').Ref<boolean>|(() => boolean)} [ready]  fuente reactiva
 *   que indica que la vista ya cargó sus datos (salió del skeleton). Sin ella no
 *   hay apertura automática, sólo manual desde el botón "?".
 */
export function useViewTutorial(tour, ready) {
    let autoStartTimer = null;

    onMounted(() => { activeTour.value = tour; });

    onBeforeUnmount(() => {
        if (autoStartTimer) clearTimeout(autoStartTimer);
        if (activeTour.value === tour) activeTour.value = null;
        stopTour();
    });

    if (ready) {
        // No se puede cortar este watcher con el stop() que devuelve watch()
        // desde dentro de su propia llamada `immediate`: en ese momento todavía
        // no está asignado. De ahí la bandera.
        let handled = false;
        watch(ready, (isReady) => {
            if (!isReady || handled) return;
            handled = true;
            if (hasSeenTour(tour.id)) return;
            autoStartTimer = setTimeout(() => {
                // La vista pudo cambiar durante la espera.
                if (activeTour.value === tour) startTour(tour);
            }, AUTOSTART_DELAY);
        }, { immediate: true });
    }

    return { start: () => startTour(tour) };
}

/** Estado que consume el botón "?" del header. */
export function useTutorialLauncher() {
    return {
        activeTour,
        start: () => startTour(activeTour.value),
    };
}
