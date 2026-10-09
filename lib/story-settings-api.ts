import { defaultStorySettings, type StorySettings } from "@/lib/catalog-admin";

const DEFAULT_API_URL = "https://hsg-be.onrender.com";
export const STORY_CACHE_KEY = "hsg-story-settings-api-v1";
const apiUrl = () =>
  process.env.NEXT_PUBLIC_HSG_API_URL?.trim().replace(/\/+$/g, "") ||
  DEFAULT_API_URL;
const normalize = (value?: Partial<StorySettings> | null): StorySettings => ({
  ...defaultStorySettings,
  ...value,
});
const cache = (value: StorySettings) => {
  const story = normalize(value);
  if (typeof window !== "undefined")
    window.localStorage.setItem(STORY_CACHE_KEY, JSON.stringify(story));
  return story;
};
const ensureOk = async (response: Response) => {
  if (response.ok) return response;
  let message = `Story request failed (HTTP ${response.status}).`;
  try {
    const body = (await response.json()) as { message?: string | string[] };
    if (body.message)
      message = Array.isArray(body.message)
        ? body.message.join(", ")
        : body.message;
  } catch {}
  throw new Error(message);
};
export function getCachedStorySettings() {
  if (typeof window === "undefined") return defaultStorySettings;
  try {
    return normalize(
      JSON.parse(
        window.localStorage.getItem(STORY_CACHE_KEY) || "null",
      ) as Partial<StorySettings> | null,
    );
  } catch {
    return defaultStorySettings;
  }
}
export async function getStorySettings() {
  const response = await ensureOk(
    await fetch(`${apiUrl()}/api/v1/story`, { cache: "no-store" }),
  );
  return cache((await response.json()) as StorySettings);
}
export async function getAdminStorySettings(baseUrl: string, token: string) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/story`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    }),
  );
  return cache((await response.json()) as StorySettings);
}
export async function updateAdminStorySettings(
  baseUrl: string,
  token: string,
  story: StorySettings,
) {
  const response = await ensureOk(
    await fetch(`${baseUrl}/api/v1/admin/story`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ story }),
    }),
  );
  const updated = cache((await response.json()) as StorySettings);
  window.dispatchEvent(new Event("hsg-story-updated"));
  return updated;
}
export async function preloadStoryMedia(story: StorySettings) {
  const media = [
    ...(story.collageMedia ?? []).flatMap((item) =>
      item ? [{ url: item.url, type: item.type }] : [],
    ),
    ...story.feedback.map((item) => ({
      url: item.mediaUrl,
      type: item.mediaType,
    })),
  ].filter(
    (item): item is { url: string; type: "image" | "video" | undefined } =>
      Boolean(item.url),
  );
  const results = await Promise.all(
    media.map(
      ({ url, type }) =>
        new Promise<boolean>((resolve) => {
          if (type === "video") {
            const video = document.createElement("video");
            video.onloadedmetadata = () => resolve(true);
            video.onerror = () => resolve(false);
            video.preload = "metadata";
            video.src = url;
            return;
          }
          const image = new Image();
          image.onload = () => resolve(true);
          image.onerror = () => resolve(false);
          image.src = url;
        }),
    ),
  );
  return results.every(Boolean);
}
