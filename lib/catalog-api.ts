import type { Category, Product, ProductMedia } from "@/types/storefront";

const DEFAULT_API_URL = "https://hsg-be.onrender.com";
const apiUrl = () =>
  process.env.NEXT_PUBLIC_HSG_API_URL?.trim().replace(/\/+$/g, "") ||
  DEFAULT_API_URL;
type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  composition?: string;
  width?: string;
  feel?: string;
  care?: string;
  section: "fabric" | "accessories";
  sortOrder: number;
  active: boolean;
};
type ApiProductMedia = {
  key: string;
  url: string;
  name: string;
  type: "image" | "video";
};
type ApiProduct = {
  id: string;
  slug: string;
  name: string;
  price: number;
  saleUnit?: "trouser" | "item" | null;
  description: string;
  composition?: string | null;
  width?: string | null;
  feel?: string | null;
  care?: string | null;
  color: string;
  texture: string;
  badge?: string;
  imageUrl?: string;
  gallery: ApiProductMedia[];
  active: boolean;
  category: ApiCategory;
};
const normalizeMediaUrl = (url: string, key: string) => {
  try {
    const parsed = new URL(url);
    const bucketEnd = parsed.pathname.indexOf("/", 1);
    if (bucketEnd < 0) return url;
    parsed.pathname = `${parsed.pathname.slice(0, bucketEnd + 1)}${key.split("/").map(encodeURIComponent).join("/")}`;
    return parsed.toString();
  } catch {
    return url;
  }
};
const toCategory = (category: ApiCategory): Category => ({
  id: category.id,
  name: category.name,
  note: category.description,
  section: category.section,
  sortOrder: category.sortOrder,
  active: category.active,
});
const toProduct = (product: ApiProduct): Product => ({
  id: product.id,
  name: product.name,
  section: product.category.section,
  category: product.category.name,
  price: Number(product.price),
  saleUnit:
    product.saleUnit ??
    (product.category.section === "accessories" ? "item" : "trouser"),
  color: product.color,
  texture: product.texture,
  description: product.description || undefined,
  composition: product.composition || undefined,
  width: product.width || undefined,
  feel: product.feel || undefined,
  care: product.care || undefined,
  image:
    product.gallery?.[0]?.key && product.imageUrl
      ? normalizeMediaUrl(product.imageUrl, product.gallery[0].key)
      : product.imageUrl || undefined,
  media: (product.gallery ?? [])
    .filter((media): media is ApiProductMedia =>
      Boolean(media && typeof media === "object" && media.url),
    )
    .map((media) => ({
      id: media.key,
      key: media.key,
      url: normalizeMediaUrl(media.url, media.key),
      name: media.name,
      type: media.type,
    })),
  coverMediaId: product.gallery?.[0]?.key,
  badge: product.badge || undefined,
  active: product.active,
});
const readError = async (response: Response) => {
  try {
    const body = (await response.json()) as { message?: string | string[] };
    return Array.isArray(body.message) ? body.message.join(", ") : body.message;
  } catch {
    return undefined;
  }
};
const ensureOk = async (response: Response) => {
  if (!response.ok)
    throw new Error(
      (await readError(response)) ||
        `API request failed (HTTP ${response.status}).`,
    );
  return response;
};

export async function getStorefrontCategories() {
  const response = await ensureOk(
    await fetch(`${apiUrl()}/api/v1/catalog/categories`, { cache: "no-store" }),
  );
  return ((await response.json()) as ApiCategory[]).map(toCategory);
}
export async function getAdminCategories(baseUrl: string, token: string) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/categories`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
  return ((await response.json()) as ApiCategory[]).map(toCategory);
}
export async function createAdminCategory(
  baseUrl: string,
  token: string,
  input: {
    name: string;
    description: string;
    section: "fabric" | "accessories";
  },
) {
  const slug = input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/categories`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...input, slug, active: true }),
    }),
  );
  return toCategory((await response.json()) as ApiCategory);
}
export async function updateAdminCategory(
  baseUrl: string,
  token: string,
  id: string,
  patch: { active?: boolean; sortOrder?: number },
) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/categories/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    }),
  );
  return toCategory((await response.json()) as ApiCategory);
}
export async function deleteAdminCategory(
  baseUrl: string,
  token: string,
  id: string,
) {
  await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}

