// src/composables/useRecipeCosts.js
import { computed, toValue } from 'vue';

/**
 * Fórmula idéntica a la que usaba EditRecipeModal — useProductionRecords lee
 * calculatedRecipeOnlyCost / calculatedTotalBatchCostAllIncluded / calculatedFinalPrice
 * de lo ya persistido, así que la matemática de aquí no puede divergir de esos valores.
 * @param {object} recipe
 * @param {Array} globalIngredients
 */
export function computeRecipeCosts(recipe, globalIngredients) {
    const defaults = {
        ingredientCosts: {},
        totalIngredientCost: 0,
        recipeOnlyCost: 0,
        laborCostPerIndividualItem: 0,
        baseCostPerIndividualItem: 0,
        totalCostPerIndividualItem: 0,
        sellingPrice: 0,
        finalPrice: 0,
        missingIngredients: [],
        isComplete: false,
        breakdown: { ingredientsPct: 0, laborPct: 0, profitPct: 0 },
    };

    if (!recipe || !Array.isArray(globalIngredients)) {
        return defaults;
    }

    const recipeIngredients = Array.isArray(recipe.ingredients) ? recipe.ingredients : [];

    let totalIngredientCost = 0;
    const ingredientCosts = {};
    const missingIngredients = [];

    recipeIngredients.forEach((recipeIng) => {
        const globalIng = globalIngredients.find(g => g.id === recipeIng.ingredientId);

        if (!globalIng) {
            ingredientCosts[recipeIng.ingredientId] = 0;
            missingIngredients.push({
                id: recipeIng.ingredientId,
                name: `Ingrediente no encontrado (ID: ${recipeIng.ingredientId})`,
                reason: 'not-found',
            });
            return;
        }

        if (!(globalIng.presentationSize > 0)) {
            ingredientCosts[recipeIng.ingredientId] = 0;
            missingIngredients.push({
                id: recipeIng.ingredientId,
                name: globalIng.name,
                reason: 'invalid-presentation',
            });
            return;
        }

        const costPerBaseUnit = globalIng.cost / globalIng.presentationSize;
        const ingredientCostForRecipe = costPerBaseUnit * recipeIng.quantity;
        totalIngredientCost += ingredientCostForRecipe;
        ingredientCosts[recipeIng.ingredientId] = ingredientCostForRecipe;
    });

    const packagingCostPerBatch = Number(recipe.packagingCostPerBatch || 0);
    const laborCostPerBatch = Number(recipe.laborCostPerBatch || 0);
    const itemsPerBatch = Number(recipe.itemsPerBatch || 1);
    const profitMarginPercent = Number(recipe.profitMarginPercent || 0);
    const lossBufferPercent = Number(recipe.lossBufferPercent || 0);

    const recipeOnlyCost = totalIngredientCost + packagingCostPerBatch;
    const laborCostPerIndividualItem = itemsPerBatch > 0 ? laborCostPerBatch / itemsPerBatch : 0;
    const baseCostPerIndividualItem = itemsPerBatch > 0 ? recipeOnlyCost / itemsPerBatch : 0;
    const totalCostPerIndividualItem = baseCostPerIndividualItem + laborCostPerIndividualItem;
    const sellingPrice = totalCostPerIndividualItem * (1 + profitMarginPercent / 100);
    const finalPrice = sellingPrice * (1 + lossBufferPercent / 100);

    const isComplete = missingIngredients.length === 0 && recipeIngredients.length > 0 && itemsPerBatch > 0;

    const ingredientsPct = finalPrice > 0 ? baseCostPerIndividualItem / finalPrice : 0;
    const laborPct = finalPrice > 0 ? laborCostPerIndividualItem / finalPrice : 0;
    const profitPct = finalPrice > 0 ? Math.max(0, 1 - ingredientsPct - laborPct) : 0;

    return {
        ingredientCosts,
        totalIngredientCost,
        recipeOnlyCost,
        laborCostPerIndividualItem,
        baseCostPerIndividualItem,
        totalCostPerIndividualItem,
        sellingPrice,
        finalPrice,
        missingIngredients,
        isComplete,
        breakdown: { ingredientsPct, laborPct, profitPct },
    };
}

/**
 * Wrapper reactivo: recipe/globalIngredients pueden ser refs, computeds, getters o valores planos.
 */
export function useRecipeCosts(recipe, globalIngredients) {
    return computed(() => computeRecipeCosts(toValue(recipe), toValue(globalIngredients)));
}
