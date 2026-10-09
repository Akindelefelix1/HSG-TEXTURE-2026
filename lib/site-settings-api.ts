import {
  defaultSiteSettings,
  migrateSiteSettings,
  type SiteSettings,
} from "@/lib/catalog-admin";

const DEFAULT_API_URL = "https://hsg-be.onrender.com";
const SETTINGS_CACHE_KEY = "hsg-site-settings-api-v1";
const apiUrl = () =>
  process.env.NEXT_PUBLIC_HSG_API_URL?.trim().replace(/\/+$/g, "") ||
  DEFAULT_API_URL;

function normalize(settings?: Partial<SiteSettings> | null): SiteSettings {
  return migrateSiteSettings({ ...defaultSiteSettings, ...settings });
}

export function getCachedSiteSettings(): SiteSettings {
  if (typeof window === "undefined") return defaultSiteSettings;
  try {
    return normalize(
      JSON.parse(
        window.localStorage.getItem(SETTINGS_CACHE_KEY) || "null",
      ) as Partial<SiteSettings> | null,
    );
  } catch {
    return defaultSiteSettings;
  }
}

function cacheSiteSettings(settings: SiteSettings) {
  const normalized = normalize(settings);
  if (typeof window !== "undefined")
    window.localStorage.setItem(SETTINGS_CACHE_KEY, JSON.stringify(normalized));
  return normalized;
}

async function ensureOk(response: Response) {
  if (response.ok) return response;
  let message = `Settings request failed (HTTP ${response.status}).`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message;
  } catch {
    // Use the status-based message.
  }
  throw new Error(message);
}

export async function getSiteSettings() {
  const response = await ensureOk(
    await fetch(`${apiUrl()}/api/v1/settings`, { cache: "no-store" }),
  );
  return cacheSiteSettings((await response.json()) as SiteSettings);
}

export async function getAdminSiteSettings(baseUrl: string, token: string) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/settings`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
  return cacheSiteSettings((await response.json()) as SiteSettings);
}

export async function updateAdminSiteSettings(
  baseUrl: string,
  token: string,
  settings: SiteSettings,
) {
  const payload = { ...settings };
  delete payload.heroImageUrl;
  delete payload.heroImageId;
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/settings`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
  );
  const updated = cacheSiteSettings((await response.json()) as SiteSettings);
  window.dispatchEvent(new Event("hsg-site-settings-updated"));
  return updated;
}

export function preloadSiteImage(url?: string) {
  if (!url || typeof window === "undefined") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const image = new Image();
    image.onload = () => resolve();
    image.onerror = () => resolve();
    image.src = url;
  });
}
