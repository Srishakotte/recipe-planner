/**
 * Turns free-text amounts into { quantity, unit } the grocery engine understands.
 *   "3 tbs" -> 3 tbsp, "1 1/2 cups" -> 1.5 cup, "1 x 400g tin" -> 400 g, "2 cloves minced" -> 2 clove,
 *   "½ tsp" -> 0.5 tsp, "Garnish" / "to taste" -> 1 pinch
 * and full lines from recipe websites: "2 cups all-purpose flour, sifted" -> 2 cup flour (note: sifted).
 * Pure functions: no I/O, fully unit tested.
 */

export interface ParsedAmount { quantity: number; unit: string }
export interface ParsedLine extends ParsedAmount { name: string; note?: string }

const UNICODE_FRACTIONS: Record<string, number> = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 };

const UNIT_ALIASES: Record<string, string> = {
  tbs: 'tbsp', tbsp: 'tbsp', tblsp: 'tbsp', tbls: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp', tbspn: 'tbsp',
  tsp: 'tsp', tsps: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  cup: 'cup', cups: 'cup',
  g: 'g', gr: 'g', gram: 'g', grams: 'g', kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', milliliter: 'ml', millilitres: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', liter: 'l', litres: 'l', liters: 'l',
  oz: 'oz', ounce: 'oz', ounces: 'oz', lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
  clove: 'clove', cloves: 'clove',
  can: 'can', cans: 'can', tin: 'can', tins: 'can',
  pinch: 'pinch', pinches: 'pinch', dash: 'pinch',
  bunch: 'bunch', bunches: 'bunch', handful: 'bunch', handfuls: 'bunch', sprig: 'bunch', sprigs: 'bunch',
  slice: 'slice', slices: 'slice',
  packet: 'packet', packets: 'packet', pack: 'packet', packs: 'packet', sachet: 'packet',
  piece: 'piece', pieces: 'piece', large: 'piece', medium: 'piece', small: 'piece', whole: 'piece',
  fillet: 'piece', fillets: 'piece', stick: 'piece', sticks: 'piece', head: 'piece', bulb: 'piece',
};

/** "1 1/2" | "1/2" | "1.5" | "½" | "1½" | "1-2" (takes the upper bound) at the start of a string */
function readNumber(text: string): { value: number; rest: string } | null {
  const s = text.trim().replace(/(\d)([¼½¾⅓⅔⅛])/g, '$1 $2');
  // order matters: "1/2" must not be read as "1" followed by "/2"
  const m = s.match(/^(\d+)\/(\d+)|^([¼½¾⅓⅔⅛])|^(\d+(?:[.,]\d+)?)(?:\s*[-–]\s*(\d+(?:[.,]\d+)?))?(?:\s+(\d+)\/(\d+))?/);
  if (!m) return null;
  let value: number;
  if (m[1]) value = Number(m[1]) / Number(m[2]);
  else if (m[3]) value = UNICODE_FRACTIONS[m[3]];
  else {
    value = Number((m[5] ?? m[4]).replace(',', '.'));
    if (m[6]) value += Number(m[6]) / Number(m[7]);
  }
  let rest = s.slice(m[0].length).trim();
  const trailing = rest.match(/^([¼½¾⅓⅔⅛])/);
  if (trailing) { value += UNICODE_FRACTIONS[trailing[1]]; rest = rest.slice(1).trim(); }
  return value > 0 && isFinite(value) ? { value, rest } : null;
}

/** "3 tbs" | "500g" | "1 x 300ml" | "2 cloves minced" | "Garnish" -> quantity + unit */
export function parseMeasure(measure: string | null | undefined): ParsedAmount {
  const text = (measure ?? '').toLowerCase().trim();
  if (!text) return { quantity: 1, unit: 'piece' };

  // "1 x 400g tin" / "2 x 200ml cans": the pack size is the useful amount
  const pack = text.match(/^(\d+(?:\.\d+)?)\s*x\s*(.+)$/);
  if (pack) {
    const inner = parseMeasure(pack[2]);
    return { quantity: inner.quantity * Number(pack[1]), unit: inner.unit };
  }

  const num = readNumber(text);
  if (!num) return { quantity: 1, unit: /taste|pinch|dash|garnish|sprinkl/.test(text) ? 'pinch' : 'piece' };

  const unitWord = num.rest.match(/^([a-z]+)\.?/)?.[1];
  const unit = unitWord && UNIT_ALIASES[unitWord] ? UNIT_ALIASES[unitWord] : 'piece';
  return { quantity: Math.round(num.value * 1000) / 1000, unit };
}

