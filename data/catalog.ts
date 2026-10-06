import type { Category, LifestyleCategory, Product } from "@/types/storefront";

export const products: Product[] = [
  { name: "Aso-Oke Heritage Stripe", category: "Aso-Oke", price: 18500, color: "#183b8f", texture: "woven", badge: "Bestseller" },
  { name: "Saffron Royal Velvet", category: "Velvet", price: 14800, color: "#d69a20", texture: "velvet", badge: "New" },
  { name: "Ivory Cloud Linen", category: "Linen", price: 9200, color: "#e8ddc7", texture: "linen" },
  { name: "Adire Indigo Current", category: "Adire", price: 12750, color: "#163868", texture: "adire", badge: "Hand-dyed" },
  { name: "Coral Duchess Satin", category: "Satin", price: 10800, color: "#d96d55", texture: "satin" },
  { name: "Emerald Ankara Mosaic", category: "Ankara", price: 7900, color: "#0f6c50", texture: "ankara" },
  { name: "Midnight Italian Crepe", category: "Crepe", price: 11600, color: "#1b1d2a", texture: "crepe" },
  { name: "Champagne Bridal Lace", category: "Lace", price: 24500, color: "#c9a96e", texture: "lace", badge: "Limited" },
];

export const storyCategories: Category[] = [
  { name: "Seven Star", note: "Distinguished suiting" },
  { name: "German Wool", note: "Refined weight & finish" },
  { name: "Checkers", note: "Classic checked designs" },
  { name: "Cashmere", note: "Exceptionally soft handle" },
  { name: "Irish", note: "Crisp premium tradition" },
  { name: "Stripes", note: "Sharp directional style" },
  { name: "Scabal", note: "Luxury tailoring cloth" },
  { name: "Plain & Pattern", note: "Versatile coordinated looks" },
];

export const heritageCategories: Category[] = [
  { name: "Aso-Oke", note: "Ceremonial heritage weaves" },
  { name: "Kampala", note: "Expressive hand-dyed cloth" },
  { name: "Adire", note: "Indigo resist-dyed tradition" },
];

export const lifestyleCategories: LifestyleCategory[] = [
  { name: "Perfume", note: "Signature scents with presence", kind: "fragrance" },
  { name: "Body Spray", note: "Fresh, effortless everyday scent", kind: "body-spray" },
  { name: "Cufflinks", note: "The finishing detail for sharp dressing", kind: "cufflinks" },
];
