import { catalogCategories, products } from "@/data/catalog";
import type { Category, Product } from "@/types/storefront";

export const ADMIN_PRODUCTS_KEY="hsg-admin-products";
export const ADMIN_CATEGORIES_KEY="hsg-admin-categories";
export const ADMIN_ACCOUNT_KEY="hsg-admin-account";
export const ADMIN_SESSION_KEY="hsg-admin-session";

export const defaultAdminProducts:Product[]=products.map((product,index)=>({
  ...product,
  id:`product-${index+1}`,
  active:true,
}));

export const defaultAdminCategories:Category[]=catalogCategories.map((category,index)=>({
  ...category,
  id:`category-${index+1}`,
  active:true,
}));

export function makeAdminId(prefix:string){
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
