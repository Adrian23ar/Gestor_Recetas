// src/router/index.js
import { createRouter, createWebHistory } from 'vue-router';

const routes = [
  {
    path: '/',
    name: 'Dashboard',
    component: () => import('../views/DashboardView.vue'),
  },
  {
    path: '/ingredients',
    name: 'Ingredients',
    component: () => import('../views/IngredientsView.vue'),
  },
  {
    path: '/register',
    name: 'ProductionRegister',
    component: () => import('../views/RegisterView.vue'),
  },
  {
    path: '/historial',
    name: 'EventHistory',
    component: () => import('../views/EventHistoryView.vue'),
  },
  // --- AÑADIR ESTA NUEVA RUTA ---
  {
    path: '/contabilidad', // La URL para el módulo de contabilidad
    name: 'Accounting',     // Nombre de la ruta
    component: () => import('../views/AccountingView.vue') // Apunta a tu nueva vista
  }
  // --- FIN NUEVA RUTA ---
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;