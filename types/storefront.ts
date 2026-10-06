export type StorefrontView =
  | "home"
  | "category"
  | "products"
  | "product-detail"
  | "about"
  | "contact";

export type Product = {
  name: string;
  category: string;
  price: number;
  color: string;
  texture: string;
  badge?: string;
};

export type Category = {
  name: string;
  note: string;
};

export type LifestyleCategory = Category & {
  kind: "fragrance" | "body-spray" | "cufflinks";
};
