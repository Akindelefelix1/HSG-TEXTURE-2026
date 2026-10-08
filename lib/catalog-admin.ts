import { catalogCategories, lifestyleCategories, products } from "@/data/catalog";
import type { Category, Product } from "@/types/storefront";

export const ADMIN_PRODUCTS_KEY="hsg-admin-products";
export const ADMIN_CATEGORIES_KEY="hsg-admin-categories";
export const ADMIN_ACCOUNT_KEY="hsg-admin-account";
export const ADMIN_SESSION_KEY="hsg-admin-session";
export const ADMIN_CATALOG_VERSION_KEY="hsg-admin-catalog-version";
export const SITE_SETTINGS_KEY="hsg-site-settings";
export const STORY_SETTINGS_KEY="hsg-story-settings";

export type SiteSettings={announcement:string;heroEyebrow:string;heroTitle:string;heroAccent:string;heroDescription:string;primaryLabel:string;primaryHref:string;secondaryLabel:string;secondaryHref:string;trustOne:string;trustTwo:string;imageNote:string;heroImageId?:string};
export const defaultSiteSettings:SiteSettings={announcement:"New season edit: complimentary Lagos delivery over ₦75,000",heroEyebrow:"The new textile edit",heroTitle:"Find the fabric.",heroAccent:"Make it yours.",heroDescription:"Exceptional textures for defining moments—from everyday silhouettes to once-in-a-lifetime celebrations.",primaryLabel:"Shop new arrivals",primaryHref:"/products?filter=new",secondaryLabel:"Explore collections",secondaryHref:"/category",trustOne:"Nationwide delivery",trustTwo:"Curated quality",imageNote:"Texture you can almost feel"};

export type StoryValue={id:string;number:string;title:string;description:string};
export type CustomerFeedback={id:string;customerName:string;quote:string;mediaId?:string;mediaName?:string;mediaType?:"image"|"video";active:boolean};
export type StorySettings={eyebrow:string;title:string;intro:string;paragraphOne:string;paragraphTwo:string;valuesEyebrow:string;values:StoryValue[];collageMediaIds:string[];feedbackEyebrow:string;feedbackTitle:string;feedbackIntro:string;feedback:CustomerFeedback[]};
export const defaultStorySettings:StorySettings={eyebrow:"Our story",title:"Fabric is where every great idea begins.",intro:"HSG Texture brings the discovery and delight of a great fabric market into a calm, considered shopping experience.",paragraphOne:"We started with a simple belief: choosing fabric should feel as inspiring as wearing the finished piece. So we source in small, intentional edits—prioritising beautiful hand-feel, dependable quality and colours that come alive in natural light.",paragraphTwo:"From heritage occasion cloth to easy linens and statement prints, our collection is made for designers, tailors, stylists and curious first-time makers.",valuesEyebrow:"What guides us",values:[{id:"story-value-1",number:"01",title:"Quality in the hand",description:"We choose fabrics by touch, drape and durability—not just appearance."},{id:"story-value-2",number:"02",title:"Heritage, kept alive",description:"We champion textiles and techniques with stories worth carrying forward."},{id:"story-value-3",number:"03",title:"Service, person to person",description:"Thoughtful help from people who know fabric and respect your vision."}],collageMediaIds:[],feedbackEyebrow:"From our customers",feedbackTitle:"Worn, loved and remembered.",feedbackIntro:"Real stories from customers who chose HSG Texture for moments that matter.",feedback:[]};

export const defaultAdminProducts:Product[]=products.map<Product>((product,index)=>({
  ...product,
  id:`product-${index+1}`,
  section:"fabric" as const,
  active:true,
})).concat(lifestyleCategories.map((item,index)=>({
  id:`accessory-${index+1}`,
  section:"accessories" as const,
  name:item.name,
  category:item.name,
  price:item.price,
  color:["#b99258","#7194a5","#9b6c8b","#8d8c8a","#9b784e"][index]??"#8d8c8a",
  texture:item.kind,
  description:item.note,
  active:true,
})));

export const defaultAdminCategories:Category[]=catalogCategories.map<Category>((category,index)=>({
  ...category,
  id:`category-${index+1}`,
  section:"fabric" as const,
  active:true,
})).concat(lifestyleCategories.map((item,index)=>({
  id:`accessory-category-${index+1}`,
  section:"accessories" as const,
  name:item.name,
  note:item.note,
  active:true,
})));

export function migrateAdminCatalog(){
  if(typeof window==="undefined")return;
  const version=window.localStorage.getItem(ADMIN_CATALOG_VERSION_KEY);
  if(version==="2")return;
  let savedProducts:Product[]=[];
  let savedCategories:Category[]=[];
  try{savedProducts=JSON.parse(window.localStorage.getItem(ADMIN_PRODUCTS_KEY)||"[]") as Product[]}catch{/* Use defaults below. */}
  try{savedCategories=JSON.parse(window.localStorage.getItem(ADMIN_CATEGORIES_KEY)||"[]") as Category[]}catch{/* Use defaults below. */}
  const migratedProducts:Product[]=(savedProducts.length?savedProducts:defaultAdminProducts.filter(product=>product.section==="fabric")).map(product=>({...product,section:product.section??"fabric"}));
  const migratedCategories:Category[]=(savedCategories.length?savedCategories:defaultAdminCategories.filter(category=>category.section==="fabric")).map(category=>({...category,section:category.section??"fabric"}));
  if(!migratedProducts.some(product=>product.section==="accessories"))migratedProducts.push(...defaultAdminProducts.filter(product=>product.section==="accessories"));
  if(!migratedCategories.some(category=>category.section==="accessories"))migratedCategories.push(...defaultAdminCategories.filter(category=>category.section==="accessories"));
  window.localStorage.setItem(ADMIN_PRODUCTS_KEY,JSON.stringify(migratedProducts));
  window.localStorage.setItem(ADMIN_CATEGORIES_KEY,JSON.stringify(migratedCategories));
  window.localStorage.setItem(ADMIN_CATALOG_VERSION_KEY,"2");
}

export function makeAdminId(prefix:string){
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
