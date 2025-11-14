// src/stores/userData.js
import { ref, watch } from 'vue';
import { defineStore } from 'pinia';
import { useAuth } from '../composables/useAuth';
import { db } from '../main';
import { collection, doc, getDocs, setDoc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";
import { useLocalStorage } from '../composables/useLocalStorage';
import { useEventHistory } from '../composables/useEventHistory';



export const useUserDataStore = defineStore('userData', () => {

    // --- Estado Reactivo ---
    const recipes = useLocalStorage('recipes', []);
    const globalIngredients = useLocalStorage('globalIngredients', []);
    const productionRecords = useLocalStorage('productionRecords', []);
    const { user, authLoading } = useAuth(); // <--- Necesitas authLoading aquí
    const dataLoading = ref(true); // Assuming you still have loadInitialData or similar
    const dataError = ref(null);

    // --- Inicializar useEventHistory ---
    const { addEventHistoryEntry } = useEventHistory();
    // Helper function for detailed ingredient changes (from your example)
    function getIngredientChangeDetails(oldIngredients = [], newIngredients = [], globalIngredientsList) {
        const changes = [];
        const oldIngMap = new Map((oldIngredients || []).map(i => [i.ingredientId, { ...i }]));
        const newIngMap = new Map((newIngredients || []).map(i => [i.ingredientId, { ...i }]));
        const allIngredientIds = new Set([...oldIngMap.keys(), ...newIngMap.keys()]);

        for (const id of allIngredientIds) {
            const oldIngData = oldIngMap.get(id);
            const newIngData = newIngMap.get(id);
            // Ensure globalIngredientsList is an array, provide default if item not found
            const ingDetailsOptions = Array.isArray(globalIngredientsList) ? globalIngredientsList : [];
            const ingDetails = ingDetailsOptions.find(g => g.id === id) || { name: `ID:${id}`, unit: '' };

            if (oldIngData && !newIngData) { // Deleted
                changes.push({
                    field: 'ingredient_removed',
                    oldValue: `${ingDetails.name} (${oldIngData.quantity} ${oldIngData.unit || ingDetails.unit})`,
                    newValue: null,
                    label: `Ingrediente Eliminado: ${ingDetails.name}`
                });
            } else if (!oldIngData && newIngData) { // Added
                changes.push({
                    field: 'ingredient_added',
                    oldValue: null,
                    newValue: `${ingDetails.name} (${newIngData.quantity} ${newIngData.unit || ingDetails.unit})`,
                    label: `Ingrediente Añadido: ${ingDetails.name}`
                });
            } else if (oldIngData && newIngData) { // Potentially modified
                if (String(oldIngData.quantity) !== String(newIngData.quantity)) { // Compare as strings in case of number vs string number
                    changes.push({
                        field: 'ingredient_quantity_updated',
                        // ingredientName: ingDetails.name, // Name is in label
                        oldValue: oldIngData.quantity,
                        newValue: newIngData.quantity,
                        // unit: ingDetails.unit, // Unit is in label
                        label: `Cantidad de ${ingDetails.name}`
                    });
                }
                // Optional: Check for unit changes if recipe ingredients can have their own units
                const oldRecipeUnit = oldIngData.unit;
                const newRecipeUnit = newIngData.unit;
                if (oldRecipeUnit !== newRecipeUnit && (oldRecipeUnit || newRecipeUnit)) { // only if one has a unit and they differ
                    changes.push({
                        field: 'ingredient_unit_updated',
                        oldValue: oldRecipeUnit || `(global: ${ingDetails.unit})`,
                        newValue: newRecipeUnit || `(global: ${ingDetails.unit})`,
                        label: `Unidad de ${ingDetails.name} (en receta)`
                    });
                }
            }
        }
        return changes;
    }


    // --- Helper para generar detalles de cambios ---
    function getChangeDetails(originalObject, updatedObject, ignoreFields = ['id']) {
        const changes = [];
        const allKeys = new Set([...Object.keys(originalObject || {}), ...Object.keys(updatedObject || {})]);

        for (const key of allKeys) {
            if (ignoreFields.includes(key)) continue;

            const oldValue = originalObject ? originalObject[key] : undefined;
            const newValue = updatedObject ? updatedObject[key] : undefined;

            if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
                // Handle specific case for 'ingredients' array in recipes
                if (key === 'ingredients' && (Array.isArray(oldValue) || Array.isArray(newValue))) {
                    const ingredientChanges = getIngredientChangeDetails(oldValue, newValue, globalIngredients.value);
                    if (ingredientChanges.length > 0) {
                        changes.push(...ingredientChanges); // Add detailed ingredient changes
                    }
                } else if (Array.isArray(oldValue) || Array.isArray(newValue)) {
                    changes.push({
                        field: key,
                        oldValue: oldValue ? `Lista (${(oldValue).length} items)` : 'Vacío',
                        newValue: newValue ? `Lista (${(newValue).length} items)` : 'Vacío',
                        label: getFieldLabel(key)
                    });
                } else {
                    changes.push({
                        field: key,
                        oldValue: oldValue,
                        newValue: newValue,
                        label: getFieldLabel(key)
                    });
                }
            }
        }
        return changes;
    }

    function getFieldLabel(key) {
        const labels = {
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
            // Labels for ingredient changes (from getIngredientChangeDetails)
            'ingredient_removed': 'Ingrediente Eliminado',
            'ingredient_added': 'Ingrediente Añadido',
            'ingredient_quantity_updated': 'Cantidad de Ingrediente', // Dynamic part in getIngredientChangeDetails
            'ingredient_unit_updated': 'Unidad de Ingrediente', // Dynamic part
        };
        // For dynamic fields like ingredient_<id>_quantity, the label is mostly set in getIngredientChangeDetails
        // This getFieldLabel is a fallback or for top-level fields.
        return labels[key] || key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    }


    // --- Funciones CRUD para Recetas ---
    async function addRecipe(tempRecipe) {
        const tempId = tempRecipe.id;
        const recipeDataForFirestore = { ...tempRecipe };
        delete recipeDataForFirestore.id;

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const recipesColRef = collection(db, `users/${user.value.uid}/recipes`);
            const newRecipeDocRef = doc(recipesColRef); // Firestore generates ID
            const firestoreId = newRecipeDocRef.id;

            // 1. Preparar datos locales optimistas
            const localRecipeData = { ...tempRecipe, id: firestoreId };

            // 2. Ejecutar actualización optimista de UI PRIMERO
            const localIndex = recipes.value.findIndex(r => r.id === tempId);
            if (localIndex !== -1) {
                recipes.value.splice(localIndex, 1, localRecipeData);
            } else {
                recipes.value.push(localRecipeData);
            }

            // 3. "Disparar y Olvidar" la escritura en Firestore
            addEventHistoryEntry({
                eventType: 'RECIPE_CREATED',
                entityType: 'Receta',
                entityId: firestoreId,
                entityName: tempRecipe.name,
                changes: Object.keys(recipeDataForFirestore).map(key => ({
                    field: key,
                    oldValue: null,
                    newValue: recipeDataForFirestore[key],
                    label: getFieldLabel(key)
                }))
            }, batch).then(() => {
                batch.set(newRecipeDocRef, recipeDataForFirestore);

                batch.commit().then(() => {
                    console.log(`Sincronización (addRecipe ${firestoreId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'addRecipe' a Firestore:", e);
                    dataError.value = "Error al sincronizar nueva receta.";
                    // Rollback de la UI
                    recipes.value = recipes.value.filter(r => r.id !== firestoreId);
                });
            }).catch(e => {
                console.error("Error al preparar el historial para 'addRecipe':", e);
                dataError.value = "Error al preparar historial.";
                recipes.value = recipes.value.filter(r => r.id !== firestoreId); // Rollback
            });

            // 4. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---

        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const finalId = tempRecipe.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const recipeToAdd = { ...tempRecipe, id: finalId };

            await addEventHistoryEntry({
                eventType: 'RECIPE_CREATED',
                entityType: 'Receta',
                entityId: recipeToAdd.id,
                entityName: recipeToAdd.name,
                changes: Object.keys(recipeDataForFirestore).map(key => ({
                    field: key,
                    oldValue: null,
                    newValue: recipeDataForFirestore[key],
                    label: getFieldLabel(key)
                }))
            });

            const existingIndex = recipes.value.findIndex(r => r.id === tempId);
            if (existingIndex !== -1) {
                recipes.value.splice(existingIndex, 1, recipeToAdd);
            } else if (!recipes.value.find(r => r.id === finalId)) {
                recipes.value.push(recipeToAdd);
            }
            return true;
        }
    }

    async function deleteRecipe(recipeId) {
        const recipeToDeleteIndex = recipes.value.findIndex(recipe => recipe.id === recipeId);
        if (recipeToDeleteIndex === -1) {
            console.warn(`useUserData: Receta con ID ${recipeId} no encontrada para eliminar.`);
            dataError.value = `Receta con ID ${recipeId} no encontrada.`;
            return 'Desconocida';
        }
        // 1. Guardar estado original y ejecutar actualización optimista
        const recipeToDelete = JSON.parse(JSON.stringify(recipes.value[recipeToDeleteIndex]));
        recipes.value.splice(recipeToDeleteIndex, 1); // Optimistic local delete

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const recipeDocRef = doc(db, `users/${user.value.uid}/recipes`, recipeId);
            batch.delete(recipeDocRef);

            // 2. "Disparar y Olvidar"
            addEventHistoryEntry({
                eventType: 'RECIPE_DELETED',
                entityType: 'Receta',
                entityId: recipeToDelete.id,
                entityName: recipeToDelete.name,
                changes: Object.keys(recipeToDelete).filter(k => k !== 'id').map(key => ({
                    field: key,
                    oldValue: recipeToDelete[key],
                    newValue: null,
                    label: getFieldLabel(key)
                }))
            }, batch).then(() => {
                batch.commit().then(() => {
                    console.log(`Sincronización (deleteRecipe ${recipeId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'deleteRecipe' a Firestore: ", e);
                    dataError.value = "Error al eliminar receta del servidor.";
                    // 3. Rollback en caso de error
                    recipes.value.splice(recipeToDeleteIndex, 0, recipeToDelete);
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'deleteRecipe':", e);
                dataError.value = "Error al preparar historial de borrado.";
                recipes.value.splice(recipeToDeleteIndex, 0, recipeToDelete); // Rollback
            });

            // 4. Retornar éxito inmediatamente
            return recipeToDelete.name;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            await addEventHistoryEntry({
                eventType: 'RECIPE_DELETED',
                entityType: 'Receta',
                entityId: recipeToDelete.id,
                entityName: recipeToDelete.name,
                changes: Object.keys(recipeToDelete).filter(k => k !== 'id').map(key => ({
                    field: key,
                    oldValue: recipeToDelete[key],
                    newValue: null,
                    label: getFieldLabel(key)
                }))
            });
            return recipeToDelete.name; // For success toast
        }
    }

    async function saveRecipe(updatedRecipe) {
        const index = recipes.value.findIndex(r => r.id === updatedRecipe.id);
        if (index === -1) {
            console.warn("useUserData: Attempted to save recipe not found in local state:", updatedRecipe.id);
            dataError.value = "Error: Receta a guardar no encontrada localmente.";
            return false;
        }

        // 1. Guardar estado original y ejecutar actualización optimista
        const originalRecipe = JSON.parse(JSON.stringify(recipes.value[index]));
        recipes.value.splice(index, 1, { ...updatedRecipe }); // Optimistic local update

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const recipeDocRef = doc(db, `users/${user.value.uid}/recipes`, updatedRecipe.id);
            const firestoreRecipeData = { ...updatedRecipe };
            delete firestoreRecipeData.id;
            batch.set(recipeDocRef, firestoreRecipeData, { merge: true });

            // 2. "Disparar y Olvidar"
            const changes = getChangeDetails(originalRecipe, updatedRecipe, ['id', 'calculatedTotalCost', 'calculatedFinalPrice']);
            if (changes.length > 0) {
                addEventHistoryEntry({
                    eventType: 'RECIPE_EDITED',
                    entityType: 'Receta',
                    entityId: updatedRecipe.id,
                    entityName: updatedRecipe.name,
                    changes: changes
                }, batch).then(() => {
                    // Solo commitea si hubo cambios
                    batch.commit().then(() => {
                        console.log(`Sincronización (saveRecipe ${updatedRecipe.id}) exitosa.`);
                    }).catch(e => {
                        console.error("Error al sincronizar 'saveRecipe' a Firestore: ", e);
                        dataError.value = "Error al guardar receta en el servidor.";
                        // 3. Rollback en caso de error
                        recipes.value.splice(index, 1, originalRecipe);
                    });
                }).catch(e => {
                    console.error("Error al preparar historial para 'saveRecipe':", e);
                    dataError.value = "Error al preparar historial de guardado.";
                    recipes.value.splice(index, 1, originalRecipe); // Rollback
                });
            } else {
                // Si no hay cambios, no necesitamos hacer commit ni rollback
                console.log("saveRecipe: No hay cambios detectados para sincronizar.");
            }

            // 4. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const changes = getChangeDetails(originalRecipe, updatedRecipe, ['id', 'calculatedTotalCost', 'calculatedFinalPrice']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'RECIPE_EDITED',
                    entityType: 'Receta',
                    entityId: updatedRecipe.id,
                    entityName: updatedRecipe.name,
                    changes: changes
                });
            }
            return true;
        }
    }


    // --- Funciones CRUD para Ingredientes ---
    async function addIngredient(ingredientDataWithInitialStock) {
        const tempId = ingredientDataWithInitialStock.id; // Might be temporary
        const ingredientForFirestore = {
            name: ingredientDataWithInitialStock.name,
            cost: Number(ingredientDataWithInitialStock.cost),
            presentationSize: Number(ingredientDataWithInitialStock.presentationSize),
            unit: ingredientDataWithInitialStock.unit,
            currentStock: Number(ingredientDataWithInitialStock.initialStock) || 0 // Use initialStock for currentStock
        };

        if (user.value) {
            // --- INICIO REFACTOR 1.3 (Ya aplicado por ti) ---
            const batch = writeBatch(db);
            const ingredientsColRef = collection(db, `users/${user.value.uid}/ingredients`);
            const newIngredientDocRef = doc(ingredientsColRef);
            const firestoreId = newIngredientDocRef.id;

            const localData = { ...ingredientDataWithInitialStock, id: firestoreId, currentStock: ingredientForFirestore.currentStock };
            delete localData.initialStock;

            const localIndex = globalIngredients.value.findIndex(i => i.id === tempId);
            if (localIndex !== -1) {
                globalIngredients.value.splice(localIndex, 1, localData);
            } else {
                globalIngredients.value.push(localData);
            }

            addEventHistoryEntry({
                eventType: 'INGREDIENT_CREATED',
                entityType: 'Ingrediente',
                entityId: firestoreId,
                entityName: ingredientForFirestore.name,
                changes: Object.keys(ingredientForFirestore).map(key => ({
                    field: key,
                    oldValue: null,
                    newValue: ingredientForFirestore[key],
                    label: getFieldLabel(key)
                }))
            }, batch).then(() => {
                batch.set(newIngredientDocRef, ingredientForFirestore);

                batch.commit().then(() => {
                    console.log(`Sincronización (addIngredient ${firestoreId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'addIngredient' a Firestore:", e);
                    dataError.value = "Error al sincronizar un nuevo ingrediente.";
                    globalIngredients.value = globalIngredients.value.filter(i => i.id !== firestoreId);
                });

            }).catch(e => {
                console.error("Error al preparar el historial para 'addIngredient':", e);
                dataError.value = "Error al preparar historial.";
                globalIngredients.value = globalIngredients.value.filter(i => i.id !== firestoreId);
            });

            return true;
            // --- FIN REFACTOR 1.3 ---

        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const finalId = tempId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const localIngredient = {
                ...ingredientDataWithInitialStock,
                id: finalId,
                currentStock: Number(ingredientDataWithInitialStock.initialStock) || 0
            };
            delete localIngredient.initialStock;

            await addEventHistoryEntry({
                eventType: 'INGREDIENT_CREATED',
                entityType: 'Ingrediente',
                entityId: localIngredient.id,
                entityName: localIngredient.name,
                changes: Object.keys(ingredientForFirestore).map(key => ({ // ingredientForFirestore is the clean data structure
                    field: key,
                    oldValue: null,
                    newValue: ingredientForFirestore[key], // Log the processed values
                    label: getFieldLabel(key)
                }))
            });
            const existingIndex = globalIngredients.value.findIndex(i => i.id === tempId);
            if (existingIndex !== -1) {
                globalIngredients.value.splice(existingIndex, 1, localIngredient);
            } else if (!globalIngredients.value.find(i => i.id === finalId)) {
                globalIngredients.value.push(localIngredient);
            }
            return true;
        }
    }

    async function deleteIngredient(ingredientId) {
        const ingredientToDeleteIndex = globalIngredients.value.findIndex(ing => ing.id === ingredientId);
        if (ingredientToDeleteIndex === -1) {
            console.warn(`useUserData: Ingrediente con ID ${ingredientId} no encontrado para eliminar.`);
            dataError.value = `Ingrediente ID ${ingredientId} no encontrado.`;
            return 'Desconocido';
        }
        // 1. Guardar estado original y ejecutar actualización optimista
        const ingredientToDelete = JSON.parse(JSON.stringify(globalIngredients.value[ingredientToDeleteIndex]));
        globalIngredients.value.splice(ingredientToDeleteIndex, 1); // Optimistic

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const ingredientDocRef = doc(db, `users/${user.value.uid}/ingredients`, ingredientId);
            batch.delete(ingredientDocRef);

            // 2. "Disparar y Olvidar"
            addEventHistoryEntry({
                eventType: 'INGREDIENT_DELETED',
                entityType: 'Ingrediente',
                entityId: ingredientToDelete.id,
                entityName: ingredientToDelete.name,
                changes: Object.keys(ingredientToDelete).filter(k => k !== 'id').map(key => ({
                    field: key,
                    oldValue: ingredientToDelete[key],
                    newValue: null,
                    label: getFieldLabel(key)
                }))
            }, batch).then(() => {
                batch.commit().then(() => {
                    console.log(`Sincronización (deleteIngredient ${ingredientId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'deleteIngredient' a Firestore: ", e);
                    dataError.value = "Error al eliminar ingrediente del servidor.";
                    // 3. Rollback
                    globalIngredients.value.splice(ingredientToDeleteIndex, 0, ingredientToDelete);
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'deleteIngredient':", e);
                dataError.value = "Error al preparar historial de borrado.";
                globalIngredients.value.splice(ingredientToDeleteIndex, 0, ingredientToDelete); // Rollback
            });

            // 4. Retornar éxito inmediatamente
            return ingredientToDelete.name;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            await addEventHistoryEntry({
                eventType: 'INGREDIENT_DELETED',
                entityType: 'Ingrediente',
                entityId: ingredientToDelete.id,
                entityName: ingredientToDelete.name,
                changes: Object.keys(ingredientToDelete).filter(k => k !== 'id').map(key => ({
                    field: key,
                    oldValue: ingredientToDelete[key],
                    newValue: null,
                    label: getFieldLabel(key)
                }))
            });
            return ingredientToDelete.name;
        }
    }

    async function saveIngredient(updatedIngredient) {
        const index = globalIngredients.value.findIndex(ing => ing.id === updatedIngredient.id);
        if (index === -1) {
            dataError.value = "Error: Ingrediente a guardar no encontrado localmente.";
            return false;
        }
        // 1. Guardar estado original y ejecutar actualización optimista
        const originalIngredient = JSON.parse(JSON.stringify(globalIngredients.value[index]));
        const processedIngredient = {
            ...updatedIngredient,
            cost: Number(updatedIngredient.cost),
            presentationSize: Number(updatedIngredient.presentationSize),
            currentStock: Number(updatedIngredient.currentStock) || 0
        };
        globalIngredients.value.splice(index, 1, { ...processedIngredient }); // Optimistic

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const ingredientDocRef = doc(db, `users/${user.value.uid}/ingredients`, processedIngredient.id);
            const firestoreIngredientData = { ...processedIngredient };
            delete firestoreIngredientData.id;
            batch.set(ingredientDocRef, firestoreIngredientData, { merge: true });

            // 2. "Disparar y Olvidar"
            const changes = getChangeDetails(originalIngredient, processedIngredient, ['id']);
            if (changes.length > 0) {
                addEventHistoryEntry({
                    eventType: 'INGREDIENT_EDITED',
                    entityType: 'Ingrediente',
                    entityId: processedIngredient.id,
                    entityName: processedIngredient.name,
                    changes: changes
                }, batch).then(() => {
                    batch.commit().then(() => {
                        console.log(`Sincronización (saveIngredient ${processedIngredient.id}) exitosa.`);
                    }).catch(e => {
                        console.error("Error al sincronizar 'saveIngredient' en Firestore: ", e);
                        dataError.value = "Error al guardar ingrediente en el servidor.";
                        // 3. Rollback
                        globalIngredients.value.splice(index, 1, originalIngredient);
                    });
                }).catch(e => {
                    console.error("Error al preparar historial para 'saveIngredient':", e);
                    dataError.value = "Error al preparar historial de guardado.";
                    globalIngredients.value.splice(index, 1, originalIngredient); // Rollback
                });
            } else {
                console.log("saveIngredient: No hay cambios detectados para sincronizar.");
            }

            // 4. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const changes = getChangeDetails(originalIngredient, processedIngredient, ['id']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'INGREDIENT_EDITED',
                    entityType: 'Ingrediente',
                    entityId: processedIngredient.id,
                    entityName: processedIngredient.name,
                    changes: changes
                });
            }
            return true;
        }
    }

    // --- Funciones CRUD para Registros de Producción ---
    async function addProductionRecord(recordData) {
        const tempId = recordData.id; // May be temporary
        const recordToAdd = {
            recipeId: recordData.recipeId || null,
            productName: recordData.productName || 'Desconocido',
            batchSize: Number(recordData.batchSize) || 0,
            date: recordData.date || new Date().toISOString().split('T')[0],
            totalRevenue: Number(recordData.totalRevenue) || 0,
            operatingCostRecipeOnly: Number(recordData.recipeOnlyCost) || 0,
            laborCostForBatch: Number(recordData.laborCost) || 0,
            netProfit: Number(recordData.netProfit) || 0,
            isSold: typeof recordData.isSold === 'boolean' ? recordData.isSold : false,
        };

        const stockUpdateDetails = [];
        const originalIngredientStatesForRollback = [];

        // 1. Ejecutar actualización optimista de UI (Stock) PRIMERO
        if (recordToAdd.recipeId && recordToAdd.batchSize > 0) {
            const recipeUsed = recipes.value.find(r => r.id === recordToAdd.recipeId);
            if (recipeUsed && Array.isArray(recipeUsed.ingredients)) {
                for (const recipeIng of recipeUsed.ingredients) {
                    const globalIngIndex = globalIngredients.value.findIndex(g => g.id === recipeIng.ingredientId);
                    if (globalIngIndex !== -1) {
                        const originalGlobalIng = globalIngredients.value[globalIngIndex];
                        originalIngredientStatesForRollback.push({ index: globalIngIndex, oldStock: originalGlobalIng.currentStock });

                        const quantityUsed = (Number(recipeIng.quantity) || 0);
                        if (quantityUsed > 0) {
                            const newStock = (Number(originalGlobalIng.currentStock) || 0) - quantityUsed;
                            globalIngredients.value[globalIngIndex] = { ...originalGlobalIng, currentStock: newStock }; // Optimistic local stock update

                            stockUpdateDetails.push({
                                ingredientId: originalGlobalIng.id,
                                ingredientName: originalGlobalIng.name,
                                oldStock: originalGlobalIng.currentStock,
                                newStock: newStock,
                                label: `Stock ajustado por Producción: ${recordToAdd.productName}`
                            });
                        }
                    }
                }
            }
        }

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const productionColRef = collection(db, `users/${user.value.uid}/production`);
            const newRecordDocRef = doc(productionColRef);
            const firestoreId = newRecordDocRef.id;

            const firestoreRecordData = {
                ...recordToAdd,
                isSold: typeof recordToAdd.isSold === 'boolean' ? recordToAdd.isSold : false
            };
            batch.set(newRecordDocRef, firestoreRecordData);

            // 2. Ejecutar actualización optimista de UI (Registro)
            const localRecord = { ...recordData, ...recordToAdd, id: firestoreId };
            const localIndex = productionRecords.value.findIndex(r => r.id === tempId);
            if (localIndex !== -1) {
                productionRecords.value.splice(localIndex, 1, localRecord);
            } else {
                productionRecords.value.push(localRecord);
            }

            // 3. "Disparar y Olvidar"
            // Preparamos el historial para el registro principal
            addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_CREATED',
                entityType: 'Registro de Producción',
                entityId: firestoreId,
                entityName: recordToAdd.productName,
                changes: Object.keys(recordToAdd).map(key => ({
                    field: key, oldValue: null, newValue: recordToAdd[key], label: getFieldLabel(key)
                }))
            }, batch).then(async () => { // Usamos async aquí para el bucle
                // Preparamos el historial y los updates de stock
                for (const stockUpdate of stockUpdateDetails) {
                    const ingDocRef = doc(db, `users/${user.value.uid}/ingredients`, stockUpdate.ingredientId);
                    batch.update(ingDocRef, { currentStock: stockUpdate.newStock });
                    await addEventHistoryEntry({ // Await dentro del loop está bien
                        eventType: 'STOCK_ADJUST_BY_PRODUCTION_ADD',
                        entityType: 'Stock de Ingrediente',
                        entityId: stockUpdate.ingredientId,
                        entityName: stockUpdate.ingredientName,
                        relatedEntityId: firestoreId,
                        relatedEntityName: recordToAdd.productName,
                        changes: [{
                            field: 'currentStock',
                            oldValue: stockUpdate.oldStock,
                            newValue: stockUpdate.newStock,
                            label: stockUpdate.label
                        }]
                    }, batch);
                }

                // Ahora que todo está en el batch, lo enviamos
                batch.commit().then(() => {
                    console.log(`Sincronización (addProductionRecord ${firestoreId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'addProductionRecord' a Firestore:", e);
                    dataError.value = "Error al guardar registro de producción.";
                    // 4. Rollback
                    productionRecords.value = productionRecords.value.filter(r => r.id !== firestoreId);
                    originalIngredientStatesForRollback.forEach(item => {
                        globalIngredients.value[item.index].currentStock = item.oldStock;
                    });
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'addProductionRecord':", e);
                dataError.value = "Error al preparar historial de producción.";
                // 4. Rollback
                productionRecords.value = productionRecords.value.filter(r => r.id !== firestoreId);
                originalIngredientStatesForRollback.forEach(item => {
                    globalIngredients.value[item.index].currentStock = item.oldStock;
                });
            });

            // 5. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const finalId = tempId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const localRecord = { ...recordData, ...recordToAdd, id: finalId };

            await addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_CREATED',
                entityType: 'Registro de Producción',
                entityId: localRecord.id,
                entityName: localRecord.productName,
                changes: Object.keys(recordToAdd).map(key => ({
                    field: key, oldValue: null, newValue: recordToAdd[key], label: getFieldLabel(key)
                }))
            });
            for (const stockUpdate of stockUpdateDetails) {
                await addEventHistoryEntry({
                    eventType: 'STOCK_ADJUST_BY_PRODUCTION_ADD',
                    entityType: 'Stock de Ingrediente',
                    entityId: stockUpdate.ingredientId,
                    entityName: stockUpdate.ingredientName,
                    relatedEntityId: localRecord.id,
                    relatedEntityName: localRecord.productName,
                    changes: [{
                        field: 'currentStock',
                        oldValue: stockUpdate.oldStock,
                        newValue: stockUpdate.newStock,
                        label: stockUpdate.label
                    }]
                });
            }
            const localIndex = productionRecords.value.findIndex(r => r.id === tempId);
            if (localIndex !== -1) {
                productionRecords.value.splice(localIndex, 1, localRecord);
            } else if (!productionRecords.value.find(r => r.id === finalId)) {
                productionRecords.value.push(localRecord);
            }
            return true;
        }
    }

    async function deleteProductionRecord(recordId) {
        dataError.value = null;
        const recordToDeleteIndex = productionRecords.value.findIndex(r => r.id === recordId);
        if (recordToDeleteIndex === -1) {
            dataError.value = "Error: Registro no encontrado.";
            return null;
        }
        // 1. Guardar estado original y ejecutar actualización optimista
        const recordToDelete = JSON.parse(JSON.stringify(productionRecords.value[recordToDeleteIndex]));
        const stockRestoreDetails = [];
        const originalIngredientStatesForRollback = [];

        if (recordToDelete.recipeId && recordToDelete.batchSize > 0) {
            const recipeUsed = recipes.value.find(r => r.id === recordToDelete.recipeId);
            if (recipeUsed && Array.isArray(recipeUsed.ingredients)) {
                for (const recipeIng of recipeUsed.ingredients) {
                    const globalIngIndex = globalIngredients.value.findIndex(g => g.id === recipeIng.ingredientId);
                    if (globalIngIndex !== -1) {
                        const originalGlobalIng = globalIngredients.value[globalIngIndex];
                        originalIngredientStatesForRollback.push({ index: globalIngIndex, oldStock: originalGlobalIng.currentStock });

                        const quantityToRestore = (Number(recipeIng.quantity) || 0);
                        if (quantityToRestore > 0) {
                            const restoredStock = (Number(originalGlobalIng.currentStock) || 0) + quantityToRestore;
                            globalIngredients.value[globalIngIndex] = { ...originalGlobalIng, currentStock: restoredStock }; // Optimistic

                            stockRestoreDetails.push({
                                ingredientId: originalGlobalIng.id,
                                ingredientName: originalGlobalIng.name,
                                oldStock: originalGlobalIng.currentStock,
                                newStock: restoredStock,
                                label: `Stock restaurado por eliminación de Prod: ${recordToDelete.productName}`
                            });
                        }
                    }
                }
            }
        }
        productionRecords.value.splice(recordToDeleteIndex, 1); // Optimistic delete of record

        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const recordDocRef = doc(db, `users/${user.value.uid}/production`, recordId);
            batch.delete(recordDocRef);

            // 2. "Disparar y Olvidar"
            addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_DELETED',
                entityType: 'Registro de Producción',
                entityId: recordToDelete.id,
                entityName: recordToDelete.productName,
                changes: Object.keys(recordToDelete).filter(k => k !== 'id').map(key => ({
                    field: key, oldValue: recordToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            }, batch).then(async () => {
                for (const stockRestore of stockRestoreDetails) {
                    const ingDocRef = doc(db, `users/${user.value.uid}/ingredients`, stockRestore.ingredientId);
                    batch.update(ingDocRef, { currentStock: stockRestore.newStock });
                    await addEventHistoryEntry({
                        eventType: 'STOCK_ADJUST_BY_PRODUCTION_DELETE',
                        entityType: 'Stock de Ingrediente',
                        entityId: stockRestore.ingredientId,
                        entityName: stockRestore.ingredientName,
                        relatedEntityId: recordToDelete.id,
                        relatedEntityName: recordToDelete.productName,
                        changes: [{
                            field: 'currentStock',
                            oldValue: stockRestore.oldStock,
                            newValue: stockRestore.newStock,
                            label: stockRestore.label
                        }]
                    }, batch);
                }

                batch.commit().then(() => {
                    console.log(`Sincronización (deleteProductionRecord ${recordId}) exitosa.`);
                }).catch(e => {
                    console.error("Error al sincronizar 'deleteProductionRecord' en Firestore:", e);
                    dataError.value = "Error al eliminar registro del servidor.";
                    // 3. Rollback
                    productionRecords.value.splice(recordToDeleteIndex, 0, recordToDelete);
                    originalIngredientStatesForRollback.forEach(item => {
                        globalIngredients.value[item.index].currentStock = item.oldStock;
                    });
                });
            }).catch(e => {
                console.error("Error al preparar historial para 'deleteProductionRecord':", e);
                dataError.value = "Error al preparar historial de borrado.";
                // 3. Rollback
                productionRecords.value.splice(recordToDeleteIndex, 0, recordToDelete);
                originalIngredientStatesForRollback.forEach(item => {
                    globalIngredients.value[item.index].currentStock = item.oldStock;
                });
            });

            // 4. Retornar éxito inmediatamente
            return recordToDelete.productName;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            await addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_DELETED',
                entityType: 'Registro de Producción',
                entityId: recordToDelete.id,
                entityName: recordToDelete.productName,
                changes: Object.keys(recordToDelete).filter(k => k !== 'id').map(key => ({
                    field: key, oldValue: recordToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            });
            for (const stockRestore of stockRestoreDetails) {
                await addEventHistoryEntry({
                    eventType: 'STOCK_ADJUST_BY_PRODUCTION_DELETE',
                    entityType: 'Stock de Ingrediente',
                    entityId: stockRestore.ingredientId,
                    entityName: stockRestore.ingredientName,
                    relatedEntityId: recordToDelete.id,
                    relatedEntityName: recordToDelete.productName,
                    changes: [{
                        field: 'currentStock',
                        oldValue: stockRestore.oldStock,
                        newValue: stockRestore.newStock,
                        label: stockRestore.label
                    }]
                });
            }
            return recordToDelete.productName;
        }
    }

    async function saveProductionRecord(updatedRecordData) {
        const index = productionRecords.value.findIndex(r => r.id === updatedRecordData.id);
        if (index === -1) {
            dataError.value = "Error: Registro de producción no encontrado.";
            return false;
        }
        // 1. Guardar estado original y ejecutar actualización optimista
        const originalRecord = JSON.parse(JSON.stringify(productionRecords.value[index]));
        const updatedRecord = {
            ...updatedRecordData,
            batchSize: Number(updatedRecordData.batchSize) || 0,
            totalRevenue: Number(updatedRecordData.totalRevenue) || 0,
            operatingCostRecipeOnly: Number(updatedRecordData.operatingCostRecipeOnly) || 0,
            laborCostForBatch: Number(updatedRecordData.laborCostForBatch) || 0,
            netProfit: Number(updatedRecordData.netProfit) || 0,
            isSold: typeof updatedRecordData.isSold === 'boolean' ? updatedRecordData.isSold : false,
        };

        const stockAdjustmentEvents = [];
        const firestoreStockUpdates = [];
        const localStockRollbackData = [];

        const recipeOrBatchChanged = originalRecord.recipeId !== updatedRecord.recipeId ||
            Number(originalRecord.batchSize) !== Number(updatedRecord.batchSize);

        if (recipeOrBatchChanged) {
            const netIngredientStockChange = new Map();

            // 1a. Calcular stock a "devolver"
            if (originalRecord.recipeId && Number(originalRecord.batchSize) > 0) {
                const ogRecipe = recipes.value.find(r => r.id === originalRecord.recipeId);
                if (ogRecipe && Array.isArray(ogRecipe.ingredients)) {
                    ogRecipe.ingredients.forEach(ing => {
                        const quantityToReturn = (Number(ing.quantity) || 0) * Number(originalRecord.batchSize);
                        netIngredientStockChange.set(ing.ingredientId, (netIngredientStockChange.get(ing.ingredientId) || 0) + quantityToReturn);
                    });
                }
            }

            // 1b. Calcular stock a "consumir"
            if (updatedRecord.recipeId && updatedRecord.batchSize > 0) {
                const newRecipe = recipes.value.find(r => r.id === updatedRecord.recipeId);
                if (newRecipe && Array.isArray(newRecipe.ingredients)) {
                    newRecipe.ingredients.forEach(ing => {
                        const quantityToConsume = (Number(ing.quantity) || 0) * updatedRecord.batchSize;
                        netIngredientStockChange.set(ing.ingredientId, (netIngredientStockChange.get(ing.ingredientId) || 0) - quantityToConsume);
                    });
                }
            }

            // 1c. Aplicar cambios de stock optimistas
            netIngredientStockChange.forEach((changeAmount, ingredientId) => {
                if (changeAmount === 0) return;

                const globalIngIndex = globalIngredients.value.findIndex(g => g.id === ingredientId);
                if (globalIngIndex !== -1) {
                    const ingredient = globalIngredients.value[globalIngIndex];
                    localStockRollbackData.push({ globalIngIndex, originalStockValue: ingredient.currentStock });

                    const newStock = (Number(ingredient.currentStock) || 0) + changeAmount;
                    globalIngredients.value[globalIngIndex] = { ...ingredient, currentStock: newStock };

                    if (user.value) {
                        firestoreStockUpdates.push({
                            docRef: doc(db, `users/${user.value.uid}/ingredients`, ingredientId),
                            newStock: newStock
                        });
                    }

                    stockAdjustmentEvents.push({
                        eventType: 'STOCK_ADJUST_BY_PRODUCTION_EDIT',
                        entityType: 'Stock de Ingrediente',
                        entityId: ingredient.id,
                        entityName: ingredient.name,
                        relatedEntityId: updatedRecord.id,
                        relatedEntityName: updatedRecord.productName,
                        changes: [{
                            field: 'currentStock',
                            oldValue: ingredient.currentStock,
                            newValue: newStock,
                            label: `Stock ajustado por edición de Prod: ${updatedRecord.productName} (cambio: ${changeAmount > 0 ? '+' : ''}${changeAmount})`
                        }]
                    });
                }
            });
        }

        // 1d. Aplicar cambio de registro optimista
        productionRecords.value.splice(index, 1, { ...updatedRecord });


        if (user.value) {
            // --- INICIO REFACTOR 1.3 ---
            const batch = writeBatch(db);
            const recordDocRef = doc(db, `users/${user.value.uid}/production`, updatedRecord.id);
            const firestoreRecordData = { ...updatedRecord };
            delete firestoreRecordData.id;
            batch.set(recordDocRef, firestoreRecordData, { merge: true });

            // 2. "Disparar y Olvidar"
            const recordChanges = getChangeDetails(originalRecord, updatedRecord, ['id']);
            // Incluir cambios de stock en el batch
            firestoreStockUpdates.forEach(update => batch.update(update.docRef, { currentStock: update.newStock }));

            // Preparamos historial
            (async () => { // Usamos una IIFE asíncrona para manejar los awaits del historial
                try {
                    if (recordChanges.length > 0) {
                        await addEventHistoryEntry({
                            eventType: 'PRODUCTION_RECORD_EDITED',
                            entityType: 'Registro de Producción',
                            entityId: updatedRecord.id,
                            entityName: updatedRecord.productName,
                            changes: recordChanges
                        }, batch);
                    }
                    for (const event of stockAdjustmentEvents) {
                        await addEventHistoryEntry(event, batch);
                    }

                    // Ahora que todo el historial está en el batch, lo enviamos
                    batch.commit().then(() => {
                        console.log(`Sincronización (saveProductionRecord ${updatedRecord.id}) exitosa.`);
                    }).catch(e => {
                        console.error("Error al sincronizar 'saveProductionRecord' en Firestore:", e);
                        dataError.value = "Error al guardar registro de producción y ajustar stock.";
                        // 3. Rollback
                        productionRecords.value.splice(index, 1, originalRecord);
                        localStockRollbackData.forEach(item => {
                            globalIngredients.value[item.globalIngIndex].currentStock = item.originalStockValue;
                        });
                    });

                } catch (e) {
                    console.error("Error al preparar historial para 'saveProductionRecord':", e);
                    dataError.value = "Error al preparar historial de guardado.";
                    // 3. Rollback
                    productionRecords.value.splice(index, 1, originalRecord);
                    localStockRollbackData.forEach(item => {
                        globalIngredients.value[item.globalIngIndex].currentStock = item.originalStockValue;
                    });
                }
            })(); // Ejecutamos la IIFE

            // 4. Retornar éxito inmediatamente
            return true;
            // --- FIN REFACTOR 1.3 ---
        } else {
            // --- Lógica de LocalStorage (sin cambios) ---
            const recordChanges = getChangeDetails(originalRecord, updatedRecord, ['id']);
            if (recordChanges.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'PRODUCTION_RECORD_EDITED',
                    entityType: 'Registro de Producción',
                    entityId: updatedRecord.id,
                    entityName: updatedRecord.productName,
                    changes: recordChanges
                });
            }
            for (const event of stockAdjustmentEvents) {
                await addEventHistoryEntry(event); // Log stock changes to history
            }
            return true;
        }
    }

    // --- Bandera Anti-Concurrencia (Opcional pero recomendada) ---
    let isUserDataLoading = false;

    // --- Carga de Datos ---
    async function loadDataFromFirestore(userId) {
        if (isUserDataLoading && !userId) {
            console.log('useUserData: Ya en modo localStorage, no se recarga desde localStorage por loadDataFromFirestore(null).');
            dataLoading.value = false;
            return;
        }

        isUserDataLoading = true;
        dataLoading.value = true;
        dataError.value = null;

        if (userId) {
            try {
                const recipesColRef = collection(db, `users/${userId}/recipes`);
                const recipeSnapshot = await getDocs(recipesColRef);
                recipes.value = recipeSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, ingredients: Array.isArray(doc.data().ingredients) ? doc.data().ingredients : [] }));

                const ingredientsColRef = collection(db, `users/${userId}/ingredients`);
                const ingredientSnapshot = await getDocs(ingredientsColRef);
                globalIngredients.value = ingredientSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, currentStock: Number(doc.data().currentStock) || 0 }));

                const productionColRef = collection(db, `users/${userId}/production`);
                const productionSnapshot = await getDocs(productionColRef);
                productionRecords.value = productionSnapshot.docs.map(doc => ({
                    ...doc.data(),
                    id: doc.id,
                    batchSize: Number(doc.data().batchSize) || 0,
                    totalRevenue: Number(doc.data().totalRevenue) || 0,
                    operatingCostRecipeOnly: Number(doc.data().operatingCostRecipeOnly) || 0,
                    laborCostForBatch: Number(doc.data().laborCostForBatch) || 0,
                    netProfit: Number(doc.data().netProfit) || 0,
                    isSold: typeof doc.data().isSold === 'boolean' ? doc.data().isSold : false
                }));

            } catch (error) {
                // --- MODIFICACIÓN 1.2 ---
                if (error.code === 'unavailable') {
                    console.warn("useUserData: No se pudo conectar a Firestore (offline). Mostrando datos locales cacheados.");
                } else {
                    console.error("useUserData: Error cargando datos de Firestore:", error);
                    dataError.value = "Error al cargar datos del servidor.";
                }
                // --- FIN MODIFICACIÓN 1.2 ---
            } finally {
                isUserDataLoading = false;
                dataLoading.value = false;
            }
        } else {
            console.log('useUserData: No hay usuario, cargando datos desde localStorage via loadDataFromFirestore.');
            recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
            globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
            productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
                ...record,
                batchSize: Number(record.batchSize) || 0,
                totalRevenue: Number(record.totalRevenue) || 0,
                operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
                laborCostForBatch: Number(record.laborCostForBatch) || 0,
                netProfit: Number(record.netProfit) || 0,
                isSold: typeof record.isSold === 'boolean' ? record.isSold : false
            }));
            console.log('useUserData: Datos de localStorage cargados.');
            isUserDataLoading = false;
            dataLoading.value = false;
        }
    }


    // --- Observadores de Estado ---
    watch(authLoading, (newAuthLoadingValue, oldAuthLoadingValue) => {
        if (newAuthLoadingValue === false) {
            const currentUserId = user.value ? user.value.uid : null;
            if (currentUserId) {
                loadDataFromFirestore(currentUserId);
            } else {
                console.log('useUserData: Auth resuelto. Usuario desconectado. Cargando desde localStorage directamente en watch(authLoading).');
                if (!isUserDataLoading || dataLoading.value) {
                    dataLoading.value = true;
                    recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
                    globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
                    productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
                        ...record,
                        batchSize: Number(record.batchSize) || 0,
                        totalRevenue: Number(record.totalRevenue) || 0,
                        operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
                        laborCostForBatch: Number(record.laborCostForBatch) || 0,
                        netProfit: Number(record.netProfit) || 0,
                        isSold: typeof record.isSold === 'boolean' ? record.isSold : false
                    }));
                    dataLoading.value = false;
                    dataError.value = null;
                    isUserDataLoading = false;
                    console.log('useUserData: Datos locales cargados (auth resuelto, sin usuario). dataLoading = false.');
                }
            }
        } else if (newAuthLoadingValue === true) {
            if (!dataLoading.value) {
                console.log("useUserData: authLoading es true, estableciendo dataLoading.");
                dataLoading.value = true;
                dataError.value = null;
            }
        }
    }, { immediate: true });

    watch(user, (newUser, oldUser) => {
        const newUid = newUser ? newUser.uid : null;
        const oldUid = oldUser ? oldUser.uid : null;

        if (newUid !== oldUid && authLoading.value === false) {
            if (!newUser && oldUser) {
                // Usuario acaba de hacer logout
                console.log('useUserData: Logout detectado POST-AUTH. Cargando desde localStorage.');
                isUserDataLoading = false;
                dataLoading.value = true;
                recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
                globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
                productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
                    ...record,
                    batchSize: Number(record.batchSize) || 0,
                    totalRevenue: Number(record.totalRevenue) || 0,
                    operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
                    laborCostForBatch: Number(record.laborCostForBatch) || 0,
                    netProfit: Number(record.netProfit) || 0,
                    isSold: typeof record.isSold === 'boolean' ? record.isSold : false
                }));
                dataLoading.value = false;
                dataError.value = null;
                console.log('useUserData: Datos locales cargados post-logout. dataLoading = false.');
            } else if (newUser && !oldUser) {
                console.log('useUserData: Login detectado POST-AUTH. loadDataFromFirestore debería haber sido llamado por watch(authLoading).');
                if (!isUserDataLoading) { loadDataFromFirestore(newUid); }
            }
        }
    }, { deep: true });

    return {
        recipes,
        globalIngredients,
        productionRecords,
        dataLoading,
        dataError,

        addRecipe,
        deleteRecipe,
        saveRecipe,
        addIngredient,
        deleteIngredient,
        saveIngredient,
        addProductionRecord,
        deleteProductionRecord,
        saveProductionRecord,
    };
});