export type StorefrontView =
  | "home"
  | "category"
  | "products"
  | "product-detail"
  | "about"
  | "contact";

export type Product = {
  id?: string;
  section?: "fabric" | "accessories";
  name: string;
  category: string;
  price: number;
  saleUnit?: "trouser" | "item";
  color: string;
  texture: string;
  description?: string;
  composition?: string;
  width?: string;
  feel?: string;
  care?: string;
  image?: string;
  media?: ProductMedia[];
  coverMediaId?: string;
  badge?: string;
  active?: boolean;
};

export type ProductMedia = {
  id: string;
  key?: string;
  url?: string;
  name: string;
  type: "image" | "video";
};

export type Category = {
  id?: string;
  section?: "fabric" | "accessories";
  sortOrder?: number;
  name: string;
  note: string;
  active?: boolean;
};

export type LifestyleCategory = Category & {
  price: number;
  kind: "fragrance" | "body-spray" | "perfume-oil" | "cufflinks" | "ofi";
};