export async function getStorefrontProducts() {
  const response = await ensureOk(
    await fetch(`${apiUrl()}/api/v1/catalog/products`, { cache: "no-store" }),
  );
  return ((await response.json()) as ApiProduct[]).map(toProduct);
}
export async function createStorefrontOrder(input: {
  customerName: string;
  phone: string;
  email?: string;
  deliveryAddress: string;
  items: Array<{ productId: string; quantity: number }>;
}) {
  const response = await ensureOk(
    await fetch(`${apiUrl()}/api/v1/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
  return (await response.json()) as { id: string };
}
export async function getAdminProducts(baseUrl: string, token: string) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/products`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
  return ((await response.json()) as ApiProduct[]).map(toProduct);
}
type ProductInput = {
  name: string;
  price: number;
  saleUnit: "trouser" | "item";
  description?: string;
  composition?: string;
  width?: string;
  feel?: string;
  care?: string;
  color: string;
  texture: string;
  badge?: string;
  active: boolean;
  categoryId: string;
  media: ProductMedia[];
};
const productBody = (input: ProductInput) => ({
  name: input.name,
  slug: input.name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, ""),
  price: input.price,
  saleUnit: input.saleUnit,
  description: input.description ?? "",
  composition: input.composition ?? null,
  width: input.width ?? null,
  feel: input.feel ?? null,
  care: input.care ?? null,
  color: input.color,
  texture: input.texture,
  badge: input.badge ?? null,
  active: input.active,
  categoryId: input.categoryId,
  imageUrl: input.media[0]?.url ?? null,
  gallery: input.media.map((media) => ({
    key: media.key ?? media.id,
    url: media.url,
    name: media.name,
    type: media.type,
  })),
});
export async function createAdminProduct(
  baseUrl: string,
  token: string,
  input: ProductInput,
) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/products`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(productBody(input)),
    }),
  );
  return toProduct((await response.json()) as ApiProduct);
}
export async function updateAdminProduct(
  baseUrl: string,
  token: string,
  id: string,
  input: ProductInput,
) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/products/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(productBody(input)),
    }),
  );
  return toProduct((await response.json()) as ApiProduct);
}
export async function updateAdminProductStatus(
  baseUrl: string,
  token: string,
  id: string,
  active: boolean,
) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/products/${id}`, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ active }),
    }),
  );
  return toProduct((await response.json()) as ApiProduct);
}
export async function deleteAdminProduct(
  baseUrl: string,
  token: string,
  id: string,
) {
  await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/catalog/products/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}
export async function uploadAdminProductMedia(
  baseUrl: string,
  token: string,
  file: File,
  productName: string,
): Promise<ProductMedia> {
  const slug =
    productName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "product";
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
  const key = `products/${slug}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const signed = await ensureOk(
    await fetch(`${baseUrl}/api/v1/storage/upload-url`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ key, contentType: file.type }),
    }),
  );
  const { url } = (await signed.json()) as { url: string };
  await ensureOk(
    await fetch(url, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    }),
  );
  const path = key.split("/").map(encodeURIComponent).join("/");
  const read = await ensureOk(
    await fetch(`${baseUrl}/api/v1/storage/read-url/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
  const { url: returnedUrl } = (await read.json()) as { url: string };
  const publicUrl = normalizeMediaUrl(returnedUrl, key);
  return {
    id: key,
    key,
    url: publicUrl,
    name: file.name,
    type: file.type.startsWith("video/") ? "video" : "image",
  };
}
export async function deleteAdminProductMedia(
  baseUrl: string,
  token: string,
  key: string,
) {
  const path = key.split("/").map(encodeURIComponent).join("/");
  await ensureOk(
    await fetch(`${baseUrl}/api/v1/storage/${path}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }),
  );
}
