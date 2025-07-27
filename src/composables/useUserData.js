// src/composables/useUserData.js
import { ref, watch } from 'vue';
import { useAuth } from './useAuth';
import { db } from '../main';
import { collection, doc, getDocs, setDoc, deleteDoc, addDoc, writeBatch } from "firebase/firestore";
import { useLocalStorage } from './useLocalStorage';
import { useEventHistory } from './useEventHistory';

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
        ingredients: 'Ingredientes', // This will be less used if getIngredientChangeDetails handles it
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
        operatingCostRecipeOnly: 'Gastos Op. (Ingr. + Emp.)', // NUEVO
        laborCostForBatch: 'Costo Mano de Obra (Lote)',    // NUEVO
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
        const batch = writeBatch(db);
        try {
            const recipesColRef = collection(db, `users/${user.value.uid}/recipes`);
            const newRecipeDocRef = doc(recipesColRef); // Firestore generates ID

            batch.set(newRecipeDocRef, recipeDataForFirestore);

            await addEventHistoryEntry({
                eventType: 'RECIPE_CREATED',
                entityType: 'Receta',
                entityId: newRecipeDocRef.id, // Use Firestore's future ID
                entityName: tempRecipe.name,
                changes: Object.keys(recipeDataForFirestore).map(key => ({
                    field: key,
                    oldValue: null,
                    newValue: recipeDataForFirestore[key],
                    label: getFieldLabel(key)
                }))
            }, batch);

            await batch.commit();

            const firestoreId = newRecipeDocRef.id;
            const localIndex = recipes.value.findIndex(r => r.id === tempId);
            if (localIndex !== -1) {
                recipes.value.splice(localIndex, 1, { ...tempRecipe, id: firestoreId });
            } else { // If tempRecipe wasn't pushed optimistically with tempId
                recipes.value.push({ ...tempRecipe, id: firestoreId });
            }
            return true;
        } catch (e) {
            console.error("Error al añadir receta y/o historial a Firestore:", e);
            // Rollback optimistic local add if it happened with tempId
            recipes.value = recipes.value.filter(r => r.id !== tempId && r.id !== undefined); // ensure not to remove others
            dataError.value = "Error al añadir receta al servidor.";
            return false;
        }
    } else {
        // For localStorage, use tempId as final ID if not already set by UI
        const finalId = tempRecipe.id || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const recipeToAdd = { ...tempRecipe, id: finalId };
        // recipes.value.push(recipeToAdd); // useLocalStorage handles this via direct mutation or watch

        await addEventHistoryEntry({
            eventType: 'RECIPE_CREATED',
            entityType: 'Receta',
            entityId: recipeToAdd.id,
            entityName: recipeToAdd.name,
            changes: Object.keys(recipeDataForFirestore).map(key => ({ // recipeDataForFirestore has no ID
                field: key,
                oldValue: null,
                newValue: recipeDataForFirestore[key],
                label: getFieldLabel(key)
            }))
        });
        // Update local array if it wasn't already (useLocalStorage might not pick up direct push before history)
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
    const recipeToDelete = JSON.parse(JSON.stringify(recipes.value[recipeToDeleteIndex]));

    recipes.value.splice(recipeToDeleteIndex, 1); // Optimistic local delete

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const recipeDocRef = doc(db, `users/${user.value.uid}/recipes`, recipeId);
            batch.delete(recipeDocRef);

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
            }, batch);

            await batch.commit();
            return recipeToDelete.name;
        } catch (e) {
            console.error("useUserData: Error deleting recipe and/or history from Firestore: ", e);
            recipes.value.splice(recipeToDeleteIndex, 0, recipeToDelete); // Rollback
            dataError.value = "Error al eliminar receta del servidor.";
            return recipeToDelete.name; // Return name for error toast
        }
    } else {
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

    const originalRecipe = JSON.parse(JSON.stringify(recipes.value[index]));
    recipes.value.splice(index, 1, { ...updatedRecipe }); // Optimistic local update

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const recipeDocRef = doc(db, `users/${user.value.uid}/recipes`, updatedRecipe.id);
            const firestoreRecipeData = { ...updatedRecipe };
            delete firestoreRecipeData.id; // Firestore manages ID in doc path

            batch.set(recipeDocRef, firestoreRecipeData, { merge: true }); // Use merge to be safe, or set if replacing whole doc

            const changes = getChangeDetails(originalRecipe, updatedRecipe, ['id', 'calculatedTotalCost', 'calculatedFinalPrice']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'RECIPE_EDITED',
                    entityType: 'Receta',
                    entityId: updatedRecipe.id,
                    entityName: updatedRecipe.name,
                    changes: changes
                }, batch);
            }

            await batch.commit();
            return true;
        } catch (e) {
            console.error("useUserData: Error updating recipe and/or history in Firestore: ", e);
            recipes.value.splice(index, 1, originalRecipe); // Rollback
            dataError.value = "Error al guardar receta en el servidor.";
            return false;
        }
    } else {
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
        const batch = writeBatch(db);
        try {
            const ingredientsColRef = collection(db, `users/${user.value.uid}/ingredients`);
            const newIngredientDocRef = doc(ingredientsColRef); // Firestore generates ID

            batch.set(newIngredientDocRef, ingredientForFirestore);

            await addEventHistoryEntry({
                eventType: 'INGREDIENT_CREATED',
                entityType: 'Ingrediente',
                entityId: newIngredientDocRef.id,
                entityName: ingredientForFirestore.name,
                changes: Object.keys(ingredientForFirestore).map(key => ({
                    field: key,
                    oldValue: null,
                    newValue: ingredientForFirestore[key],
                    label: getFieldLabel(key)
                }))
            }, batch);

            await batch.commit();

            const firestoreId = newIngredientDocRef.id;
            // Update local state with Firestore ID and correct stock
            const localData = { ...ingredientDataWithInitialStock, id: firestoreId, currentStock: ingredientForFirestore.currentStock };
            delete localData.initialStock; // Remove initialStock if it was a specific creation field

            const localIndex = globalIngredients.value.findIndex(i => i.id === tempId);
            if (localIndex !== -1) {
                globalIngredients.value.splice(localIndex, 1, localData);
            } else {
                globalIngredients.value.push(localData);
            }
            return true;
        } catch (e) {
            console.error("Error al añadir ingrediente y/o historial a Firestore:", e);
            globalIngredients.value = globalIngredients.value.filter(i => i.id !== tempId && i.id !== undefined);
            dataError.value = "Error al añadir ingrediente al servidor.";
            return false;
        }
    } else {
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
    const ingredientToDelete = JSON.parse(JSON.stringify(globalIngredients.value[ingredientToDeleteIndex]));

    globalIngredients.value.splice(ingredientToDeleteIndex, 1); // Optimistic

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const ingredientDocRef = doc(db, `users/${user.value.uid}/ingredients`, ingredientId);
            batch.delete(ingredientDocRef);

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
            }, batch);

            await batch.commit();
            return ingredientToDelete.name;
        } catch (e) {
            console.error("Error al eliminar ingrediente y/o historial de Firestore: ", e);
            globalIngredients.value.splice(ingredientToDeleteIndex, 0, ingredientToDelete); // Rollback
            dataError.value = "Error al eliminar ingrediente del servidor.";
            return ingredientToDelete.name;
        }
    } else {
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
    const originalIngredient = JSON.parse(JSON.stringify(globalIngredients.value[index]));

    // Ensure numeric fields are correct type
    const processedIngredient = {
        ...updatedIngredient,
        cost: Number(updatedIngredient.cost),
        presentationSize: Number(updatedIngredient.presentationSize),
        currentStock: Number(updatedIngredient.currentStock) || 0
    };

    globalIngredients.value.splice(index, 1, { ...processedIngredient }); // Optimistic

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const ingredientDocRef = doc(db, `users/${user.value.uid}/ingredients`, processedIngredient.id);
            const firestoreIngredientData = { ...processedIngredient };
            delete firestoreIngredientData.id;
            batch.set(ingredientDocRef, firestoreIngredientData, { merge: true });

            const changes = getChangeDetails(originalIngredient, processedIngredient, ['id']);
            if (changes.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'INGREDIENT_EDITED',
                    entityType: 'Ingrediente',
                    entityId: processedIngredient.id,
                    entityName: processedIngredient.name,
                    changes: changes
                }, batch);
            }
            await batch.commit();
            return true;
        } catch (e) {
            console.error("Error al actualizar ingrediente y/o historial en Firestore: ", e);
            globalIngredients.value.splice(index, 1, originalIngredient); // Rollback
            dataError.value = "Error al guardar ingrediente en el servidor.";
            return false;
        }
    } else {
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
    };

    const stockUpdateDetails = [];
    const originalIngredientStatesForRollback = [];

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
                            quantityChanged: -quantityUsed, // Negative as it's a reduction
                            label: `Stock ajustado por Producción: ${recordToAdd.productName}`
                        });
                    }
                }
            }
        }
    }

    if (user.value) {
        const batch = writeBatch(db);
        try {
            const productionColRef = collection(db, `users/${user.value.uid}/production`);
            const newRecordDocRef = doc(productionColRef);

            const firestoreRecordData = {
                recipeId: recordToAdd.recipeId,
                productName: recordToAdd.productName,
                batchSize: recordToAdd.batchSize,
                date: recordToAdd.date,
                totalRevenue: recordToAdd.totalRevenue,
                operatingCostRecipeOnly: recordToAdd.operatingCostRecipeOnly, // Guardar este
                laborCostForBatch: recordToAdd.laborCostForBatch,         // Guardar este
                netProfit: recordToAdd.netProfit
            };
            batch.set(newRecordDocRef, firestoreRecordData);

            await addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_CREATED',
                entityType: 'Registro de Producción',
                entityId: newRecordDocRef.id,
                entityName: recordToAdd.productName,
                changes: Object.keys(recordToAdd).map(key => ({
                    field: key, oldValue: null, newValue: recordToAdd[key], label: getFieldLabel(key)
                }))
            }, batch);

            for (const stockUpdate of stockUpdateDetails) {
                const ingDocRef = doc(db, `users/${user.value.uid}/ingredients`, stockUpdate.ingredientId);
                batch.update(ingDocRef, { currentStock: stockUpdate.newStock });
                await addEventHistoryEntry({
                    eventType: 'STOCK_ADJUST_BY_PRODUCTION_ADD',
                    entityType: 'Stock de Ingrediente',
                    entityId: stockUpdate.ingredientId,
                    entityName: stockUpdate.ingredientName,
                    relatedEntityId: newRecordDocRef.id, // Link to production record
                    relatedEntityName: recordToAdd.productName,
                    changes: [{
                        field: 'currentStock',
                        oldValue: stockUpdate.oldStock,
                        newValue: stockUpdate.newStock,
                        label: stockUpdate.label
                    }]
                }, batch);
            }
            await batch.commit();

            const firestoreId = newRecordDocRef.id;
            const localRecord = { ...recordData, ...recordToAdd, id: firestoreId };
            const localIndex = productionRecords.value.findIndex(r => r.id === tempId);
            if (localIndex !== -1) {
                productionRecords.value.splice(localIndex, 1, localRecord);
            } else {
                productionRecords.value.push(localRecord);
            }
            return true;
        } catch (e) {
            console.error("Error añadiendo registro de producción, actualizando stock y/o historial a Firestore:", e);
            productionRecords.value = productionRecords.value.filter(r => r.id !== tempId && r.id !== undefined);
            originalIngredientStatesForRollback.forEach(item => { // Rollback stock
                globalIngredients.value[item.index].currentStock = item.oldStock;
            });
            dataError.value = "Error al guardar registro de producción.";
            return false;
        }
    } else {
        // localStorage
        const finalId = tempId || `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        // localStorage
        const firestoreRecordData = { // Reutiliza la estructura definida para firestore para consistencia
            recipeId: recordToAdd.recipeId,
            productName: recordToAdd.productName,
            batchSize: recordToAdd.batchSize,
            date: recordToAdd.date,
            totalRevenue: recordToAdd.totalRevenue,
            operatingCostRecipeOnly: recordToAdd.operatingCostRecipeOnly,
            laborCostForBatch: recordToAdd.laborCostForBatch,
            netProfit: recordToAdd.netProfit
        };
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
    const recordToDelete = JSON.parse(JSON.stringify(productionRecords.value[recordToDeleteIndex]));

    const stockRestoreDetails = []; // [{ ingredientId, ingredientName, oldStock (before restore), newStock (after restore) }]
    const originalIngredientStatesForRollback = []; // [{ index, oldStock (before restore) }]

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
        const batch = writeBatch(db);
        try {
            const recordDocRef = doc(db, `users/${user.value.uid}/production`, recordId);
            batch.delete(recordDocRef);

            await addEventHistoryEntry({
                eventType: 'PRODUCTION_RECORD_DELETED',
                entityType: 'Registro de Producción',
                entityId: recordToDelete.id,
                entityName: recordToDelete.productName,
                changes: Object.keys(recordToDelete).filter(k => k !== 'id').map(key => ({
                    field: key, oldValue: recordToDelete[key], newValue: null, label: getFieldLabel(key)
                }))
            }, batch);

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
            await batch.commit();
            return recordToDelete.productName;
        } catch (e) {
            console.error("Error al eliminar registro de producción, restaurar stock y/o historial en Firestore:", e);
            productionRecords.value.splice(recordToDeleteIndex, 0, recordToDelete); // Rollback record deletion
            originalIngredientStatesForRollback.forEach(item => { // Rollback stock restoration
                globalIngredients.value[item.index].currentStock = item.oldStock;
            });
            dataError.value = "Error al eliminar registro del servidor.";
            return null;
        }
    } else {
        // localStorage
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
    const originalRecord = JSON.parse(JSON.stringify(productionRecords.value[index]));

    // Ensure numeric types for updated record
    const updatedRecord = {
        ...updatedRecordData,
        batchSize: Number(updatedRecordData.batchSize) || 0,
        totalRevenue: Number(updatedRecordData.totalRevenue) || 0,
        operatingCostRecipeOnly: Number(updatedRecordData.operatingCostRecipeOnly) || 0, // USAR ESTE
        laborCostForBatch: Number(updatedRecordData.laborCostForBatch) || 0,         // USAR ESTE
        netProfit: Number(updatedRecordData.netProfit) || 0,
    };
    // Y asegurar que si recipeOrBatchChanged, estos costos se recalculan correctamente si es necesario.
    // Por ahora, si EditProductionModal no los modifica, tomará los valores que ya tenga el updatedRecordData.


    // --- Stock Adjustment Logic for Edit ---
    const stockAdjustmentEvents = []; // For history
    const firestoreStockUpdates = []; // { docRef, newStock }
    const localStockRollbackData = []; // { globalIngIndex, originalStockValue }

    const recipeOrBatchChanged = originalRecord.recipeId !== updatedRecord.recipeId ||
        Number(originalRecord.batchSize) !== Number(updatedRecord.batchSize);

    if (recipeOrBatchChanged) {
        const netIngredientStockChange = new Map(); // ingredientId -> net change amount (positive to add back, negative to consume more)

        // 1. Calculate stock to "return" from original record
        if (originalRecord.recipeId && Number(originalRecord.batchSize) > 0) {
            const ogRecipe = recipes.value.find(r => r.id === originalRecord.recipeId);
            if (ogRecipe && Array.isArray(ogRecipe.ingredients)) {
                ogRecipe.ingredients.forEach(ing => {
                    const quantityToReturn = (Number(ing.quantity) || 0) * Number(originalRecord.batchSize);
                    netIngredientStockChange.set(ing.ingredientId, (netIngredientStockChange.get(ing.ingredientId) || 0) + quantityToReturn);
                });
            }
        }

        // 2. Calculate stock to "consume" for new record
        if (updatedRecord.recipeId && updatedRecord.batchSize > 0) {
            const newRecipe = recipes.value.find(r => r.id === updatedRecord.recipeId);
            if (newRecipe && Array.isArray(newRecipe.ingredients)) {
                newRecipe.ingredients.forEach(ing => {
                    const quantityToConsume = (Number(ing.quantity) || 0) * updatedRecord.batchSize;
                    netIngredientStockChange.set(ing.ingredientId, (netIngredientStockChange.get(ing.ingredientId) || 0) - quantityToConsume);
                });
            }
        }

        // 3. Apply net changes and prepare updates
        netIngredientStockChange.forEach((changeAmount, ingredientId) => {
            if (changeAmount === 0) return; // No net change for this ingredient

            const globalIngIndex = globalIngredients.value.findIndex(g => g.id === ingredientId);
            if (globalIngIndex !== -1) {
                const ingredient = globalIngredients.value[globalIngIndex];
                localStockRollbackData.push({ globalIngIndex, originalStockValue: ingredient.currentStock }); // Save pre-change stock for rollback

                const newStock = (Number(ingredient.currentStock) || 0) + changeAmount;

                // Optimistic local update (will be part of splice below if not Firestore)
                // For Firestore, it will be part of batch, local update done after successful commit or before if confident
                // Let's prepare for batch and update locally optimistically before commit

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
                        oldValue: ingredient.currentStock, // Stock before this adjustment
                        newValue: newStock,
                        label: `Stock ajustado por edición de Prod: ${updatedRecord.productName} (cambio: ${changeAmount > 0 ? '+' : ''}${changeAmount})`
                    }]
                });
            }
        });
    }
    // --- End Stock Adjustment Logic ---

    // Optimistic update for the production record itself
    productionRecords.value.splice(index, 1, { ...updatedRecord });


    if (user.value) {
        const batch = writeBatch(db);
        try {
            const recordDocRef = doc(db, `users/${user.value.uid}/production`, updatedRecord.id);
            const firestoreRecordData = { ...updatedRecord };
            delete firestoreRecordData.id;
            batch.set(recordDocRef, firestoreRecordData, { merge: true });

            const recordChanges = getChangeDetails(originalRecord, updatedRecord, ['id']);
            if (recordChanges.length > 0) {
                await addEventHistoryEntry({
                    eventType: 'PRODUCTION_RECORD_EDITED',
                    entityType: 'Registro de Producción',
                    entityId: updatedRecord.id,
                    entityName: updatedRecord.productName,
                    changes: recordChanges
                }, batch);
            }

            // Add stock updates and their history to batch
            firestoreStockUpdates.forEach(update => batch.update(update.docRef, { currentStock: update.newStock }));
            for (const event of stockAdjustmentEvents) {
                await addEventHistoryEntry(event, batch);
            }

            await batch.commit();
            return true;
        } catch (e) {
            console.error("Error actualizando registro de producción, stock y/o historial en Firestore:", e);
            productionRecords.value.splice(index, 1, originalRecord); // Rollback production record
            localStockRollbackData.forEach(item => { // Rollback local stock changes
                globalIngredients.value[item.globalIngIndex].currentStock = item.originalStockValue;
            });
            dataError.value = "Error al guardar registro de producción y ajustar stock.";
            return false;
        }
    } else {
        // localStorage - stock already updated optimistically if recipeOrBatchChanged
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
    if (isUserDataLoading && !userId) { // Prevenir recarga innecesaria si ya está en modo localStorage
        console.log('useUserData: Ya en modo localStorage, no se recarga desde localStorage por loadDataFromFirestore(null).');
        dataLoading.value = false;
        return;
    }

    isUserDataLoading = true;
    dataLoading.value = true;
    dataError.value = null;

    if (userId) { // Cuando hay un usuario conectado
        // console.log(`useUserData: Iniciando carga desde Firestore para el usuario: ${userId}...`);
        try {
            // Tu lógica actual para cargar desde Firestore...
            // Ejemplo para recetas:
            const recipesColRef = collection(db, `users/${userId}/recipes`);
            const recipeSnapshot = await getDocs(recipesColRef);
            recipes.value = recipeSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, ingredients: Array.isArray(doc.data().ingredients) ? doc.data().ingredients : [] }));

            // ... cargar ingredientes y registros de producción de la misma manera
            const ingredientsColRef = collection(db, `users/${userId}/ingredients`);
            const ingredientSnapshot = await getDocs(ingredientsColRef);
            globalIngredients.value = ingredientSnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id, currentStock: Number(doc.data().currentStock) || 0 }));

            const productionColRef = collection(db, `users/${userId}/production`);
            const productionSnapshot = await getDocs(productionColRef);
            productionRecords.value = productionSnapshot.docs.map(doc => ({
                ...doc.data(),
                id: doc.id,
                batchSize: Number(doc.data().batchSize) || 0, // Asegurar todos los números
                totalRevenue: Number(doc.data().totalRevenue) || 0,
                operatingCostRecipeOnly: Number(doc.data().operatingCostRecipeOnly) || 0,
                laborCostForBatch: Number(doc.data().laborCostForBatch) || 0,
                netProfit: Number(doc.data().netProfit) || 0
            }));

            // console.log(`useUserData: Datos de Firestore cargados.`);
        } catch (error) {
            console.error("useUserData: Error cargando datos de Firestore:", error);
            dataError.value = "Error al cargar datos del servidor.";
            // Considera vaciar los arrays si falla la carga de Firestore
            // recipes.value = [];
            // globalIngredients.value = [];
            // productionRecords.value = [];
        } finally {
            isUserDataLoading = false;
            dataLoading.value = false;
        }
    } else { // Cuando NO hay usuario (sesión cerrada)
        console.log('useUserData: No hay usuario, cargando datos desde localStorage via loadDataFromFirestore.');
        recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
        globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
        productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
            ...record,
            batchSize: Number(record.batchSize) || 0, // Asegurar todos los números
            totalRevenue: Number(record.totalRevenue) || 0,
            operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
            laborCostForBatch: Number(record.laborCostForBatch) || 0,
            netProfit: Number(record.netProfit) || 0
        }));
        console.log('useUserData: Datos de localStorage cargados.');
        isUserDataLoading = false; // Indicar que ya no está cargando específicamente para Firestore
        dataLoading.value = false;
    }
}


// --- Observadores de Estado ---

// ÚNICO Watcher responsable de la carga inicial y cambios posteriores
watch(authLoading, (newAuthLoadingValue, oldAuthLoadingValue) => {
    // console.log(`useUserData: authLoading cambió. Nuevo: ${newAuthLoadingValue}, Viejo: ${oldAuthLoadingValue}`);
    if (newAuthLoadingValue === false) { // Auth resuelto
        const currentUserId = user.value ? user.value.uid : null;
        if (currentUserId) {
            // console.log(`useUserData: Auth resuelto. Usuario: <span class="math-inline">\{currentUserId\}\. Llamando a loadDataFromFirestore\(</span>{currentUserId}).`);
            loadDataFromFirestore(currentUserId);
        } else {
            // Usuario está desconectado y la autenticación ha finalizado.
            console.log('useUserData: Auth resuelto. Usuario desconectado. Cargando desde localStorage directamente en watch(authLoading).');
            if (!isUserDataLoading || dataLoading.value) { // Evitar si ya se está en proceso de carga local por otra vía
                dataLoading.value = true; // Mostrar carga mientras se lee localStorage
                recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
                globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
                productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
                    ...record,
                    batchSize: Number(record.batchSize) || 0, // Asegurar todos los números
                    totalRevenue: Number(record.totalRevenue) || 0,
                    operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
                    laborCostForBatch: Number(record.laborCostForBatch) || 0,
                    netProfit: Number(record.netProfit) || 0
                }));
                dataLoading.value = false;
                dataError.value = null;
                isUserDataLoading = false; // Asegurarse que no está en estado de "cargando de Firestore"
                console.log('useUserData: Datos locales cargados (auth resuelto, sin usuario). dataLoading = false.');
            }
        }
    } else if (newAuthLoadingValue === true) { // Auth está cargando
        if (!dataLoading.value) {
            console.log("useUserData: authLoading es true, estableciendo dataLoading.");
            dataLoading.value = true;
            dataError.value = null;
        }
    }
}, { immediate: true });
// Watcher SECUNDARIO para manejar el logout y cargar de localStorage
watch(user, (newUser, oldUser) => {
    const newUid = newUser ? newUser.uid : null;
    const oldUid = oldUser ? oldUser.uid : null;

    // Solo actuar si hubo un cambio REAL (de usuario a null o viceversa)
    // Y si la carga inicial de auth YA TERMINÓ
    if (newUid !== oldUid && authLoading.value === false) {
        if (!newUser && oldUser) {
            // Usuario acaba de hacer logout
            console.log('useUserData: Logout detectado POST-AUTH. Cargando desde localStorage.');
            isUserDataLoading = false; // Resetear la guarda si estaba activa por alguna razón
            dataLoading.value = true; // Mostrar carga mientras se lee localStorage (rápido pero por si acaso)
            recipes.value = JSON.parse(localStorage.getItem('recipes') || '[]');
            globalIngredients.value = JSON.parse(localStorage.getItem('globalIngredients') || '[]');
            productionRecords.value = JSON.parse(localStorage.getItem('productionRecords') || '[]').map(record => ({
                ...record,
                batchSize: Number(record.batchSize) || 0, // Asegurar todos los números
                totalRevenue: Number(record.totalRevenue) || 0,
                operatingCostRecipeOnly: Number(record.operatingCostRecipeOnly) || 0,
                laborCostForBatch: Number(record.laborCostForBatch) || 0,
                netProfit: Number(record.netProfit) || 0
            }));
            dataLoading.value = false;
            dataError.value = null;
            console.log('useUserData: Datos locales cargados post-logout. dataLoading = false.');
        } else if (newUser && !oldUser) {
            // Usuario acaba de hacer login (ya manejado por el watch de authLoading, pero puede servir de fallback)
            console.log('useUserData: Login detectado POST-AUTH. loadDataFromFirestore debería haber sido llamado por watch(authLoading).');
            // Opcionalmente, podrías forzar una carga aquí si sospechas que puede fallar:
            if (!isUserDataLoading) { loadDataFromFirestore(newUid); }
        }
        // No necesitamos manejar el caso de user A -> user B aquí porque
        // el watch(authLoading) ya disparó la carga con el user B.
    }
}, { deep: true }); // No necesita immediate: true

// --- Export Composable ---
export function useUserData() {
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
}