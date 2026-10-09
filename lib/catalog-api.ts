import type { Category } from "@/types/storefront";

const DEFAULT_API_URL = "https://hsg-be.onrender.com";
const apiUrl = () =>
  process.env.NEXT_PUBLIC_HSG_API_URL?.trim().replace(/\/+$/g, "") ||
  DEFAULT_API_URL;
type ApiCategory = {
  id: string;
  name: string;
  slug: string;
  description: string;
  section: "fabric" | "accessories";
  active: boolean;
};
const toCategory = (category: ApiCategory): Category => ({
  id: category.id,
  name: category.name,
  note: category.description,
  section: category.section,
  active: category.active,
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
        `Category request failed (HTTP ${response.status}).`,
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
  patch: { active: boolean },
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
