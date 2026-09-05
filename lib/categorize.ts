import type { Category } from "./types";

const RULES: Array<{ category: Category; pattern: RegExp }> = [
  {
    category: "Meat",
    pattern:
      /\b(beef|mince|minced|brisket|chicken|thigh|breast|bacon|pork|lamb|steak|sausage|turkey|duck|ham|prosciutto|pancetta|chorizo|meatball|veal)\b/i,
  },
  {
    category: "Produce",
    pattern:
      /\b(potato|potatoes|broccolini|broccoli|lettuce|cos|tomato|tomatoes|avocado|onion|shallot|carrot|lemon|lime|blueberry|strawberry|banana|mandarin|orange|apple|pear|spinach|kale|cucumber|capsicum|pepper|zucchini|courgette|eggplant|aubergine|mushroom|garlic|herb|parsley|basil|coriander|cilantro|rocket|arugula|salad|celery|cabbage|ginger|chilli|chili|berry|berries|grape|mango|pineapple)\b/i,
  },
  {
    category: "Fridge",
    pattern:
      /\b(milk|egg|eggs|cream|yoghurt|yogurt|butter|cheese|parmesan|cheddar|tasty|mozzarella|ricotta|feta|halloumi|sour cream|cream cheese|juice)\b/i,
  },
  {
    category: "Bread",
    pattern: /\b(bread|loaf|wonder white|baguette|sourdough|bun|roll|crouton)\b/i,
  },
  {
    category: "Pantry",
    pattern:
      /\b(pasta|fettuccine|penne|spaghetti|linguine|sauce|dolmio|bean|beans|dressing|oil|rice|flour|stock|pesto|paste|wine|tortilla|oat|oats|vinegar|soy|ketchup|puree|purée|worcestershire|oregano|spice|salt|peppercorn|sugar|honey|tin|canned|passata|noodle)\b/i,
  },
];

export function categorizeIngredient(name: string): Category {
  for (const rule of RULES) {
    if (rule.pattern.test(name)) return rule.category;
  }
  return "Other";
}
