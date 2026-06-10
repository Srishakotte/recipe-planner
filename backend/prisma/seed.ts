import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Clear existing data first (handles re-seeding without unique constraint errors)
  await prisma.groceryItem.deleteMany();
  await prisma.groceryGeneration.deleteMany();
  await prisma.mealPlanEntry.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.pantryItem.deleteMany();
  await prisma.substitution.deleteMany();
  await prisma.userConstraint.deleteMany();
  await prisma.ingredientSynonym.deleteMany();
  await prisma.unitConversion.deleteMany();
  await prisma.ingredientDensity.deleteMany();
  console.log('Cleared existing data...');

  await prisma.unitConversion.createMany({
    data: [
      { fromUnit: 'tsp', toUnit: 'ml', multiplier: 5, conversionType: 'volume' },
      { fromUnit: 'tbsp', toUnit: 'ml', multiplier: 15, conversionType: 'volume' },
      { fromUnit: 'cup', toUnit: 'ml', multiplier: 240, conversionType: 'volume' },
      { fromUnit: 'fl oz', toUnit: 'ml', multiplier: 29.574, conversionType: 'volume' },
      { fromUnit: 'l', toUnit: 'ml', multiplier: 1000, conversionType: 'volume' },
      { fromUnit: 'tbsp', toUnit: 'tsp', multiplier: 3, conversionType: 'volume' },
      { fromUnit: 'cup', toUnit: 'tbsp', multiplier: 16, conversionType: 'volume' },
      { fromUnit: 'kg', toUnit: 'g', multiplier: 1000, conversionType: 'mass' },
      { fromUnit: 'oz', toUnit: 'g', multiplier: 28.35, conversionType: 'mass' },
      { fromUnit: 'lb', toUnit: 'g', multiplier: 453.592, conversionType: 'mass' },
      { fromUnit: 'lb', toUnit: 'oz', multiplier: 16, conversionType: 'mass' },
    ],
  });

  await prisma.ingredientDensity.createMany({
    data: [
      { ingredientName: 'flour', gramsPerMl: 0.593 },
      { ingredientName: 'sugar', gramsPerMl: 0.845 },
      { ingredientName: 'butter', gramsPerMl: 0.911 },
      { ingredientName: 'milk', gramsPerMl: 1.03 },
      { ingredientName: 'olive oil', gramsPerMl: 0.918 },
      { ingredientName: 'vegetable oil', gramsPerMl: 0.92 },
      { ingredientName: 'honey', gramsPerMl: 1.42 },
      { ingredientName: 'cream', gramsPerMl: 1.012 },
      { ingredientName: 'rice', gramsPerMl: 0.85 },
      { ingredientName: 'salt', gramsPerMl: 1.217 },
      { ingredientName: 'water', gramsPerMl: 1.0 },
    ],
  });

  await prisma.ingredientSynonym.createMany({
    data: [
      { synonym: 'scallion', canonicalName: 'green onion' },
      { synonym: 'spring onion', canonicalName: 'green onion' },
      { synonym: 'coriander', canonicalName: 'cilantro' },
      { synonym: 'capsicum', canonicalName: 'bell pepper' },
      { synonym: 'aubergine', canonicalName: 'eggplant' },
      { synonym: 'courgette', canonicalName: 'zucchini' },
      { synonym: 'heavy cream', canonicalName: 'cream' },
      { synonym: 'whipping cream', canonicalName: 'cream' },
      { synonym: 'all-purpose flour', canonicalName: 'flour' },
      { synonym: 'plain flour', canonicalName: 'flour' },
      { synonym: 'lady finger', canonicalName: 'okra' },
      { synonym: 'ladyfinger', canonicalName: 'okra' },
      { synonym: 'lady-finger', canonicalName: 'okra' },
      { synonym: 'bhindi', canonicalName: 'okra' },
      { synonym: 'curd', canonicalName: 'yogurt' },
      { synonym: 'dahi', canonicalName: 'yogurt' },
      { synonym: 'badam milk', canonicalName: 'almond milk' },
    ],
  });

  await prisma.substitution.createMany({
    data: [
      { originalIngredient: 'milk', substituteIngredient: 'oat milk', quantityRatio: 1.0, constraintType: 'dietary', constraintValue: 'dairy-free' },
      { originalIngredient: 'milk', substituteIngredient: 'almond milk', quantityRatio: 1.0, constraintType: 'dietary', constraintValue: 'dairy-free' },
      { originalIngredient: 'butter', substituteIngredient: 'coconut oil', quantityRatio: 1.0, constraintType: 'dietary', constraintValue: 'dairy-free' },
      { originalIngredient: 'cream', substituteIngredient: 'coconut cream', quantityRatio: 1.0, constraintType: 'dietary', constraintValue: 'dairy-free' },
      { originalIngredient: 'chicken', substituteIngredient: 'tofu', quantityRatio: 1.0, constraintType: 'dietary', constraintValue: 'vegetarian' },
      { originalIngredient: 'peanut butter', substituteIngredient: 'sunflower seed butter', quantityRatio: 1.0, constraintType: 'allergen', constraintValue: 'no-peanuts' },
    ],
  });

  const spaghetti = await prisma.recipe.create({
    data: { name: 'Spaghetti Bolognese', defaultServings: 4, description: 'Classic pasta with meat sauce',
      ingredients: { create: [
        { name: 'spaghetti', quantity: 400, unit: 'g', storeSection: 'pantry', sortOrder: 0 },
        { name: 'ground beef', quantity: 500, unit: 'g', storeSection: 'meat', sortOrder: 1 },
        { name: 'onion', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 2 },
        { name: 'garlic', quantity: 4, unit: 'clove', storeSection: 'produce', sortOrder: 3 },
        { name: 'canned tomatoes', quantity: 2, unit: 'can', storeSection: 'pantry', sortOrder: 4 },
        { name: 'olive oil', quantity: 2, unit: 'tbsp', storeSection: 'pantry', sortOrder: 5 },
        { name: 'salt', quantity: 1, unit: 'tsp', storeSection: 'pantry', sortOrder: 6 },
        { name: 'parmesan', quantity: 50, unit: 'g', storeSection: 'dairy', sortOrder: 7 },
      ] } },
  });

  const stirFry = await prisma.recipe.create({
    data: { name: 'Chicken Stir Fry', defaultServings: 2, description: 'Quick weeknight stir fry',
      ingredients: { create: [
        { name: 'chicken breast', quantity: 300, unit: 'g', storeSection: 'meat', sortOrder: 0 },
        { name: 'bell pepper', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 1 },
        { name: 'broccoli', quantity: 200, unit: 'g', storeSection: 'produce', sortOrder: 2 },
        { name: 'soy sauce', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
        { name: 'garlic', quantity: 3, unit: 'clove', storeSection: 'produce', sortOrder: 4 },
        { name: 'rice', quantity: 200, unit: 'g', storeSection: 'pantry', sortOrder: 5 },
        { name: 'green onion', quantity: 3, unit: 'piece', storeSection: 'produce', sortOrder: 6 },
      ] } },
  });

  const pancakes = await prisma.recipe.create({
    data: { name: 'Fluffy Pancakes', defaultServings: 4, description: 'Classic breakfast pancakes',
      ingredients: { create: [
        { name: 'flour', quantity: 2, unit: 'cup', storeSection: 'pantry', sortOrder: 0 },
        { name: 'milk', quantity: 1.5, unit: 'cup', storeSection: 'dairy', sortOrder: 1 },
        { name: 'egg', quantity: 2, unit: 'piece', storeSection: 'dairy', sortOrder: 2 },
        { name: 'sugar', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
        { name: 'butter', quantity: 3, unit: 'tbsp', storeSection: 'dairy', sortOrder: 4 },
        { name: 'baking powder', quantity: 2, unit: 'tsp', storeSection: 'pantry', sortOrder: 5 },
      ] } },
  });

  const caesarSalad = await prisma.recipe.create({
    data: { name: 'Caesar Salad', defaultServings: 2, description: 'Fresh romaine with caesar dressing',
      ingredients: { create: [
        { name: 'romaine lettuce', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 0 },
        { name: 'parmesan', quantity: 30, unit: 'g', storeSection: 'dairy', sortOrder: 1 },
        { name: 'croutons', quantity: 1, unit: 'cup', storeSection: 'bakery', sortOrder: 2 },
        { name: 'olive oil', quantity: 3, unit: 'tbsp', storeSection: 'pantry', sortOrder: 3 },
        { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce', sortOrder: 4 },
        { name: 'lemon juice', quantity: 2, unit: 'tbsp', storeSection: 'produce', sortOrder: 5 },
      ] } },
  });

  const tomatoSoup = await prisma.recipe.create({
    data: { name: 'Creamy Tomato Soup', defaultServings: 4, description: 'Rich and creamy tomato soup',
      ingredients: { create: [
        { name: 'canned tomatoes', quantity: 3, unit: 'can', storeSection: 'pantry', sortOrder: 0 },
        { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 1 },
        { name: 'garlic', quantity: 3, unit: 'clove', storeSection: 'produce', sortOrder: 2 },
        { name: 'cream', quantity: 1, unit: 'cup', storeSection: 'dairy', sortOrder: 3 },
        { name: 'butter', quantity: 2, unit: 'tbsp', storeSection: 'dairy', sortOrder: 4 },
        { name: 'salt', quantity: 1, unit: 'tsp', storeSection: 'pantry', sortOrder: 5 },
      ] } },
  });

  const tacos = await prisma.recipe.create({
    data: { name: 'Beef Tacos', defaultServings: 4, description: 'Simple beef tacos',
      ingredients: { create: [
        { name: 'ground beef', quantity: 500, unit: 'g', storeSection: 'meat', sortOrder: 0 },
        { name: 'taco shells', quantity: 8, unit: 'piece', storeSection: 'pantry', sortOrder: 1 },
        { name: 'onion', quantity: 1, unit: 'piece', storeSection: 'produce', sortOrder: 2 },
        { name: 'tomato', quantity: 2, unit: 'piece', storeSection: 'produce', sortOrder: 3 },
        { name: 'cheddar cheese', quantity: 100, unit: 'g', storeSection: 'dairy', sortOrder: 4 },
        { name: 'sour cream', quantity: 0.5, unit: 'cup', storeSection: 'dairy', sortOrder: 5 },
        { name: 'garlic', quantity: 2, unit: 'clove', storeSection: 'produce', sortOrder: 6 },
      ] } },
  });

  await prisma.pantryItem.createMany({
    data: [
      { name: 'olive oil', quantity: 500, unit: 'ml' },
      { name: 'salt', quantity: 500, unit: 'g' },
      { name: 'sugar', quantity: 1, unit: 'kg' },
      { name: 'flour', quantity: 2, unit: 'kg' },
      { name: 'rice', quantity: 1, unit: 'kg' },
      { name: 'soy sauce', quantity: 250, unit: 'ml' },
      { name: 'onion', quantity: 3, unit: 'piece', expirationDate: new Date(Date.now() + 2 * 86400000) },
      { name: 'garlic', quantity: 8, unit: 'clove', expirationDate: new Date(Date.now() + 5 * 86400000) },
      { name: 'milk', quantity: 1, unit: 'l', expirationDate: new Date(Date.now() + 1 * 86400000) },
      { name: 'eggs', quantity: 6, unit: 'piece', expirationDate: new Date(Date.now() + 7 * 86400000) },
    ],
  });

  const today = new Date();
  // Get Monday of current week (handles Sunday edge case)
  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  monday.setDate(today.getDate() + diff);
  monday.setHours(12, 0, 0, 0); // noon to avoid timezone issues

  await prisma.mealPlanEntry.createMany({
    data: [
      { recipeId: stirFry.id, planDate: monday, mealSlot: 'dinner', servings: 2 },
      { recipeId: pancakes.id, planDate: new Date(monday.getTime() + 86400000), mealSlot: 'breakfast', servings: 4 },
      { recipeId: caesarSalad.id, planDate: new Date(monday.getTime() + 86400000), mealSlot: 'lunch', servings: 2 },
      { recipeId: spaghetti.id, planDate: new Date(monday.getTime() + 86400000 * 2), mealSlot: 'dinner', servings: 4 },
      { recipeId: tomatoSoup.id, planDate: new Date(monday.getTime() + 86400000 * 3), mealSlot: 'lunch', servings: 4 },
      { recipeId: tacos.id, planDate: new Date(monday.getTime() + 86400000 * 4), mealSlot: 'dinner', servings: 4 },
    ],
  });

  console.log('Seed complete! Created 6 recipes, 8 pantry items, 6 meal plan entries');
}

main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
