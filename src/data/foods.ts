export interface FoodItem {
  name: string;
  serving: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  tags: string[];
}

/**
 * A small starter database of common foods so meal logging works out of the
 * box. Values are per the stated serving and are approximate — the UI labels
 * them as estimates and users can type any custom entry.
 */
export const FOODS: FoodItem[] = [
  { name: 'Chicken breast, grilled', serving: '100 g', calories: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, tags: ['protein', 'meat'] },
  { name: 'Salmon fillet', serving: '100 g', calories: 208, protein_g: 20, carbs_g: 0, fat_g: 13, tags: ['protein', 'fish'] },
  { name: 'Tuna, canned in water', serving: '100 g', calories: 116, protein_g: 26, carbs_g: 0, fat_g: 1, tags: ['protein', 'fish'] },
  { name: 'Lean beef mince (5%)', serving: '100 g', calories: 137, protein_g: 21, carbs_g: 0, fat_g: 5, tags: ['protein', 'meat'] },
  { name: 'Whole egg', serving: '1 large', calories: 72, protein_g: 6.3, carbs_g: 0.4, fat_g: 4.8, tags: ['protein'] },
  { name: 'Egg white', serving: '1 large', calories: 17, protein_g: 3.6, carbs_g: 0.2, fat_g: 0.1, tags: ['protein'] },
  { name: 'Greek yoghurt, 0%', serving: '170 g', calories: 100, protein_g: 17, carbs_g: 6, fat_g: 0.7, tags: ['protein', 'dairy'] },
  { name: 'Cottage cheese', serving: '100 g', calories: 98, protein_g: 11, carbs_g: 3.4, fat_g: 4.3, tags: ['protein', 'dairy'] },
  { name: 'Whey protein powder', serving: '30 g scoop', calories: 120, protein_g: 24, carbs_g: 3, fat_g: 1.5, tags: ['protein', 'supplement'] },
  { name: 'Tofu, firm', serving: '100 g', calories: 144, protein_g: 17, carbs_g: 3, fat_g: 9, tags: ['protein', 'vegetarian'] },
  { name: 'Lentils, cooked', serving: '100 g', calories: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4, tags: ['protein', 'vegetarian', 'carb'] },
  { name: 'Chickpeas, cooked', serving: '100 g', calories: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6, tags: ['protein', 'vegetarian', 'carb'] },
  { name: 'White rice, cooked', serving: '100 g', calories: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3, tags: ['carb'] },
  { name: 'Brown rice, cooked', serving: '100 g', calories: 112, protein_g: 2.6, carbs_g: 24, fat_g: 0.9, tags: ['carb'] },
  { name: 'Pasta, cooked', serving: '100 g', calories: 158, protein_g: 5.8, carbs_g: 31, fat_g: 0.9, tags: ['carb'] },
  { name: 'Potato, baked', serving: '150 g', calories: 130, protein_g: 3.5, carbs_g: 30, fat_g: 0.2, tags: ['carb'] },
  { name: 'Sweet potato, baked', serving: '150 g', calories: 135, protein_g: 2.4, carbs_g: 31, fat_g: 0.2, tags: ['carb'] },
  { name: 'Oats, dry', serving: '50 g', calories: 190, protein_g: 6.7, carbs_g: 33, fat_g: 3.4, tags: ['carb', 'breakfast'] },
  { name: 'Wholegrain bread', serving: '1 slice', calories: 82, protein_g: 4, carbs_g: 14, fat_g: 1.1, tags: ['carb'] },
  { name: 'Banana', serving: '1 medium', calories: 105, protein_g: 1.3, carbs_g: 27, fat_g: 0.4, tags: ['fruit', 'carb'] },
  { name: 'Apple', serving: '1 medium', calories: 95, protein_g: 0.5, carbs_g: 25, fat_g: 0.3, tags: ['fruit'] },
  { name: 'Blueberries', serving: '100 g', calories: 57, protein_g: 0.7, carbs_g: 14, fat_g: 0.3, tags: ['fruit'] },
  { name: 'Broccoli, steamed', serving: '100 g', calories: 35, protein_g: 2.4, carbs_g: 7, fat_g: 0.4, tags: ['vegetable'] },
  { name: 'Spinach, raw', serving: '100 g', calories: 23, protein_g: 2.9, carbs_g: 3.6, fat_g: 0.4, tags: ['vegetable'] },
  { name: 'Mixed salad', serving: '150 g', calories: 30, protein_g: 1.8, carbs_g: 5, fat_g: 0.3, tags: ['vegetable'] },
  { name: 'Avocado', serving: '1/2 medium', calories: 160, protein_g: 2, carbs_g: 8.5, fat_g: 15, tags: ['fat', 'fruit'] },
  { name: 'Almonds', serving: '30 g', calories: 173, protein_g: 6.3, carbs_g: 6, fat_g: 15, tags: ['fat', 'snack'] },
  { name: 'Peanut butter', serving: '2 tbsp', calories: 188, protein_g: 8, carbs_g: 6, fat_g: 16, tags: ['fat', 'snack'] },
  { name: 'Olive oil', serving: '1 tbsp', calories: 119, protein_g: 0, carbs_g: 0, fat_g: 13.5, tags: ['fat'] },
  { name: 'Whole milk', serving: '250 ml', calories: 149, protein_g: 8, carbs_g: 12, fat_g: 8, tags: ['dairy'] },
  { name: 'Skimmed milk', serving: '250 ml', calories: 83, protein_g: 8.3, carbs_g: 12, fat_g: 0.2, tags: ['dairy'] },
  { name: 'Cheddar cheese', serving: '30 g', calories: 120, protein_g: 7, carbs_g: 0.4, fat_g: 10, tags: ['dairy', 'fat'] },
  { name: 'Protein bar', serving: '1 bar', calories: 210, protein_g: 20, carbs_g: 22, fat_g: 7, tags: ['snack', 'protein'] },
  { name: 'Dark chocolate (70%)', serving: '25 g', calories: 145, protein_g: 1.9, carbs_g: 11, fat_g: 10, tags: ['snack'] },
  { name: 'Coffee, black', serving: '250 ml', calories: 2, protein_g: 0.3, carbs_g: 0, fat_g: 0, tags: ['drink'] },
];
