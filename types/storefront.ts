export type StorefrontView =
  | "home"
  | "category"
  | "products"
  | "product-detail"
  | "about"
  | "contact";

export type Product = {
  id?: string;
  name: string;
  category: string;
  price: number;
  color: string;
  texture: string;
  badge?: string;
  active?: boolean;
};

export type Category = {
  id?: string;
  name: string;
  note: string;
  active?: boolean;
};

export type LifestyleCategory = Category & {
  price: number;
  kind: "fragrance" | "body-spray" | "perfume-oil" | "cufflinks" | "ofi";
};
