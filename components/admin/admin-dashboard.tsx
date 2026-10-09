"use client";
/* Blob-backed admin previews cannot use the Next.js image optimizer. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  FolderPlus,
  ImagePlus,
  LayoutDashboard,
  Loader2,
  LogOut,
  MessageSquareQuote,
  Monitor,
  Package,
  Plus,
  Search,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { createAuthClient } from "@neondatabase/neon-js/auth";
import {
  BetterAuthVanillaAdapter,
  type BetterAuthVanillaAdapterInstance,
} from "@neondatabase/neon-js/auth/vanilla/adapters";
import {
  STORY_SETTINGS_KEY,
  defaultSiteSettings,
  defaultStorySettings,
  makeAdminId,
  migrateAdminCatalog,
  type CustomerFeedback,
  type SiteSettings,
  type StorySettings,
} from "@/lib/catalog-admin";
import {
  getAdminSiteSettings,
  getCachedSiteSettings,
  updateAdminSiteSettings,
} from "@/lib/site-settings-api";
import { formatNaira } from "@/lib/storefront";
import type { Category, Product, ProductMedia } from "@/types/storefront";
import { AppDialog } from "@/components/ui/app-dialog";
import {
  deleteProductMedia,
  getProductMedia,
  saveProductMedia,
} from "@/lib/product-media";
import {
  createAdminProduct,
  createAdminCategory,
  deleteAdminCategory,
  deleteAdminProduct,
  deleteAdminProductMedia,
  getAdminCategories,
  getAdminProducts,
  updateAdminProduct,
  updateAdminProductStatus,
  uploadAdminProductMedia,
  updateAdminCategory,
} from "@/lib/catalog-api";

type AdminAuthClient = ReturnType<
  typeof createAuthClient<BetterAuthVanillaAdapterInstance>
>;
type AdminTab = "dashboard" | "products" | "categories" | "story" | "settings";
type CatalogSection = "fabric" | "accessories";
type DialogState = {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string | null;
  tone?: "default" | "danger" | "success";
  onConfirm?: () => void;
};
type ProductDraft = {
  section: CatalogSection;
  name: string;
  category: string;
  price: string;
  saleUnit: "trouser" | "item";
  composition: string;
  width: string;
  feel: string;
  care: string;
  color: string;
  texture: string;
  description: string;
  badge: string;
  active: boolean;
};
type MediaDraft = ProductMedia & { url: string; file?: File };
type AdminUser = { email: string; name?: string; role: "admin" };
const emptyProduct: ProductDraft = {
  section: "fabric",
  name: "",
  category: "",
  price: "",
  saleUnit: "trouser",
  composition: "",
  width: "",
  feel: "",
  care: "",
  color: "#183b8f",
  texture: "woven",
  description: "",
  badge: "",
  active: true,
};
const DEFAULT_API_URL = "https://hsg-be.onrender.com";
let adminAuthClient: AdminAuthClient | undefined;

function getAdminAuthServices() {
  const authUrl = process.env.NEXT_PUBLIC_NEON_AUTH_URL?.trim();
  const apiUrl = process.env.NEXT_PUBLIC_HSG_API_URL?.trim() || DEFAULT_API_URL;
  if (!authUrl)
    throw new Error(
      "Admin sign-in is not configured. Set NEXT_PUBLIC_NEON_AUTH_URL before building the storefront.",
    );
  let parsedAuthUrl: URL;
  let parsedApiUrl: URL;
  try {
    parsedAuthUrl = new URL(authUrl);
    parsedApiUrl = new URL(apiUrl);
  } catch {
    throw new Error(
      "Set valid absolute URLs for NEXT_PUBLIC_NEON_AUTH_URL and NEXT_PUBLIC_HSG_API_URL.",
    );
  }
  const isLocalhost = (url: URL) =>
    ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (parsedAuthUrl.protocol !== "https:" && !isLocalhost(parsedAuthUrl))
    throw new Error(
      "NEXT_PUBLIC_NEON_AUTH_URL must use HTTPS outside localhost.",
    );
  if (
    (parsedApiUrl.protocol !== "https:" && !isLocalhost(parsedApiUrl)) ||
    parsedApiUrl.pathname !== "/" ||
    parsedApiUrl.search ||
    parsedApiUrl.hash
  )
    throw new Error(
      "NEXT_PUBLIC_HSG_API_URL must be an HTTPS API origin (localhost is allowed for development).",
    );
  adminAuthClient ??= createAuthClient(authUrl, {
    adapter: BetterAuthVanillaAdapter({
      fetchOptions: { credentials: "include" },
    }),
  });
  return { auth: adminAuthClient, apiUrl: apiUrl.replace(/\/+$/, "") };
}

async function verifyAdminRole(apiUrl: string, token: string) {
  let response: Response;
  try {
    response = await fetch(`${apiUrl}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (cause) {
    if (cause instanceof TypeError)
      throw new Error(
        "The HSG API could not be reached. Check the connection and that this storefront origin is allowed in the BE CORS_ORIGINS.",
      );
    throw cause;
  }
  if (response.status === 401)
    throw new Error(
      "The API could not verify this Neon account. Make sure the Neon Auth project matches the BE database.",
    );
  if (!response.ok)
    throw new Error(
      `Admin access verification failed (HTTP ${response.status}).`,
    );
  const user: unknown = await response.json();
  if (
    !user ||
    typeof user !== "object" ||
    !("role" in user) ||
    user.role !== "admin" ||
    !("email" in user) ||
    typeof user.email !== "string"
  )
    throw new Error(
      "This Neon account does not have admin access. In Neon Console, open Auth → Users and grant this account the admin role.",
    );
  return user as AdminUser;
}

async function getAdminRequestContext() {
  const { auth, apiUrl } = getAdminAuthServices();
  const { data, error } = await auth.token();
  if (error || !data?.token)
    throw new Error(
      error?.message ?? "Your admin session has expired. Please sign in again.",
    );
  return { apiUrl, token: data.token };
}

function readLocal<T>(key: string, fallback: T): T {
  try {
    const value = window.localStorage.getItem(key);
    return value ? (JSON.parse(value) as T) : fallback;
  } catch {
    return fallback;
  }
}

export function AdminDashboard() {
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [authPending, setAuthPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [activeAction, setActiveAction] = useState("");
  const [actionError, setActionError] = useState("");
  const actionInProgress = useRef(false);
  const [tab, setTab] = useState<AdminTab>("dashboard");
  const [catalogSection, setCatalogSection] =
    useState<CatalogSection>("fabric");
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [productModal, setProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<string | null>(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);
  const [draft, setDraft] = useState<ProductDraft>(emptyProduct);
  const [mediaDrafts, setMediaDrafts] = useState<MediaDraft[]>([]);
  const [coverMediaId, setCoverMediaId] = useState("");
  const [removedMediaIds, setRemovedMediaIds] = useState<string[]>([]);
  const [mediaError, setMediaError] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [categoryNote, setCategoryNote] = useState("");
  const [notice, setNotice] = useState("");
  const [siteSettings, setSiteSettings] =
    useState<SiteSettings>(defaultSiteSettings);
  const [storySettings, setStorySettings] =
    useState<StorySettings>(defaultStorySettings);
  const [heroPreview, setHeroPreview] = useState("");
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    migrateAdminCatalog();
    queueMicrotask(() => {
      const cachedSettings = getCachedSiteSettings();
      setSiteSettings(cachedSettings);
      setHeroPreview(cachedSettings.heroImageUrl ?? "");
      setStorySettings(readLocal(STORY_SETTINGS_KEY, defaultStorySettings));
    });
    let mounted = true;
    const restoreAdminSession = async () => {
      try {
        const { auth, apiUrl } = getAdminAuthServices();
        const { data, error } = await auth.token();
        if (error)
          throw new Error(
            error.message ?? "Could not restore the Neon session.",
          );
        if (!data?.token) return;
        const user = await verifyAdminRole(apiUrl, data.token);
        const [serverCategories, serverProducts, serverSettings] =
          await Promise.all([
            getAdminCategories(apiUrl, data.token),
            getAdminProducts(apiUrl, data.token),
            getAdminSiteSettings(apiUrl, data.token),
          ]);
        if (mounted) {
          setCategories(serverCategories);
          setProducts(serverProducts);
          setSiteSettings(serverSettings);
          setHeroPreview(serverSettings.heroImageUrl ?? "");
          setAdminUser(user);
          setAuthenticated(true);
        }
      } catch (cause) {
        if (mounted)
          setAuthError(
            cause instanceof Error
              ? cause.message
              : "Could not verify the admin session.",
          );
      } finally {
        if (mounted) setReady(true);
      }
    };
    void restoreAdminSession();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!productModal) return;
    const frame = requestAnimationFrame(() => {
      document
        .querySelectorAll<HTMLElement>(".admin-media-grid article")
        .forEach((element, index) => {
          const media = mediaDrafts[index];
          if (!media) return;
          element.classList.toggle("cover", media.id === coverMediaId);
          element.tabIndex = 0;
          element.setAttribute("role", "button");
          element.setAttribute(
            "aria-label",
            `${media.id === coverMediaId ? "Cover media" : "Set as cover"}: ${media.name}`,
          );
          element.onclick = (event) => {
            if ((event.target as HTMLElement).closest("button")) return;
            setCoverMediaId(media.id);
          };
          element.onkeydown = (event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setCoverMediaId(media.id);
            }
          };
        });
    });
    return () => cancelAnimationFrame(frame);
  }, [productModal, mediaDrafts, coverMediaId]);

  const publishProducts = (next: Product[]) => {
    setProducts(next);
    window.dispatchEvent(new Event("hsg-products-updated"));
  };
  const publishCategories = (next: Category[]) => {
    setCategories(next);
    window.dispatchEvent(new Event("hsg-categories-updated"));
  };
  const flash = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 2400);
  };
  const runAdminAction = async (
    label: string,
    action: () => Promise<void> | void,
  ) => {
    if (actionInProgress.current) return;
    actionInProgress.current = true;
    setActionError("");
    setActiveAction(label);
    try {
      await action();
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : "The action could not be completed.",
      );
    } finally {
      actionInProgress.current = false;
      setActiveAction("");
    }
  };

  const authenticate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthPending(true);
    try {
      const { auth, apiUrl } = getAdminAuthServices();
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") || "")
        .trim()
        .toLowerCase();
      const password = String(data.get("password") || "");
      const result = await auth.signIn.email({ email, password });
      if (result.error)
        throw new Error(result.error.message ?? "Neon could not sign you in.");
      const tokenResult = await auth.token();
      if (tokenResult.error)
        throw new Error(
          tokenResult.error.message ?? "Could not obtain a Neon access token.",
        );
      if (!tokenResult.data?.token)
        throw new Error(
          "Neon signed you in but did not return an access token.",
        );
      const user = await verifyAdminRole(apiUrl, tokenResult.data.token);
      const serverCategories = await getAdminCategories(
        apiUrl,
        tokenResult.data.token,
      );
      const serverProducts = await getAdminProducts(
        apiUrl,
        tokenResult.data.token,
      );
      setCategories(serverCategories);
      setProducts(serverProducts);
      setAdminUser(user);
      setAuthenticated(true);
    } catch (cause) {
      setAuthError(
        cause instanceof Error ? cause.message : "Admin sign-in failed.",
      );
    } finally {
      setAuthPending(false);
    }
  };

  const logout = async () => {
    setAuthError("");
    await runAdminAction("Signing out", async () => {
      try {
        const { auth } = getAdminAuthServices();
        const result = await auth.signOut();
        if (result.error)
          throw new Error(result.error.message ?? "Neon sign-out failed.");
        setAdminUser(null);
        setProfileOpen(false);
        setAuthenticated(false);
        setTab("dashboard");
      } catch (cause) {
        setAuthError(
          cause instanceof Error ? cause.message : "Admin sign-out failed.",
        );
      }
    });
  };
  const activeProducts = products.filter((product) => product.active !== false);
  const inactiveProducts = products.length - activeProducts.length;
  const activeCategories = categories.filter(
    (category) => category.active !== false,
  );
  const sectionCategories = categories.filter(
    (category) => (category.section ?? "fabric") === catalogSection,
  );
  const inventoryValue = activeProducts.reduce(
    (sum, product) => sum + product.price,
    0,
  );
  const filteredProducts = useMemo(
    () =>
      products.filter(
        (product) =>
          (product.section ?? "fabric") === catalogSection &&
          `${product.name} ${product.category}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [products, catalogSection, search],
  );

  const openProduct = async (product?: Product) => {
    setEditingProduct(product?.id ?? null);
    const section = (product?.section ?? catalogSection) as CatalogSection;
    const availableCategories = categories.filter(
      (category) =>
        (category.section ?? "fabric") === section && category.active !== false,
    );
    setDraft(
      product
        ? {
            section,
            name: product.name,
            category: product.category,
            price: String(product.price),
            saleUnit:
              product.saleUnit ??
              (section === "accessories" ? "item" : "trouser"),
            composition: product.composition ?? "",
            width: product.width ?? "",
            feel: product.feel ?? "",
            care: product.care ?? "",
            color: product.color,
            texture: product.texture,
            description: product.description ?? "",
            badge: product.badge ?? "",
            active: product.active !== false,
          }
        : {
            ...emptyProduct,
            section,
            category: availableCategories[0]?.name ?? "",
          },
    );
    const existing = await Promise.all(
      (product?.media ?? []).map(async (media) => {
        if (media.url) return { ...media, url: media.url };
        const blob = await getProductMedia(media.id);
        return blob ? { ...media, url: URL.createObjectURL(blob) } : null;
      }),
    );
    const available = existing.filter(
      (media): media is MediaDraft => media !== null,
    );
    setMediaDrafts(available);
    setCoverMediaId(
      product?.coverMediaId &&
        available.some((media) => media.id === product.coverMediaId)
        ? product.coverMediaId
        : (available[0]?.id ?? ""),
    );
    setRemovedMediaIds([]);
    setMediaError("");
    setProductModal(true);
  };
  const addMedia = (files: FileList | null) => {
    if (!files) return;
    setMediaError("");
    const supportedTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/webp",
      "video/mp4",
      "video/webm",
    ]);
    const supported = Array.from(files).filter((file) =>
      supportedTypes.has(file.type),
    );
    if (supported.length !== files.length) {
      setMediaError("Use JPG, PNG, WebP, MP4 or WebM files only.");
      return;
    }
    if (mediaDrafts.length + supported.length > 8) {
      setMediaError("You can add up to 8 images and videos per product.");
      return;
    }
    const next = supported.map((file) => ({
      id: makeAdminId("media"),
      name: file.name,
      type: (file.type.startsWith("video/") ? "video" : "image") as
        | "video"
        | "image",
      url: URL.createObjectURL(file),
      file,
    }));
    setMediaDrafts((current) => [...current, ...next]);
    if (!coverMediaId && next[0]) setCoverMediaId(next[0].id);
  };
  const removeMedia = (media: MediaDraft) => {
    URL.revokeObjectURL(media.url);
    const remaining = mediaDrafts.filter((item) => item.id !== media.id);
    setMediaDrafts(remaining);
    if (coverMediaId === media.id) setCoverMediaId(remaining[0]?.id ?? "");
    if (!media.file) setRemovedMediaIds((current) => [...current, media.id]);
  };
  const closeProductModal = () => {
    mediaDrafts.forEach((media) => URL.revokeObjectURL(media.url));
    setProductModal(false);
  };
  const saveProduct = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAdminAction(
      editingProduct ? "Saving product" : "Creating product",
      async () => {
        const name = draft.name.trim();
        const price = Number(draft.price);
        const category = categories.find(
          (item) =>
            item.name === draft.category &&
            (item.section ?? "fabric") === draft.section,
        );
        if (!name || !category?.id || !Number.isFinite(price) || price <= 0)
          return;
        try {
          const { apiUrl, token } = await getAdminRequestContext();
          const orderedDrafts = [...mediaDrafts].sort((a, b) =>
            a.id === coverMediaId ? -1 : b.id === coverMediaId ? 1 : 0,
          );
          const orderedMedia = await Promise.all(
            orderedDrafts.map(async (media) =>
              media.file
                ? uploadAdminProductMedia(apiUrl, token, media.file, name)
                : media,
            ),
          );
          const input = {
            name,
            price,
            categoryId: category.id,
            saleUnit: draft.saleUnit,
            description: draft.description.trim() || undefined,
            composition: draft.composition.trim() || undefined,
            width: draft.width.trim() || undefined,
            feel: draft.feel.trim() || undefined,
            care: draft.care.trim() || undefined,
            color: draft.color,
            texture: draft.texture.trim() || "woven",
            badge: draft.badge.trim() || undefined,
            active: draft.active,
            media: orderedMedia,
          };
          const saved = editingProduct
            ? await updateAdminProduct(apiUrl, token, editingProduct, input)
            : await createAdminProduct(apiUrl, token, input);
          await Promise.all(
            removedMediaIds.map((key) =>
              deleteAdminProductMedia(apiUrl, token, key),
            ),
          );
          publishProducts(
            editingProduct
              ? products.map((product) =>
                  product.id === editingProduct ? saved : product,
                )
              : [saved, ...products],
          );
          closeProductModal();
          flash(
            editingProduct
              ? "Product updated successfully."
              : "Product created successfully.",
          );
        } catch (cause) {
          setMediaError(
            cause instanceof Error
              ? cause.message
              : "The product could not be saved. Please try again.",
          );
        }
      },
    );
  };
  const removeProduct = (product: Product) =>
    setDialog({
      title: "Delete product?",
      description: `${product.name} and its uploaded media will be permanently removed. This action cannot be undone.`,
      confirmLabel: "Delete product",
      tone: "danger",
      onConfirm: () => {
        void runAdminAction("Deleting product", async () => {
          if (!product.id) return;
          try {
            const { apiUrl, token } = await getAdminRequestContext();
            await deleteAdminProduct(apiUrl, token, product.id);
            await Promise.all(
              (product.media ?? [])
                .filter((media) => media.key)
                .map((media) =>
                  deleteAdminProductMedia(apiUrl, token, media.key as string),
                ),
            );
            publishProducts(products.filter((item) => item.id !== product.id));
            flash("Product deleted.");
          } catch (cause) {
            setDialog({
              title: "Product was not deleted",
              description:
                cause instanceof Error
                  ? cause.message
                  : "The product API request failed.",
              confirmLabel: "Close",
              cancelLabel: null,
              tone: "danger",
            });
          }
        });
      },
    });
  const toggleProduct = (id: string | undefined) => {
    void runAdminAction("Updating product", async () => {
      const product = products.find((item) => item.id === id);
      if (!product?.id) return;
      try {
        const { apiUrl, token } = await getAdminRequestContext();
        const updated = await updateAdminProductStatus(
          apiUrl,
          token,
          product.id,
          product.active === false,
        );
        publishProducts(
          products.map((item) => (item.id === updated.id ? updated : item)),
        );
        flash("Product status updated.");
      } catch (cause) {
        setDialog({
          title: "Product was not updated",
          description:
            cause instanceof Error
              ? cause.message
              : "The product API request failed.",
          confirmLabel: "Close",
          cancelLabel: null,
          tone: "danger",
        });
      }
    });
  };
  const addCategory = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAdminAction("Creating category", async () => {
      const name = categoryName.trim();
      if (
        !name ||
        sectionCategories.some(
          (category) => category.name.toLowerCase() === name.toLowerCase(),
        )
      )
        return;
      try {
        const { apiUrl, token } = await getAdminRequestContext();
        const created = await createAdminCategory(apiUrl, token, {
          name,
          description: categoryNote.trim(),
          section: catalogSection,
        });
        publishCategories([...categories, created]);
        setCategoryName("");
        setCategoryNote("");
        flash(
          `${catalogSection === "fabric" ? "Fabric" : "Accessory"} category created.`,
        );
      } catch (cause) {
        setDialog({
          title: "Category was not created",
          description:
            cause instanceof Error
              ? cause.message
              : "The category API request failed.",
          confirmLabel: "Close",
          cancelLabel: null,
          tone: "danger",
        });
      }
    });
  };
  const toggleCategory = (id: string | undefined) => {
    void runAdminAction("Updating category", async () => {
      const category = categories.find((item) => item.id === id);
      if (!category?.id) return;
      try {
        const { apiUrl, token } = await getAdminRequestContext();
        const updated = await updateAdminCategory(apiUrl, token, category.id, {
          active: category.active === false,
        });
        publishCategories(
          categories.map((item) => (item.id === updated.id ? updated : item)),
        );
        flash("Category status updated.");
      } catch (cause) {
        setDialog({
          title: "Category was not updated",
          description:
            cause instanceof Error
              ? cause.message
              : "The category API request failed.",
          confirmLabel: "Close",
          cancelLabel: null,
          tone: "danger",
        });
      }
    });
  };
  const moveCategory = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sectionCategories.length) return;
    const reordered = [...sectionCategories];
    [reordered[index], reordered[target]] = [
      reordered[target],
      reordered[index],
    ];
    void runAdminAction("Reordering categories", async () => {
      const { apiUrl, token } = await getAdminRequestContext();
      const updated = await Promise.all(
        reordered.map((category, sortOrder) =>
          category.id
            ? updateAdminCategory(apiUrl, token, category.id, { sortOrder })
            : Promise.resolve({ ...category, sortOrder }),
        ),
      );
      const updates = new Map(
        updated.map((category) => [category.id, category]),
      );
      publishCategories(
        categories.map((category) => updates.get(category.id) ?? category),
      );
      flash("Category order updated.");
    });
  };
  const removeCategory = (category: Category) => {
    if (
      products.some(
        (product) =>
          product.category === category.name &&
          (product.section ?? "fabric") === (category.section ?? "fabric"),
      )
    ) {
      setDialog({
        title: "Category is still in use",
        description:
          "Move or delete every product in this category before deleting the category.",
        confirmLabel: "Understood",
        cancelLabel: null,
      });
      return;
    }
    setDialog({
      title: "Delete category?",
      description: `${category.name} will be permanently removed. This action cannot be undone.`,
      confirmLabel: "Delete category",
      tone: "danger",
      onConfirm: () => {
        void runAdminAction("Deleting category", async () => {
          if (!category.id) return;
          try {
            const { apiUrl, token } = await getAdminRequestContext();
            await deleteAdminCategory(apiUrl, token, category.id);
            publishCategories(
              categories.filter((item) => item.id !== category.id),
            );
            flash("Category deleted.");
          } catch (cause) {
            setDialog({
              title: "Category was not deleted",
              description:
                cause instanceof Error
                  ? cause.message
                  : "The category API request failed.",
              confirmLabel: "Close",
              cancelLabel: null,
              tone: "danger",
            });
          }
        });
      },
    });
  };
  const resetCatalog = () =>
    setDialog({
      title: "Live catalogue",
      description:
        "Products and categories are now managed in the live database. Create, edit, deactivate or delete individual records instead of restoring browser defaults.",
      confirmLabel: "Understood",
      cancelLabel: null,
    });
  const saveSiteSettings = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAdminAction("Saving website changes", async () => {
      const { auth, apiUrl } = getAdminAuthServices();
      const { data, error } = await auth.token();
      if (error || !data?.token)
        throw new Error(error?.message ?? "Your admin session has expired.");
      const updated = await updateAdminSiteSettings(
        apiUrl,
        data.token,
        siteSettings,
      );
      setSiteSettings(updated);
      setHeroPreview(updated.heroImageUrl ?? heroPreview);
      flash("Website content updated.");
    });
  };
  const updateHeroImage = async (file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    await runAdminAction("Uploading hero image", async () => {
      const { auth, apiUrl } = getAdminAuthServices();
      const { data, error } = await auth.token();
      if (error || !data?.token)
        throw new Error(error?.message ?? "Your admin session has expired.");
      const media = await uploadAdminProductMedia(
        apiUrl,
        data.token,
        file,
        "site hero",
      );
      setHeroPreview(media.url ?? "");
      setSiteSettings((current) => ({
        ...current,
        heroImageKey: media.key,
        heroImageUrl: media.url,
        heroImageId: undefined,
      }));
    });
  };

  if (!ready) return <main className="admin-loading">Loading admin…</main>;
  if (!authenticated)
    return (
      <main className="admin-auth">
        <section className="admin-login-card">
          <Link href="/" className="admin-login-logo">
            <span className="brand-logo" aria-hidden="true" />
          </Link>
          <p className="eyebrow">Store administration</p>
          <h1>Welcome back</h1>
          <p>
            Sign in with your Neon admin account to manage the Hisgrace Texture
            storefront.
          </p>
          <form onSubmit={authenticate}>
            <label>
              Email address
              <input
                name="email"
                type="email"
                required
                autoComplete="username"
                placeholder="admin@hisgracetexture.com"
                disabled={authPending}
              />
            </label>
            <label>
              Password
              <span className="password-field">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={8}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  disabled={authPending}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((value) => !value)}
                  disabled={authPending}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>
            {authError && (
              <div className="admin-auth-error" role="alert">
                {authError}
              </div>
            )}
            <button type="submit" disabled={authPending}>
              {authPending ? "Verifying admin access..." : "Sign in"}{" "}
              <ChevronRight size={17} />
            </button>
          </form>
          <Link href="/">← Return to storefront</Link>
        </section>
      </main>
    );

  const navigation: [AdminTab, string, React.ReactNode][] = [
    ["dashboard", "Overview", <LayoutDashboard key="d" size={18} />],
    ["products", "Products", <Package key="p" size={18} />],
    ["categories", "Categories", <FolderPlus key="c" size={18} />],
    ["story", "Our Story", <MessageSquareQuote key="o" size={18} />],
    ["settings", "Settings", <Settings key="s" size={18} />],
  ];
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link href="/" className="admin-brand">
          <span className="brand-logo" aria-hidden="true" />
          <b>Admin</b>
        </Link>
        <nav>
          {navigation.map(([value, label, icon]) => (
            <button
              key={value}
              className={tab === value ? "active" : ""}
              onClick={() => setTab(value)}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-sidebar-bottom">
          <Link href="/" target="_blank">
            <Eye size={17} /> View storefront
          </Link>
          <button onClick={logout}>
            {activeAction === "Signing out" ? (
              <Loader2 size={17} className="admin-activity-spinner" />
            ) : (
              <LogOut size={17} />
            )}{" "}
            {activeAction === "Signing out" ? "Signing out…" : "Sign out"}
          </button>
        </div>
      </aside>
      <main className="admin-main">
        <header className="admin-topbar">
          <div>
            <small>Hisgrace Texture</small>
            <h1>{navigation.find((item) => item[0] === tab)?.[1]}</h1>
          </div>
          <div className="admin-profile">
            <button
              className="admin-avatar"
              type="button"
              aria-label="View admin profile"
              aria-expanded={profileOpen}
              onClick={() => setProfileOpen((value) => !value)}
            >
              {(
                adminUser?.name?.trim()[0] ??
                adminUser?.email[0] ??
                "A"
              ).toUpperCase()}
            </button>
            {profileOpen && (
              <section
                className="admin-profile-menu"
                aria-label="Admin profile"
              >
                <div className="admin-profile-heading">
                  <span>
                    {(
                      adminUser?.name?.trim()[0] ??
                      adminUser?.email[0] ??
                      "A"
                    ).toUpperCase()}
                  </span>
                  <div>
                    <b>{adminUser?.name?.trim() || "HSG administrator"}</b>
                    <small>Administrator</small>
                  </div>
                </div>
                <p>{adminUser?.email}</p>
                <button type="button" onClick={logout}>
                  {activeAction === "Signing out" ? (
                    <Loader2 size={16} className="admin-activity-spinner" />
                  ) : (
                    <LogOut size={16} />
                  )}{" "}
                  {activeAction === "Signing out" ? "Signing out…" : "Sign out"}
                </button>
              </section>
            )}
          </div>
        </header>
        {activeAction && (
          <div className="admin-activity" role="status" aria-live="polite">
            <Loader2 size={17} className="admin-activity-spinner" />
            {activeAction}…
          </div>
        )}
        {actionError && (
          <div className="admin-action-error" role="alert">
            {actionError}
            <button type="button" onClick={() => setActionError("")}>
              Dismiss
            </button>
          </div>
        )}
        {notice && (
          <div className="admin-notice" role="status">
            <Check size={17} />
            {notice}
          </div>
        )}
        {tab === "dashboard" && (
          <section className="admin-content">
            <div className="admin-welcome">
              <div>
                <p className="eyebrow">Store overview</p>
                <h2>Everything at a glance.</h2>
                <p>
                  Manage products, availability, and the collections customers
                  see.
                </p>
              </div>
              <button
                onClick={() => openProduct()}
                disabled={Boolean(activeAction)}
              >
                <Plus size={17} /> Add product
              </button>
            </div>
            <div className="admin-metrics">
              <article>
                <span>Active products</span>
                <b>{activeProducts.length}</b>
                <small>{inactiveProducts} inactive</small>
              </article>
              <article>
                <span>Categories</span>
                <b>{activeCategories.length}</b>
                <small>
                  {categories.length - activeCategories.length} hidden
                </small>
              </article>
              <article>
                <span>Catalogue value</span>
                <b>{formatNaira(inventoryValue)}</b>
                <small>One unit of every active item</small>
              </article>
            </div>
            <div className="admin-panel">
              <div className="admin-panel-title">
                <div>
                  <h3>Recently managed products</h3>
                  <p>Quick access to your catalogue.</p>
                </div>
                <button onClick={() => setTab("products")}>
                  View all <ChevronRight size={15} />
                </button>
              </div>
              <ProductTable
                products={products.slice(0, 6)}
                onPreview={setPreviewProduct}
              />
            </div>
          </section>
        )}
        {tab === "products" && (
          <section className="admin-content">
            <SectionSwitch
              value={catalogSection}
              onChange={(value) => {
                setCatalogSection(value);
                setSearch("");
              }}
              fabricCount={
                products.filter(
                  (product) => (product.section ?? "fabric") === "fabric",
                ).length
              }
              accessoriesCount={
                products.filter((product) => product.section === "accessories")
                  .length
              }
            />
            <div className="admin-page-actions">
              <div className="admin-search">
                <Search size={17} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder={`Search ${catalogSection} products`}
                />
              </div>
              <button
                onClick={() => openProduct()}
                disabled={Boolean(activeAction)}
              >
                <Plus size={17} /> New{" "}
                {catalogSection === "fabric" ? "fabric" : "accessory"}
              </button>
            </div>
            <div className="admin-panel">
              <ProductTable
                products={filteredProducts}
                onPreview={setPreviewProduct}
              />
            </div>
          </section>
        )}
        {tab === "categories" && (
          <section className="admin-content">
            <SectionSwitch
              value={catalogSection}
              onChange={setCatalogSection}
              fabricCount={
                categories.filter(
                  (category) => (category.section ?? "fabric") === "fabric",
                ).length
              }
              accessoriesCount={
                categories.filter(
                  (category) => category.section === "accessories",
                ).length
              }
            />
            <div className="admin-category-layout">
              <form
                className="admin-panel admin-category-form"
                onSubmit={addCategory}
              >
                <p className="eyebrow">
                  New {catalogSection === "fabric" ? "fabric" : "accessory"}{" "}
                  collection
                </p>
                <h3>Create category</h3>
                <label>
                  Category name
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    required
                    placeholder={
                      catalogSection === "fabric"
                        ? "e.g. Italian Wool"
                        : "e.g. Watches"
                    }
                  />
                </label>
                <label>
                  Description
                  <textarea
                    value={categoryNote}
                    onChange={(event) => setCategoryNote(event.target.value)}
                    rows={4}
                    placeholder="A short customer-facing description"
                  />
                </label>
                <button type="submit" disabled={Boolean(activeAction)}>
                  {activeAction === "Creating category" ? (
                    <Loader2 size={17} className="admin-activity-spinner" />
                  ) : (
                    <Plus size={17} />
                  )}{" "}
                  {activeAction === "Creating category"
                    ? "Creating category…"
                    : "Create category"}
                </button>
              </form>
              <div className="admin-panel">
                <div className="admin-panel-title">
                  <div>
                    <h3>
                      {catalogSection === "fabric" ? "Fabric" : "Accessory"}{" "}
                      categories
                    </h3>
                    <p>Show or hide collections across the storefront.</p>
                  </div>
                </div>
                <div className="admin-category-list">
                  {sectionCategories.map((category, index) => (
                    <article key={category.id}>
                      <div>
                        <span
                          className={
                            category.active === false
                              ? "status-dot off"
                              : "status-dot"
                          }
                        />
                        <div>
                          <b>{category.name}</b>
                          <p>{category.note || "No description"}</p>
                        </div>
                      </div>
                      <div>
                        <span className="admin-category-order">
                          <button
                            type="button"
                            onClick={() => moveCategory(index, -1)}
                            disabled={Boolean(activeAction) || index === 0}
                            aria-label={`Move ${category.name} up`}
                          >
                            <ChevronUp size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveCategory(index, 1)}
                            disabled={
                              Boolean(activeAction) ||
                              index === sectionCategories.length - 1
                            }
                            aria-label={`Move ${category.name} down`}
                          >
                            <ChevronDown size={16} />
                          </button>
                        </span>
                        <button
                          onClick={() => toggleCategory(category.id)}
                          disabled={Boolean(activeAction)}
                        >
                          {activeAction === "Updating category" ? (
                            <Loader2
                              size={16}
                              className="admin-activity-spinner"
                            />
                          ) : category.active === false ? (
                            <Eye size={16} />
                          ) : (
                            <EyeOff size={16} />
                          )}{" "}
                          {category.active === false
                            ? "Activate"
                            : "Deactivate"}
                        </button>
                        <button
                          className="danger"
                          onClick={() => removeCategory(category)}
                          aria-label={`Delete ${category.name}`}
                          disabled={Boolean(activeAction)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </section>
        )}
        {tab === "story" && (
          <StoryEditor
            settings={storySettings}
            onChange={setStorySettings}
            onSaved={() => flash("Our Story page updated.")}
            runAction={runAdminAction}
            activeAction={activeAction}
          />
        )}
        {tab === "settings" && (
          <section className="admin-content">
            <form
              className="admin-panel admin-site-editor"
              onSubmit={saveSiteSettings}
            >
              <div className="admin-panel-title">
                <div>
                  <p className="eyebrow">Landing page</p>
                  <h2>Announcement & hero</h2>
                  <p>Update the content customers see first.</p>
                </div>
                <button type="submit" disabled={Boolean(activeAction)}>
                  {activeAction === "Saving website changes" ? (
                    <Loader2 size={17} className="admin-activity-spinner" />
                  ) : null}
                  {activeAction === "Saving website changes"
                    ? "Saving…"
                    : "Save website changes"}
                </button>
              </div>
              <label className="wide">
                Announcement bar
                <input
                  value={siteSettings.announcement}
                  onChange={(event) =>
                    setSiteSettings({
                      ...siteSettings,
                      announcement: event.target.value,
                    })
                  }
                />
              </label>
              <div className="admin-site-grid">
                <label>
                  Hero eyebrow
                  <input
                    value={siteSettings.heroEyebrow}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        heroEyebrow: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Main heading
                  <input
                    value={siteSettings.heroTitle}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        heroTitle: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Highlighted heading
                  <input
                    value={siteSettings.heroAccent}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        heroAccent: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Image caption
                  <input
                    value={siteSettings.imageNote}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        imageNote: event.target.value,
                      })
                    }
                  />
                </label>
                <label className="wide">
                  Supporting text
                  <textarea
                    rows={3}
                    value={siteSettings.heroDescription}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        heroDescription: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Primary button label
                  <input
                    value={siteSettings.primaryLabel}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        primaryLabel: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Primary button link
                  <input
                    value={siteSettings.primaryHref}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        primaryHref: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Secondary button label
                  <input
                    value={siteSettings.secondaryLabel}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        secondaryLabel: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Secondary button link
                  <input
                    value={siteSettings.secondaryHref}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        secondaryHref: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  First trust message
                  <input
                    value={siteSettings.trustOne}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        trustOne: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  Second trust message
                  <input
                    value={siteSettings.trustTwo}
                    onChange={(event) =>
                      setSiteSettings({
                        ...siteSettings,
                        trustTwo: event.target.value,
                      })
                    }
                  />
                </label>
              </div>
              <div className="admin-hero-upload">
                <div
                  className="admin-hero-preview"
                  style={
                    heroPreview
                      ? { backgroundImage: `url(${heroPreview})` }
                      : undefined
                  }
                />
                <div>
                  <b>Hero image</b>
                  <p>
                    Use a wide, high-quality image. JPG, PNG and WebP are
                    supported.
                  </p>
                  <label>
                    <ImagePlus size={17} /> Replace hero image
                    <input
                      type="file"
                      accept="image/*"
                      disabled={Boolean(activeAction)}
                      onChange={(event) => {
                        void updateHeroImage(event.target.files?.[0]);
                        event.target.value = "";
                      }}
                    />
                  </label>
                </div>
              </div>
            </form>
            <div className="admin-panel admin-settings admin-maintenance">
              <p className="eyebrow">Administration</p>
              <h2>Store settings</h2>
              <div className="admin-setting-row">
                <div>
                  <b>Storefront data</b>
                  <p>Restore the original product and category catalogue.</p>
                </div>
                <button
                  className="danger-outline"
                  onClick={resetCatalog}
                  disabled={Boolean(activeAction)}
                >
                  Restore defaults
                </button>
              </div>
              <div className="admin-setting-row">
                <div>
                  <b>Admin session</b>
                  <p>Sign out of the dashboard on this device.</p>
                </div>
                <button onClick={logout} disabled={Boolean(activeAction)}>
                  Sign out
                </button>
              </div>
              <div className="admin-security-note">
                <b>Deployment note</b>
                <p>
                  This immediate version stores admin data in this browser.
                  Before inviting multiple staff or managing live inventory
                  across devices, connect the isolated catalogue layer to D1 and
                  server-side authentication.
                </p>
              </div>
            </div>
          </section>
        )}
        {previewProduct && (
          <AdminProductPreview
            product={previewProduct}
            onClose={() => setPreviewProduct(null)}
            onEdit={() => {
              const product = previewProduct;
              setPreviewProduct(null);
              void openProduct(product);
            }}
            onToggle={() => {
              toggleProduct(previewProduct.id);
              setPreviewProduct({
                ...previewProduct,
                active: previewProduct.active === false,
              });
            }}
            onDelete={() => {
              const product = previewProduct;
              setPreviewProduct(null);
              removeProduct(product);
            }}
          />
        )}
      </main>
      {productModal && (
        <div className="admin-modal-backdrop" onClick={closeProductModal}>
          <section
            className="admin-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-modal-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="admin-modal-close"
              onClick={closeProductModal}
              aria-label="Close"
            >
              <X />
            </button>
            <p className="eyebrow">
              {draft.section === "fabric" ? "Fabric" : "Accessories"} catalogue
            </p>
            <h2 id="product-modal-title">
              {editingProduct ? "Edit product" : "Create product"}
            </h2>
            <form onSubmit={saveProduct}>
              <label>
                Major section
                <select
                  value={draft.section}
                  onChange={(event) => {
                    const section = event.target.value as CatalogSection;
                    const first = categories.find(
                      (category) =>
                        (category.section ?? "fabric") === section &&
                        category.active !== false,
                    );
                    setDraft({
                      ...draft,
                      section,
                      saleUnit: section === "accessories" ? "item" : "trouser",
                      category: first?.name ?? "",
                    });
                  }}
                >
                  <option value="fabric">Fabric</option>
                  <option value="accessories">Accessories</option>
                </select>
              </label>
              <label>
                Category
                <select
                  required
                  value={draft.category}
                  onChange={(event) =>
                    setDraft({ ...draft, category: event.target.value })
                  }
                >
                  <option value="">Select category</option>
                  {categories
                    .filter(
                      (category) =>
                        (category.section ?? "fabric") === draft.section &&
                        category.active !== false,
                    )
                    .map((category) => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                Sold as
                <select
                  value={draft.saleUnit}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      saleUnit: event.target.value as "trouser" | "item",
                    })
                  }
                  disabled={draft.section === "accessories"}
                >
                  <option value="trouser">Per trouser</option>
                  <option value="item">Per item</option>
                </select>
                <small>
                  This sets how the price and quantity are shown in the store.
                </small>
              </label>
              <label className="wide">
                Product name
                <input
                  required
                  value={draft.name}
                  onChange={(event) =>
                    setDraft({ ...draft, name: event.target.value })
                  }
                  placeholder="Product name"
                />
              </label>
              <label>
                Composition (optional)
                <input
                  value={draft.composition}
                  onChange={(event) =>
                    setDraft({ ...draft, composition: event.target.value })
                  }
                  placeholder="e.g. Premium blended textile"
                />
              </label>
              <label>
                Width (optional)
                <input
                  value={draft.width}
                  onChange={(event) =>
                    setDraft({ ...draft, width: event.target.value })
                  }
                  placeholder="e.g. 58–60 inches"
                />
              </label>
              <label>
                Feel (optional)
                <input
                  value={draft.feel}
                  onChange={(event) =>
                    setDraft({ ...draft, feel: event.target.value })
                  }
                  placeholder="e.g. Soft, structured handle"
                />
              </label>
              <label>
                Care (optional)
                <input
                  value={draft.care}
                  onChange={(event) =>
                    setDraft({ ...draft, care: event.target.value })
                  }
                  placeholder="e.g. Dry clean recommended"
                />
              </label>
              <label>
                Price (₦)
                <input
                  required
                  type="number"
                  min="1"
                  value={draft.price}
                  onChange={(event) =>
                    setDraft({ ...draft, price: event.target.value })
                  }
                />
              </label>
              <label>
                Colour
                <input
                  type="color"
                  value={draft.color}
                  onChange={(event) =>
                    setDraft({ ...draft, color: event.target.value })
                  }
                />
              </label>
              <label>
                Texture style
                <input
                  value={draft.texture}
                  onChange={(event) =>
                    setDraft({ ...draft, texture: event.target.value })
                  }
                  placeholder={
                    draft.section === "fabric" ? "woven" : "fragrance"
                  }
                />
              </label>
              <label>
                Badge
                <input
                  value={draft.badge}
                  onChange={(event) =>
                    setDraft({ ...draft, badge: event.target.value })
                  }
                  placeholder="New, Bestseller, Limited…"
                />
              </label>
              <label className="wide">
                Description
                <input
                  value={draft.description}
                  onChange={(event) =>
                    setDraft({ ...draft, description: event.target.value })
                  }
                  placeholder="Short product description"
                />
              </label>
              <div className="admin-media-field wide">
                <div>
                  <b>Product media</b>
                  <span>{mediaDrafts.length}/8 items</span>
                </div>
                <label className="admin-media-upload">
                  <ImagePlus size={22} />
                  <strong>Add pictures or videos</strong>
                  <small>Choose up to 8 items in total</small>
                  <input
                    type="file"
                    accept="image/*,video/*"
                    multiple
                    onChange={(event) => {
                      addMedia(event.target.files);
                      event.target.value = "";
                    }}
                    disabled={mediaDrafts.length >= 8}
                  />
                </label>
                {mediaError && (
                  <p className="admin-media-error" role="alert">
                    {mediaError}
                  </p>
                )}
                {mediaDrafts.length > 0 && (
                  <div className="admin-media-grid">
                    {mediaDrafts.map((media, index) => (
                      <article key={media.id}>
                        {media.type === "video" ? (
                          <video src={media.url} muted playsInline />
                        ) : (
                          <img src={media.url} alt="" />
                        )}
                        <span>{index + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeMedia(media)}
                          aria-label={`Remove ${media.name}`}
                        >
                          <X size={15} />
                        </button>
                        <small>{media.type}</small>
                      </article>
                    ))}
                  </div>
                )}
              </div>
              <label className="admin-check wide">
                <input
                  type="checkbox"
                  checked={draft.active}
                  onChange={(event) =>
                    setDraft({ ...draft, active: event.target.checked })
                  }
                />{" "}
                Active and visible on storefront
              </label>
              <div className="admin-modal-actions wide">
                <button type="button" onClick={closeProductModal}>
                  Cancel
                </button>
                <button type="submit" disabled={Boolean(activeAction)}>
                  {activeAction === "Saving product" ||
                  activeAction === "Creating product" ? (
                    <Loader2 size={17} className="admin-activity-spinner" />
                  ) : null}
                  {activeAction === "Saving product"
                    ? "Saving product…"
                    : activeAction === "Creating product"
                      ? "Creating product…"
                      : editingProduct
                        ? "Save changes"
                        : "Create product"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
      <AppDialog
        open={Boolean(dialog)}
        title={dialog?.title ?? ""}
        description={dialog?.description ?? ""}
        confirmLabel={dialog?.confirmLabel}
        cancelLabel={dialog?.cancelLabel}
        tone={dialog?.tone}
        onConfirm={dialog?.onConfirm}
        onClose={() => setDialog(null)}
      />
    </div>
  );
}

function StoryEditor({
  settings,
  onChange,
  onSaved,
  runAction,
  activeAction,
}: {
  settings: StorySettings;
  onChange: (value: StorySettings) => void;
  onSaved: () => void;
  runAction: (
    label: string,
    action: () => Promise<void> | void,
  ) => Promise<void>;
  activeAction: string;
}) {
  const [panel, setPanel] = useState<"content" | "identity" | "feedback">(
    "content",
  );
  const [customerName, setCustomerName] = useState("");
  const [quote, setQuote] = useState("");
  const [feedbackFile, setFeedbackFile] = useState<File | null>(null);
  const persist = (next: StorySettings) => {
    onChange(next);
    window.localStorage.setItem(STORY_SETTINGS_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event("hsg-story-updated"));
  };
  const saveCopy = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void runAction("Saving story changes", () => {
      persist(settings);
      onSaved();
    });
  };
  const setValue = (
    index: number,
    field: "number" | "title" | "description",
    value: string,
  ) =>
    onChange({
      ...settings,
      values: settings.values.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item,
      ),
    });
  const uploadCollage = async (index: number, file?: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    await runAction("Uploading story image", async () => {
      const previous = settings.collageMediaIds[index];
      const id = previous || makeAdminId("story-collage");
      await saveProductMedia(id, file);
      const ids = [...settings.collageMediaIds];
      ids[index] = id;
      persist({ ...settings, collageMediaIds: ids });
      onSaved();
    });
  };
  const addFeedback = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!customerName.trim() || !quote.trim()) return;
    const form = event.currentTarget;
    await runAction("Publishing customer feedback", async () => {
      let mediaId: string | undefined;
      let mediaType: "image" | "video" | undefined;
      let mediaName: string | undefined;
      if (feedbackFile) {
        mediaId = makeAdminId("feedback-media");
        mediaType = feedbackFile.type.startsWith("video/") ? "video" : "image";
        mediaName = feedbackFile.name;
        await saveProductMedia(mediaId, feedbackFile);
      }
      const feedback: CustomerFeedback = {
        id: makeAdminId("feedback"),
        customerName: customerName.trim(),
        quote: quote.trim(),
        mediaId,
        mediaType,
        mediaName,
        active: true,
      };
      persist({ ...settings, feedback: [feedback, ...settings.feedback] });
      setCustomerName("");
      setQuote("");
      setFeedbackFile(null);
      (form.elements.namedItem("feedbackMedia") as HTMLInputElement).value = "";
      onSaved();
    });
  };
  const updateFeedback = (id: string, patch: Partial<CustomerFeedback>) =>
    persist({
      ...settings,
      feedback: settings.feedback.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    });
  const removeFeedback = (item: CustomerFeedback) => {
    void runAction("Removing customer feedback", async () => {
      if (item.mediaId) await deleteProductMedia(item.mediaId);
      persist({
        ...settings,
        feedback: settings.feedback.filter(
          (feedback) => feedback.id !== item.id,
        ),
      });
      onSaved();
    });
  };
  return (
    <section className="admin-content admin-story-editor">
      <div className="admin-story-heading">
        <div>
          <p className="eyebrow">Page management</p>
          <h2>Our Story</h2>
          <p>Edit one area at a time, then preview the finished page.</p>
        </div>
        <Link href="/about" target="_blank">
          <Eye size={16} /> View live page
        </Link>
      </div>
      <nav className="admin-story-tabs" aria-label="Our Story editor sections">
        <button
          className={panel === "content" ? "active" : ""}
          onClick={() => setPanel("content")}
        >
          <span>01</span>
          <div>
            <b>Page content</b>
            <small>Headline and story copy</small>
          </div>
        </button>
        <button
          className={panel === "identity" ? "active" : ""}
          onClick={() => setPanel("identity")}
        >
          <span>02</span>
          <div>
            <b>Values & images</b>
            <small>Brand pillars and collage</small>
          </div>
        </button>
        <button
          className={panel === "feedback" ? "active" : ""}
          onClick={() => setPanel("feedback")}
        >
          <span>03</span>
          <div>
            <b>Customer reviews</b>
            <small>{settings.feedback.length} saved reviews</small>
          </div>
        </button>
      </nav>
      {panel === "content" && (
        <form
          className="admin-panel admin-story-copy admin-story-workspace"
          onSubmit={saveCopy}
        >
          <div className="admin-story-section-head">
            <div>
              <span>Page content</span>
              <h3>Tell the HSG Texture story</h3>
              <p>
                These fields form the opening and main narrative of the public
                page.
              </p>
            </div>
            <button type="submit" disabled={Boolean(activeAction)}>
              {activeAction === "Saving story changes" ? (
                <Loader2 size={16} className="admin-activity-spinner" />
              ) : null}
              {activeAction === "Saving story changes"
                ? "Saving…"
                : "Save changes"}
            </button>
          </div>
          <div className="admin-story-form-grid">
            <label>
              Small heading
              <input
                value={settings.eyebrow}
                onChange={(event) =>
                  onChange({ ...settings, eyebrow: event.target.value })
                }
              />
              <small>Displayed above the main headline</small>
            </label>
            <label>
              Page headline
              <input
                value={settings.title}
                onChange={(event) =>
                  onChange({ ...settings, title: event.target.value })
                }
              />
              <small>The first message visitors see</small>
            </label>
            <label className="wide">
              Introductory statement
              <textarea
                rows={3}
                value={settings.intro}
                onChange={(event) =>
                  onChange({ ...settings, intro: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Our beginning
              <textarea
                rows={5}
                value={settings.paragraphOne}
                onChange={(event) =>
                  onChange({ ...settings, paragraphOne: event.target.value })
                }
              />
            </label>
            <label className="wide">
              Who we serve
              <textarea
                rows={4}
                value={settings.paragraphTwo}
                onChange={(event) =>
                  onChange({ ...settings, paragraphTwo: event.target.value })
                }
              />
            </label>
          </div>
        </form>
      )}
      {panel === "identity" && (
        <div className="admin-story-identity-grid">
          <form
            className="admin-panel admin-story-copy admin-story-workspace"
            onSubmit={saveCopy}
          >
            <div className="admin-story-section-head">
              <div>
                <span>Brand principles</span>
                <h3>What guides us</h3>
                <p>Edit the values customers see below the story.</p>
              </div>
              <button type="submit" disabled={Boolean(activeAction)}>
                {activeAction === "Saving story changes" ? (
                  <Loader2 size={16} className="admin-activity-spinner" />
                ) : null}
                {activeAction === "Saving story changes"
                  ? "Saving…"
                  : "Save values"}
              </button>
            </div>
            <label className="admin-story-label">
              Section heading
              <input
                value={settings.valuesEyebrow}
                onChange={(event) =>
                  onChange({ ...settings, valuesEyebrow: event.target.value })
                }
              />
            </label>
            <div className="admin-story-value-cards">
              {settings.values.map((value, index) => (
                <article key={value.id}>
                  <div>
                    <span>{value.number || `0${index + 1}`}</span>
                    <b>Value {index + 1}</b>
                  </div>
                  <label>
                    Number
                    <input
                      value={value.number}
                      onChange={(event) =>
                        setValue(index, "number", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Title
                    <input
                      value={value.title}
                      onChange={(event) =>
                        setValue(index, "title", event.target.value)
                      }
                    />
                  </label>
                  <label>
                    Description
                    <textarea
                      rows={3}
                      value={value.description}
                      onChange={(event) =>
                        setValue(index, "description", event.target.value)
                      }
                    />
                  </label>
                </article>
              ))}
            </div>
          </form>
          <section className="admin-panel admin-story-media">
            <div className="admin-story-section-head">
              <div>
                <span>Visual story</span>
                <h3>Page collage</h3>
                <p>Use three complementary portrait or detail images.</p>
              </div>
            </div>
            <div>
              {[0, 1, 2].map((index) => (
                <label key={index}>
                  <StoryMediaPreview
                    id={settings.collageMediaIds[index]}
                    fallback={`Image ${index + 1}`}
                  />
                  <span>
                    <ImagePlus size={16} />{" "}
                    {settings.collageMediaIds[index]
                      ? "Replace image"
                      : "Upload image"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={Boolean(activeAction)}
                    onChange={(event) => {
                      void uploadCollage(index, event.target.files?.[0]);
                      event.target.value = "";
                    }}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>
      )}
      {panel === "feedback" && (
        <div className="admin-story-feedback-workspace">
          <form
            className="admin-panel admin-story-copy admin-feedback-settings"
            onSubmit={saveCopy}
          >
            <div className="admin-story-section-head">
              <div>
                <span>Section introduction</span>
                <h3>Customer review heading</h3>
              </div>
              <button type="submit" disabled={Boolean(activeAction)}>
                {activeAction === "Saving story changes" ? (
                  <Loader2 size={16} className="admin-activity-spinner" />
                ) : null}
                {activeAction === "Saving story changes"
                  ? "Saving…"
                  : "Save heading"}
              </button>
            </div>
            <div className="admin-story-form-grid">
              <label>
                Small heading
                <input
                  value={settings.feedbackEyebrow}
                  onChange={(event) =>
                    onChange({
                      ...settings,
                      feedbackEyebrow: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                Section headline
                <input
                  value={settings.feedbackTitle}
                  onChange={(event) =>
                    onChange({ ...settings, feedbackTitle: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                Introduction
                <textarea
                  rows={2}
                  value={settings.feedbackIntro}
                  onChange={(event) =>
                    onChange({ ...settings, feedbackIntro: event.target.value })
                  }
                />
              </label>
            </div>
          </form>
          <section className="admin-feedback-layout">
            <form
              className="admin-panel admin-feedback-form"
              onSubmit={addFeedback}
            >
              <p className="eyebrow">New review</p>
              <h3>Add customer feedback</h3>
              <label>
                Customer name
                <input
                  required
                  value={customerName}
                  onChange={(event) => setCustomerName(event.target.value)}
                  placeholder="Customer name"
                />
              </label>
              <label>
                Review or feedback
                <textarea
                  required
                  rows={5}
                  value={quote}
                  onChange={(event) => setQuote(event.target.value)}
                  placeholder="What did the customer say?"
                />
              </label>
              <label className="admin-feedback-upload">
                <ImagePlus size={18} />
                <span>
                  {feedbackFile
                    ? feedbackFile.name
                    : "Add an image or video (optional)"}
                </span>
                <input
                  name="feedbackMedia"
                  type="file"
                  accept="image/*,video/*"
                  disabled={Boolean(activeAction)}
                  onChange={(event) =>
                    setFeedbackFile(event.target.files?.[0] ?? null)
                  }
                />
              </label>
              <button type="submit" disabled={Boolean(activeAction)}>
                {activeAction === "Publishing customer feedback" ? (
                  <Loader2 size={16} className="admin-activity-spinner" />
                ) : (
                  <Plus size={16} />
                )}{" "}
                {activeAction === "Publishing customer feedback"
                  ? "Publishing…"
                  : "Publish feedback"}
              </button>
            </form>
            <div className="admin-panel admin-feedback-list">
              <div className="admin-panel-title">
                <div>
                  <h3>Saved reviews</h3>
                  <p>Edit, hide or remove customer feedback.</p>
                </div>
                <span className="admin-review-count">
                  {settings.feedback.length}
                </span>
              </div>
              {settings.feedback.length === 0 ? (
                <div className="admin-empty">
                  <MessageSquareQuote size={30} />
                  <b>No customer feedback yet</b>
                  <p>Add the first review using the form.</p>
                </div>
              ) : (
                settings.feedback.map((item) => (
                  <article key={item.id}>
                    <StoryMediaPreview
                      id={item.mediaId}
                      type={item.mediaType}
                      fallback="Text review"
                    />
                    <div>
                      <input
                        aria-label="Customer name"
                        value={item.customerName}
                        onChange={(event) =>
                          updateFeedback(item.id, {
                            customerName: event.target.value,
                          })
                        }
                      />
                      <textarea
                        aria-label="Feedback"
                        rows={3}
                        value={item.quote}
                        onChange={(event) =>
                          updateFeedback(item.id, { quote: event.target.value })
                        }
                      />
                      <small>{item.mediaName || "Text-only review"}</small>
                    </div>
                    <div>
                      <button
                        onClick={() =>
                          void runAction("Updating customer feedback", () =>
                            updateFeedback(item.id, {
                              active: !item.active,
                            }),
                          )
                        }
                        disabled={Boolean(activeAction)}
                      >
                        {activeAction === "Updating customer feedback" ? (
                          <Loader2
                            size={15}
                            className="admin-activity-spinner"
                          />
                        ) : item.active ? (
                          <EyeOff size={15} />
                        ) : (
                          <Eye size={15} />
                        )}{" "}
                        {activeAction === "Updating customer feedback"
                          ? "Updating…"
                          : item.active
                            ? "Hide"
                            : "Show"}
                      </button>
                      <button
                        className="danger"
                        onClick={() => removeFeedback(item)}
                        disabled={Boolean(activeAction)}
                        aria-label={`Delete feedback from ${item.customerName}`}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function StoryMediaPreview({
  id,
  type,
  fallback,
}: {
  id?: string;
  type?: "image" | "video";
  fallback: string;
}) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    let created = "";
    if (id)
      void getProductMedia(id).then((blob) => {
        if (blob && active) {
          created = URL.createObjectURL(blob);
          setUrl(created);
        }
      });
    else
      queueMicrotask(() => {
        if (active) setUrl("");
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);
  if (!url)
    return (
      <span className="admin-story-media-fallback">
        <ImagePlus size={24} />
        {fallback}
      </span>
    );
  return type === "video" ? (
    <video src={url} muted controls playsInline />
  ) : (
    <img src={url} alt="" />
  );
}

function SectionSwitch({
  value,
  onChange,
  fabricCount,
  accessoriesCount,
}: {
  value: CatalogSection;
  onChange: (value: CatalogSection) => void;
  fabricCount: number;
  accessoriesCount: number;
}) {
  return (
    <div className="admin-section-switch" aria-label="Catalogue section">
      <button
        className={value === "fabric" ? "active" : ""}
        onClick={() => onChange("fabric")}
      >
        <span>Fabric</span>
        <b>{fabricCount}</b>
      </button>
      <button
        className={value === "accessories" ? "active" : ""}
        onClick={() => onChange("accessories")}
      >
        <span>Accessories</span>
        <b>{accessoriesCount}</b>
      </button>
    </div>
  );
}

function ProductTable({
  products,
  onPreview,
}: {
  products: Product[];
  onPreview: (product: Product) => void;
}) {
  if (!products.length)
    return (
      <div className="admin-empty">
        <Package size={30} />
        <b>No products found</b>
        <p>Try another search or create a product.</p>
      </div>
    );
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Category</th>
            <th>Price</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>
                {product.image ? (
                  <img
                    className="admin-product-swatch"
                    src={product.image}
                    alt={`${product.name} cover`}
                  />
                ) : (
                  <span
                    className={`admin-product-swatch ${product.texture}`}
                    style={{ "--swatch": product.color } as React.CSSProperties}
                  />
                )}
                <div>
                  <b>{product.name}</b>
                  <small>{product.badge || "Standard"}</small>
                </div>
              </td>
              <td>{product.category}</td>
              <td>{formatNaira(product.price)}</td>
              <td>
                <span
                  className={
                    product.active === false
                      ? "admin-status inactive"
                      : "admin-status"
                  }
                >
                  {product.active === false ? "Inactive" : "Active"}
                </span>
              </td>
              <td>
                <button
                  onClick={() => onPreview(product)}
                  aria-label={`Preview ${product.name}`}
                  title="Preview product"
                >
                  <Monitor size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminProductPreview({
  product,
  onClose,
  onEdit,
  onToggle,
  onDelete,
}: {
  product: Product;
  onClose: () => void;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const section = product.section ?? "fabric";
  return (
    <div
      className="admin-modal-backdrop admin-product-detail-backdrop"
      onClick={onClose}
    >
      <section
        className="admin-product-detail"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-preview-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header>
          <div>
            <span className="admin-detail-kicker">
              {section === "fabric"
                ? "Fabric catalogue"
                : "Accessories catalogue"}
            </span>
            <h2 id="admin-preview-title">{product.name}</h2>
            <div className="admin-detail-summary">
              <span
                className={
                  product.active === false
                    ? "admin-status inactive"
                    : "admin-status"
                }
              >
                {product.active === false ? "Inactive" : "Active"}
              </span>
              {product.badge && (
                <span className="admin-detail-badge">{product.badge}</span>
              )}
              <span>{product.category}</span>
            </div>
          </div>
          <button
            className="admin-detail-close"
            onClick={onClose}
            aria-label="Close product details"
          >
            <X />
          </button>
        </header>
        <div className="admin-detail-body">
          <AdminProductMedia product={product} />
          <div className="admin-detail-content">
            <div className="admin-detail-price">
              <small>Product price</small>
              <strong>{formatNaira(product.price)}</strong>
            </div>
            <section className="admin-detail-description">
              <h3>Description</h3>
              <p>
                {product.description?.trim() ||
                  "No product description has been added."}
              </p>
            </section>
            <dl className="admin-detail-specs">
              <div>
                <dt>Section</dt>
                <dd>{section === "fabric" ? "Fabric" : "Accessories"}</dd>
              </div>
              <div>
                <dt>Category</dt>
                <dd>{product.category}</dd>
              </div>
              <div>
                <dt>Texture style</dt>
                <dd>{product.texture || "Not specified"}</dd>
              </div>
              <div>
                <dt>Colour</dt>
                <dd>
                  <span
                    className="admin-detail-colour"
                    style={{ backgroundColor: product.color }}
                  />
                  {product.color.toUpperCase()}
                </dd>
              </div>
              <div>
                <dt>Badge</dt>
                <dd>{product.badge || "None"}</dd>
              </div>
              <div>
                <dt>Media</dt>
                <dd>
                  {product.media?.length ?? 0}{" "}
                  {(product.media?.length ?? 0) === 1 ? "item" : "items"}
                </dd>
              </div>
              <div>
                <dt>Visibility</dt>
                <dd>
                  {product.active === false
                    ? "Hidden from storefront"
                    : "Visible on storefront"}
                </dd>
              </div>
              <div>
                <dt>Product ID</dt>
                <dd className="admin-detail-id">
                  {product.id || "Not assigned"}
                </dd>
              </div>
            </dl>
            <section
              className={
                product.active === false
                  ? "admin-storefront-control hidden"
                  : "admin-storefront-control"
              }
            >
              <div>
                <span>
                  {product.active === false ? (
                    <EyeOff size={19} />
                  ) : (
                    <Eye size={19} />
                  )}
                </span>
                <div>
                  <b>Storefront visibility</b>
                  <p>
                    {product.active === false
                      ? "This product is hidden and customers cannot find or purchase it."
                      : "This product is live and available to customers on the storefront."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onToggle}>
                {product.active === false ? (
                  <>
                    <Eye size={16} /> Show on storefront
                  </>
                ) : (
                  <>
                    <EyeOff size={16} /> Hide from storefront
                  </>
                )}
              </button>
            </section>
          </div>
        </div>
        <footer className="admin-detail-footer">
          <button type="button" className="danger" onClick={onDelete}>
            <Trash2 size={16} /> Delete product
          </button>
          <div>
            <button type="button" className="primary" onClick={onEdit}>
              <Edit3 size={16} /> Edit product
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}

function AdminProductMedia({ product }: { product: Product }) {
  const [media, setMedia] = useState<Array<ProductMedia & { url: string }>>([]);
  const [selected, setSelected] = useState(0);
  useEffect(() => {
    let active = true;
    const urls: string[] = [];
    const ordered = [...(product.media ?? [])].sort((a, b) =>
      a.id === product.coverMediaId
        ? -1
        : b.id === product.coverMediaId
          ? 1
          : 0,
    );
    void Promise.all(
      ordered.map(async (item) => {
        if (item.url) return { ...item, url: item.url };
        const blob = await getProductMedia(item.id);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        urls.push(url);
        return { ...item, url };
      }),
    ).then((items) => {
      if (active)
        setMedia(
          items.filter(
            (item): item is ProductMedia & { url: string } => item !== null,
          ),
        );
    });
    return () => {
      active = false;
      urls.forEach(URL.revokeObjectURL);
    };
  }, [product.coverMediaId, product.media]);
  const current = media[selected] ?? media[0];
  return (
    <section className="admin-detail-media" aria-label="Product media">
      <div className="admin-detail-media-main">
        {current ? (
          current.type === "video" ? (
            <video src={current.url} controls playsInline />
          ) : (
            <img src={current.url} alt={`${product.name} — ${current.name}`} />
          )
        ) : (
          <div
            className={`admin-detail-media-fallback product-art ${product.texture}`}
            style={{ "--swatch": product.color } as React.CSSProperties}
          >
            <Package size={42} />
            <span>No uploaded media</span>
          </div>
        )}
        {product.badge && (
          <span className="admin-detail-media-badge">{product.badge}</span>
        )}
      </div>
      {media.length > 1 && (
        <div className="admin-detail-thumbnails">
          {media.map((item, index) => (
            <button
              key={item.id}
              type="button"
              className={index === selected ? "active" : ""}
              onClick={() => setSelected(index)}
              aria-label={`View ${item.name}`}
            >
              {item.type === "video" ? (
                <video src={item.url} muted playsInline />
              ) : (
                <img src={item.url} alt="" />
              )}
              <span>{index + 1}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