const NOTE_WORDS = /,|\(|\b(chopped|diced|sliced|minced|grated|peeled|finely|roughly|thinly|freshly|crushed|softened|melted|beaten|sifted|to taste|for serving|optional|divided)\b/;

/** "2 cups all-purpose flour, sifted" -> { 2, cup, "all-purpose flour", note: "sifted" } */
export function parseIngredientLine(line: string): ParsedLine {
  const text = line.replace(/\s+/g, ' ').trim();
  const num = readNumber(text);
  let quantity = 1, unit = 'piece', rest = text;
  if (num) {
    quantity = Math.round(num.value * 1000) / 1000;
    rest = num.rest;
    const pack = rest.match(/^x\s*(\d+(?:\.\d+)?)\s*([a-z]+)\b\s*(.*)$/i);
    if (pack && UNIT_ALIASES[pack[2].toLowerCase()]) {
      quantity *= Number(pack[1]); unit = UNIT_ALIASES[pack[2].toLowerCase()]; rest = pack[3];
    } else {
      const unitMatch = rest.match(/^([a-zA-Z]+)\.?\s+(.*)$/);
      if (unitMatch && UNIT_ALIASES[unitMatch[1].toLowerCase()] && !['large', 'medium', 'small', 'whole'].includes(unitMatch[1].toLowerCase())) {
        unit = UNIT_ALIASES[unitMatch[1].toLowerCase()]; rest = unitMatch[2];
      }
    }
  } else if (/to taste|pinch of|dash of/i.test(text)) {
    unit = 'pinch';
  }
  rest = rest.replace(/^(of|large|medium|small)\s+/i, '');
  const cut = rest.search(NOTE_WORDS);
  const name = (cut > 0 ? rest.slice(0, cut) : rest).replace(/[,(]\s*$/, '').trim().toLowerCase();
  const note = cut > 0 ? rest.slice(cut).replace(/^[,(\s]+|\)$/g, '').trim() || undefined : undefined;
  return { quantity, unit, name: name || text.toLowerCase(), note };
}

// ---------------------------------------------------------------- store aisle

const SECTION_KEYWORDS: [string, string[]][] = [
  ['meat', ['chicken', 'beef', 'pork', 'lamb', 'mutton', 'bacon', 'ham', 'sausage', 'mince', 'turkey', 'duck', 'veal', 'chorizo', 'fish', 'salmon', 'tuna', 'cod', 'haddock', 'prawn', 'shrimp', 'mussel', 'clam', 'squid', 'crab', 'lobster', 'anchov', 'sardine', 'mackerel', 'steak', 'goat']],
  ['dairy', ['milk', 'cheese', 'cheddar', 'parmesan', 'mozzarella', 'feta', 'ricotta', 'butter', 'cream', 'yogurt', 'yoghurt', 'egg', 'ghee', 'paneer', 'creme fraiche', 'buttermilk', 'mascarpone']],
  ['bakery', ['bread', 'baguette', 'bun', 'roll', 'tortilla', 'pitta', 'pita', 'naan', 'croissant', 'brioche', 'crouton', 'bagel', 'taco shell', 'wrap']],
  ['frozen', ['frozen', 'ice cream', 'puff pastry', 'filo']],
  ['produce', ['onion', 'garlic', 'tomato', 'potato', 'carrot', 'celery', 'pepper', 'chilli', 'chili', 'lettuce', 'spinach', 'kale', 'cabbage', 'broccoli', 'cauliflower', 'courgette', 'zucchini', 'aubergine', 'eggplant', 'mushroom', 'leek', 'shallot', 'scallion', 'spring onion', 'cucumber', 'avocado', 'lemon', 'lime', 'orange', 'apple', 'banana', 'berry', 'berries', 'mango', 'pear', 'peach', 'grape', 'ginger', 'parsley', 'coriander', 'cilantro', 'basil', 'mint', 'thyme', 'rosemary', 'dill', 'sage', 'chive', 'beetroot', 'squash', 'pumpkin', 'pea', 'bean sprout', 'corn', 'asparagus', 'okra', 'radish', 'fennel', 'rocket', 'arugula', 'sweet potato', 'turnip', 'parsnip', 'plum', 'cherry', 'pineapple', 'melon', 'fig']],
];

/** Best-guess store aisle for an ingredient name; dry goods default to the pantry aisle. */
export function guessStoreSection(name: string): string {
  const n = name.toLowerCase();
  if (/\b(stock|powder|sauce|paste|dried|ground|tinned|canned|oil|vinegar|flour|sugar|syrup|seeds?|spice)\b/.test(n)) return 'pantry';
  for (const [section, words] of SECTION_KEYWORDS) if (words.some(w => n.includes(w))) return section;
  return 'pantry';
}
