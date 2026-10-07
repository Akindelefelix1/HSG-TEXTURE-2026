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
  color: string;
  texture: string;
  description?: string;
  media?: ProductMedia[];
  coverMediaId?: string;
  badge?: string;
  active?: boolean;
};

export type ProductMedia = {
  id: string;
  name: string;
  type: "image" | "video";
};

export type Category = {
  id?: string;
  section?: "fabric" | "accessories";
  name: string;
  note: string;
  active?: boolean;
};

export type LifestyleCategory = Category & {
  price: number;
  kind: "fragrance" | "body-spray" | "perfume-oil" | "cufflinks" | "ofi";
};
