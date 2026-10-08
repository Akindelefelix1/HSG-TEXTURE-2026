import type { Category, LifestyleCategory, Product } from "@/types/storefront";

export const products: Product[] = [
  { name: "Aso-Oke Heritage Stripe", category: "Aso Oke", price: 18500, color: "#183b8f", texture: "woven", badge: "Bestseller" },
  { name: "Oyo Dawn Aso-Oke", category: "Aso Oke", price: 19800, color: "#b66b46", texture: "woven", badge: "New" },
  { name: "Royal Loom Aso-Oke", category: "Aso Oke", price: 21500, color: "#5d3978", texture: "woven" },
  { name: "Saffron Royal Velvet", category: "Velvet", price: 14800, color: "#d69a20", texture: "velvet", badge: "New" },
  { name: "Forest Evening Velvet", category: "Velvet", price: 15200, color: "#174f3c", texture: "velvet" },
  { name: "Burgundy Opera Velvet", category: "Velvet", price: 15800, color: "#711f32", texture: "velvet", badge: "Limited" },
  { name: "Ivory Cloud Linen", category: "Linen", price: 9200, color: "#e8ddc7", texture: "linen" },
  { name: "Adire Indigo Current", category: "Adire", price: 12750, color: "#163868", texture: "adire", badge: "Hand-dyed" },
  { name: "Osogbo Moon Adire", category: "Adire", price: 13400, color: "#244f82", texture: "adire", badge: "Hand-dyed" },
  { name: "Indigo Rhythm Adire", category: "Adire", price: 12900, color: "#102b55", texture: "adire" },
  { name: "Coral Duchess Satin", category: "Satin", price: 10800, color: "#d96d55", texture: "satin" },
  { name: "Emerald Ankara Mosaic", category: "Ankara", price: 7900, color: "#0f6c50", texture: "ankara" },
  { name: "Midnight Italian Crepe", category: "Crepe", price: 11600, color: "#1b1d2a", texture: "crepe" },
  { name: "Champagne Bridal Lace", category: "Lace", price: 24500, color: "#c9a96e", texture: "lace", badge: "Limited" },
  { name: "Pearl Garden Lace", category: "Lace", price: 22800, color: "#ded2bd", texture: "lace", badge: "New" },
  { name: "Ruby Ceremony Lace", category: "Lace", price: 23900, color: "#9c3041", texture: "lace" },
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
  { name: "Aso Oke", note: "Ceremonial heritage weaves" },
  { name: "Kampala", note: "Expressive hand-dyed cloth" },
  { name: "Adire", note: "Indigo resist-dyed tradition" },
];

export const catalogCategories: Category[] = [
  { name: "Seven Star", note: "Distinguished suiting" },
  { name: "German Wool", note: "Refined weight & finish" },
  { name: "Cashmere", note: "Exceptionally soft handle" },
  { name: "Irish", note: "Crisp premium tradition" },
  { name: "Aso Oke", note: "Ceremonial heritage weaves" },
  { name: "Seven Nine Eight", note: "Distinctive premium tailoring cloth" },
  { name: "Nine Star", note: "Refined cloth for confident tailoring" },
  { name: "Jokonso", note: "Classic fabric with a distinguished finish" },
  { name: "Stripes", note: "Sharp directional style" },
  { name: "Scabal", note: "Luxury tailoring cloth" },
  { name: "Adire", note: "Indigo resist-dyed tradition" },
  { name: "Satin", note: "Fluid drape with an elegant sheen" },
  { name: "Ankara", note: "Bold colour and expressive pattern" },
  { name: "Crepe", note: "Refined texture with graceful movement" },
];

export const lifestyleCategories: LifestyleCategory[] = [
  { name: "Perfume", note: "Signature scents with presence", kind: "fragrance", price: 5000 },
  { name: "Body Spray", note: "Fresh, effortless everyday scent", kind: "body-spray", price: 3000 },
  { name: "Perfume Oil", note: "A concentrated signature scent", kind: "perfume-oil", price: 2500 },
  { name: "Cufflinks", note: "The finishing detail for sharp dressing", kind: "cufflinks", price: 5000 },
  { name: "Ofi", note: "A traditional textile with character", kind: "ofi", price: 2000 },
];
