// src/composables/tutorialDriver.js
// Chunk lazy de driver.js: se carga sólo cuando el usuario abre un tutorial, no
// en el bundle de entrada (mismo criterio que DateField con el datepicker).
// El CSS de la librería se importa acá, así que su orden de carga respecto a
// style.css NO está garantizado — por eso los overrides de .driver-* en la
// sección 9 de style.css van con !important (ver gotcha #4 de CLAUDE.md).
import { driver } from 'driver.js';
import 'driver.js/dist/driver.css';

export { driver };
