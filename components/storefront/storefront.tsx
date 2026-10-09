"use client";
/* Product media uses browser-generated blob URLs from IndexedDB. */
/* eslint-disable @next/next/no-img-element */

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  Check,
  ChevronRight,
  Copy,
  Heart,
  House,
  Loader2,
  Menu,
  Minus,
  Package,
  Plus,
  Search,
  Share2,
  ShoppingBag,
  Sparkles,
  Tags,
  Truck,
  X,
} from "lucide-react";
import {
  defaultSiteSettings,
  defaultStorySettings,
  type CustomerFeedback,
  type SiteSettings,
  type StorySettings,
} from "@/lib/catalog-admin";
import {
  getCachedStorySettings,
  getStorySettings,
  preloadStoryMedia,
  STORY_CACHE_KEY,
} from "@/lib/story-settings-api";
import {
  getCachedSiteSettings,
  getSiteSettings,
  preloadSiteImage,
  SITE_SETTINGS_CACHE_KEY,
} from "@/lib/site-settings-api";
import { formatNaira, toProductSlug } from "@/lib/storefront";
import type { Category, Product, StorefrontView } from "@/types/storefront";
import { AppDialog } from "@/components/ui/app-dialog";
import { getProductMedia } from "@/lib/product-media";
import {
  AccountAccess,
  AccountProfileButton,
} from "@/components/storefront/account-access";
import {
  createStorefrontOrder,
  getStorefrontCategories,
  getStorefrontProducts,
} from "@/lib/catalog-api";

type CartItem = { product: Product; quantity: number };
type FavoriteActions = {
  names: Set<string>;
  toggle: (product: Product) => void;
};
type CatalogValue = {
  products: Product[];
  categories: Category[];
  loading: boolean;
};
const FavoriteContext = createContext<FavoriteActions>({
  names: new Set(),
  toggle: () => undefined,
});
const CatalogContext = createContext<CatalogValue>({
  products: [],
  categories: [],
  loading: true,
});
const SiteSettingsContext = createContext<SiteSettings>(defaultSiteSettings);
const WHATSAPP_NUMBER = "2348107050824";
const whatsappOrderUrl = (message: string) =>
  `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
const quantityStep = (product: Product) =>
  product.saleUnit === "item" || product.section === "accessories" ? 1 : 0.5;
const productSaleUnit = (product: Product) =>
  product.saleUnit ?? (product.section === "accessories" ? "item" : "trouser");
const quantityUnit = (product: Product, quantity: number) =>
  quantity === 1
    ? productSaleUnit(product)
    : productSaleUnit(product) === "trouser"
      ? "trousers"
      : "items";

function useLocalStorageState<T>(key: string, initialValue: T) {
  const [state, setState] = useState<T>(initialValue);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(key);
      // Hydration from browser storage intentionally occurs after the client mounts.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (saved) setState(JSON.parse(saved) as T);
    } catch {
      window.localStorage.removeItem(key);
    } finally {
      setReady(true);
    }
  }, [key]);

  useEffect(() => {
    if (!ready) return;
    window.localStorage.setItem(key, JSON.stringify(state));
  }, [key, ready, state]);

  return [state, setState] as const;
}

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Hisgrace Texture home">
      <span className="brand-logo" aria-hidden="true" />
    </Link>
  );
}
function Header({
  cart,
  favorites,
  openCart,
  openFavorites,
}: {
  cart: number;
  favorites: number;
  openCart: () => void;
  openFavorites: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [search, setSearch] = useState(false);
  const siteSettings = useContext(SiteSettingsContext);
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const categorySection =
    searchParams.get("section") === "accessories" ? "accessories" : "fabric";
  const links = [
    { href: "/category", label: "Fabric", section: "fabric" },
    {
      href: "/category?section=accessories",
      label: "Accessories",
      section: "accessories",
    },
    { href: "/about", label: "Our story" },
    { href: "/contact", label: "Contact" },
  ];
  return (
    <>
      <div className="announcement">
        <span className="announcement-track">
          <Sparkles size={14} />
          <span>{siteSettings.announcement}</span>
        </span>
      </div>
      <header className="header">
        <Brand />
        <nav className={menu ? "nav open" : "nav"} aria-label="Main navigation">
          {links.map((link) => {
            const active = link.section
              ? pathname === "/category" && categorySection === link.section
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={active ? "active" : ""}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenu(false)}
              >
                {link.label}
              </Link>
            );
          })}
          <AccountProfileButton />
        </nav>
        <div className="header-actions">
          <button aria-label="Search" onClick={() => setSearch((v) => !v)}>
            <Search size={20} />
          </button>
          <button aria-label="View favourites" onClick={openFavorites}>
            <Heart size={20} />
            {favorites > 0 && <span className="cart-count">{favorites}</span>}
          </button>
          <button aria-label="Open shopping bag" onClick={openCart}>
            <ShoppingBag size={20} />
            {cart > 0 && <span className="cart-count">{cart}</span>}
          </button>
          <button
            className="menu-button"
            aria-label="Toggle menu"
            onClick={() => setMenu((v) => !v)}
          >
            {menu ? <X /> : <Menu />}
          </button>
        </div>
        {search && (
          <form className="search-panel" action="/products">
            <Search size={19} />
            <input
              name="q"
              autoFocus
              placeholder="Search linen, lace, velvet…"
            />
            <button>Search</button>
          </form>
        )}
      </header>
    </>
  );
}
function Footer() {
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("Adjacent to LAUTECH College of Health Sciences, Ogbomoso, Oyo State, Nigeria")}`;
  return (
    <footer>
      <div className="footer-main">
        <div>
          <Brand />
          <p>
            Remarkable fabric, thoughtfully sourced for the clothes and spaces
            that mean the most.
          </p>
          <a
            className="footer-location"
            href={mapUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Adjacent to LAUTECH College of Health Sciences, Ogbomoso, Oyo State
          </a>
          <span className="footer-hours">Mon–Sat, 9:00am–6:30pm</span>
        </div>
        <div>
          <b>Shop</b>
          <Link href="/products">All fabrics</Link>
          <Link href="/category">Collections</Link>
          <Link href="/products?filter=new">New arrivals</Link>
        </div>
        <div>
          <b>Help</b>
          <Link href="/contact#contact-details">Contact us</Link>
          <Link href="/contact#delivery">Delivery</Link>
          <Link href="/contact#fabric-care">Fabric care</Link>
        </div>
        <div>
          <b>Account</b>
          <AccountAccess />
        </div>
        <div>
          <b>Stay in the weave</b>
          <p>New drops, fabric notes and studio stories.</p>
          <form className="newsletter">
            <input
              type="email"
              aria-label="Email address"
              placeholder="Email address"
            />
            <button>Join</button>
          </form>
        </div>
      </div>
      <div className="footer-bottom">
        <span>© 2026 HSG Texture</span>
        <span>Designed for makers everywhere.</span>
      </div>
    </footer>
  );
}
function ProductMediaView({
  product,
  all = false,
}: {
  product: Product;
  all?: boolean;
}) {
  const [urls, setUrls] = useState<
    { id: string; url: string; type: "image" | "video" }[]
  >([]);
  useEffect(() => {
    let active = true;
    const created: string[] = [];
    const mediaItems = all
      ? (product.media ?? [])
      : (product.media?.slice(0, 1) ?? []);
    void Promise.all(
      mediaItems.map(async (media) => {
        if (media.url)
          return { id: media.id, url: media.url, type: media.type };
        const blob = await getProductMedia(media.id);
        if (!blob) return null;
        const url = URL.createObjectURL(blob);
        created.push(url);
        return { id: media.id, url, type: media.type };
      }),
    ).then((items) => {
      if (active)
        setUrls(
          items.filter(
            (
              item,
            ): item is { id: string; url: string; type: "image" | "video" } =>
              item !== null,
          ),
        );
    });
    return () => {
      active = false;
      created.forEach(URL.revokeObjectURL);
    };
  }, [all, product.media]);
  if (!urls.length && product.image)
    return (
      <span className="product-media-cover">
        <img src={product.image} alt={product.name} />
      </span>
    );
  if (!urls.length) return null;
  if (all)
    return (
      <div className="product-media-gallery">
        {urls.map((media, index) => (
          <div className={index === 0 ? "main" : ""} key={media.id}>
            {media.type === "video" ? (
              <video src={media.url} controls playsInline />
            ) : (
              <img src={media.url} alt={`${product.name} view ${index + 1}`} />
            )}
          </div>
        ))}
      </div>
    );
  const media = urls[0];
  return (
    <span className="product-media-cover">
      {media.type === "video" ? (
        <video src={media.url} muted loop playsInline autoPlay />
      ) : (
        <img src={media.url} alt="" />
      )}
    </span>
  );
}
function StorefrontBottomNav({
  pathname,
  categorySection,
  cart,
  favorites,
  openCart,
  openFavorites,
}: {
  pathname: string;
  categorySection: "fabric" | "accessories";
  cart: number;
  favorites: number;
  openCart: () => void;
  openFavorites: () => void;
}) {
  const links = [
    { href: "/", label: "Home", Icon: House, active: pathname === "/" },
    {
      href: "/products",
      label: "Fabric",
      Icon: Package,
      active:
        pathname === "/products" ||
        (pathname === "/category" && categorySection === "fabric"),
    },
    {
      href: "/category?section=accessories",
      label: "Accessories",
      Icon: Tags,
      active: pathname === "/category" && categorySection === "accessories",
    },
  ];

  return (
    <nav className="storefront-bottom-nav" aria-label="Store navigation">
      {links.map(({ href, label, Icon, active }) => (
        <Link
          key={label}
          href={href}
          className={active ? "active" : ""}
          aria-current={active ? "page" : undefined}
        >
          <Icon size={21} strokeWidth={1.8} />
          <span>{label}</span>
        </Link>
      ))}
      <button
        type="button"
        onClick={openFavorites}
        aria-label="Open favourites"
      >
        <span className="storefront-bottom-icon">
          <Heart size={21} strokeWidth={1.8} />
          {favorites > 0 && (
            <span className="storefront-bottom-count">{favorites}</span>
          )}
        </span>
        <span>Favourites</span>
      </button>
      <button type="button" onClick={openCart} aria-label="Open cart">
        <span className="storefront-bottom-icon">
          <ShoppingBag size={21} strokeWidth={1.8} />
          {cart > 0 && <span className="storefront-bottom-count">{cart}</span>}
        </span>
        <span>Cart</span>
      </button>
    </nav>
  );
}
function ProductCard({
  product,
  add,
}: {
  product: Product;
  add: (product: Product) => void;
}) {
  const favorites = useContext(FavoriteContext);
  const saved = favorites.names.has(product.name);
  const unit = productSaleUnit(product);
  return (
    <article className="product-card">
      <Link
        href={`/product?slug=${encodeURIComponent(toProductSlug(product.name))}`}
        className={`product-art ${product.texture}`}
        style={{ "--swatch": product.color } as React.CSSProperties}
      >
        <ProductMediaView product={product} />
        {product.badge && <span className="badge">{product.badge}</span>}
        <span className="fabric-roll one" />
        <span className="fabric-roll two" />
        <span className="fabric-fold" />
      </Link>
      <div className="product-info">
        <div>
          <p>{product.category}</p>
          <Link
            href={`/product?slug=${encodeURIComponent(toProductSlug(product.name))}`}
          >
            <h3>{product.name}</h3>
          </Link>
          <strong>
            {formatNaira(product.price)} <small>/ {unit}</small>
          </strong>
        </div>
        <div className="product-actions">
          <button
            className={saved ? "favorite active" : "favorite"}
            aria-label={`${saved ? "Remove" : "Add"} ${product.name} ${saved ? "from" : "to"} favourites`}
            aria-pressed={saved}
            onClick={() => favorites.toggle(product)}
          >
            <Heart size={18} fill={saved ? "currentColor" : "none"} />
          </button>
          <button
            aria-label={`Add ${product.name} to bag`}
            onClick={() => add(product)}
          >
            <ShoppingBag size={18} />
          </button>
        </div>
      </div>
    </article>
  );
}
function CartDrawer({
  open,
  close,
  items,
  update,
  clear,
}: {
  open: boolean;
  close: () => void;
  items: CartItem[];
  update: (name: string, quantity: number) => void;
  clear: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutPending, setCheckoutPending] = useState(false);
  const checkoutInProgress = useRef(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [whatsappFollowUpUrl, setWhatsappFollowUpUrl] = useState("");
  const [savedOrderId, setSavedOrderId] = useState("");
  const count = items.length;
  const total = items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0,
  );
  const cartMessage = [
    "Take a look at my HSG Texture bag:",
    "",
    ...items.map(
      ({ product, quantity }, index) =>
        `${index + 1}. ${product.name} — ${quantity} ${quantityUnit(product, quantity)} × ${formatNaira(product.price)} = ${formatNaira(product.price * quantity)}`,
    ),
    "",
    `Bag total: ${formatNaira(total)}`,
  ].join("\n");
  const orderMessage = [
    "Hello HSG Texture, I would like to place this order:",
    "",
    ...items.map(
      ({ product, quantity }, index) =>
        `${index + 1}. ${product.name} — ${quantity} ${quantityUnit(product, quantity)} × ${formatNaira(product.price)} = ${formatNaira(product.price * quantity)}`,
    ),
    "",
    `Order total: ${formatNaira(total)}`,
    "Please confirm availability and delivery details.",
  ].join("\n");
  const shareUrl = () => window.location.origin;
  const copyCart = async () => {
    await navigator.clipboard.writeText(`${cartMessage}\n${shareUrl()}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const shareInstagram = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "My HSG Texture bag",
          text: cartMessage,
          url: shareUrl(),
        });
        return;
      }
      await copyCart();
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
    }
  };
  const closeDrawer = () => {
    if (checkoutInProgress.current) return;
    setShareOpen(false);
    setCheckoutOpen(false);
    setCheckoutError("");
    setWhatsappFollowUpUrl("");
    setSavedOrderId("");
    close();
  };
  const placeOrder = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (checkoutInProgress.current || !items.length) return;

    const form = new FormData(event.currentTarget);
    const customerName = String(form.get("customerName") ?? "").trim();
    const phone = String(form.get("phone") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const deliveryAddress = String(form.get("deliveryAddress") ?? "").trim();
    const orderItems = items.map(({ product, quantity }) =>
      typeof product.id === "string"
        ? { productId: product.id, quantity }
        : null,
    );
    if (orderItems.some((item) => item === null)) {
      setCheckoutError(
        "One or more bag items are not connected to the live catalogue. Refresh the page and try again.",
      );
      return;
    }
    const validOrderItems = orderItems.filter(
      (item): item is { productId: string; quantity: number } => item !== null,
    );

    const whatsappWindow = window.open("", "_blank");
    checkoutInProgress.current = true;
    setCheckoutError("");
    setCheckoutPending(true);
    try {
      const order = await createStorefrontOrder({
        customerName,
        phone,
        ...(email ? { email } : {}),
        deliveryAddress,
        items: validOrderItems,
      });
      const customerMessage = [
        orderMessage,
        "",
        `Order reference: ${order.id}`,
        `Name: ${customerName}`,
        `Phone: ${phone}`,
        ...(email ? [`Email: ${email}`] : []),
        `Delivery address: ${deliveryAddress}`,
      ].join("\n");
      const whatsappUrl = whatsappOrderUrl(customerMessage);
      clear();
      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
        setCheckoutOpen(false);
        setWhatsappFollowUpUrl("");
        setSavedOrderId("");
        close();
      } else {
        setSavedOrderId(order.id);
        setWhatsappFollowUpUrl(whatsappUrl);
      }
    } catch (cause) {
      whatsappWindow?.close();
      setCheckoutError(
        cause instanceof Error
          ? cause.message
          : "The order could not be saved. Please try again.",
      );
    } finally {
      checkoutInProgress.current = false;
      setCheckoutPending(false);
    }
  };

  return (
    <div
      className={open ? "cart-overlay show" : "cart-overlay"}
      onClick={closeDrawer}
    >
      <aside onClick={(e) => e.stopPropagation()} aria-label="Shopping cart">
        <div className="cart-title">
          <div>
            <h2>Your bag</h2>
            {count > 0 && (
              <small>
                {count} {count === 1 ? "item" : "items"}
              </small>
            )}
          </div>
          <button onClick={closeDrawer} aria-label="Close bag">
            <X />
          </button>
        </div>
        {savedOrderId && whatsappFollowUpUrl ? (
          <div className="checkout-confirmation" role="status">
            <Check size={34} />
            <h3>Your order is recorded</h3>
            <p>
              Reference <b>{savedOrderId}</b>. Continue to WhatsApp to confirm
              availability and delivery.
            </p>
            <a
              className="primary full whatsapp-order"
              href={whatsappFollowUpUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Continue to WhatsApp
            </a>
          </div>
        ) : checkoutOpen ? (
          <form className="checkout-details" onSubmit={placeOrder}>
            <button
              className="checkout-back"
              type="button"
              onClick={() => setCheckoutOpen(false)}
              disabled={checkoutPending}
            >
              Back to bag
            </button>
            <h3>Delivery details</h3>
            <p>
              We’ll save your order, then continue to WhatsApp to confirm
              availability and delivery.
            </p>
            <label>
              Full name
              <input
                name="customerName"
                autoComplete="name"
                required
                disabled={checkoutPending}
              />
            </label>
            <label>
              Phone number
              <input
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder="+2348012345678 or 08012345678"
                pattern={"(?:\\+234[789][01][0-9]{8}|0[789][01][0-9]{8})"}
                title="Enter a Nigerian phone number, for example +2348012345678 or 08012345678"
                required
                disabled={checkoutPending}
              />
            </label>
            <label>
              Email (optional)
              <input
                name="email"
                type="email"
                autoComplete="email"
                disabled={checkoutPending}
              />
            </label>
            <label>
              Delivery address
              <textarea
                name="deliveryAddress"
                autoComplete="street-address"
                rows={3}
                required
                disabled={checkoutPending}
              />
            </label>
            {checkoutError && (
              <p className="checkout-error" role="alert">
                {checkoutError}
              </p>
            )}
            <button
              className="primary full whatsapp-order"
              type="submit"
              disabled={checkoutPending}
            >
              {checkoutPending ? (
                <>
                  <Loader2 size={17} className="admin-activity-spinner" />{" "}
                  Saving order…
                </>
              ) : (
                "Save order and continue"
              )}
            </button>
          </form>
        ) : items.length ? (
          <>
            <div className="cart-items">
              {items.map(({ product, quantity }) => (
                <div className="cart-item" key={product.name}>
                  <span
                    className={`mini-swatch ${product.texture}`}
                    style={{ "--swatch": product.color } as React.CSSProperties}
                  />
                  <div>
                    <b>{product.name}</b>
                    <p>
                      {formatNaira(product.price)} / {productSaleUnit(product)}
                    </p>
                    <div className="qty">
                      <button
                        onClick={() =>
                          update(product.name, quantity - quantityStep(product))
                        }
                        aria-label={`Reduce ${product.name} by ${quantityStep(product)} ${quantityUnit(product, quantityStep(product))}`}
                      >
                        <Minus size={14} />
                      </button>
                      <span>{quantity}</span>
                      <button
                        onClick={() =>
                          update(product.name, quantity + quantityStep(product))
                        }
                        aria-label={`Add ${quantityStep(product)} ${quantityUnit(product, quantityStep(product))} of ${product.name}`}
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        className="remove-item"
                        onClick={() => update(product.name, 0)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="cart-total">
              <span>Estimated total</span>
              <b>{formatNaira(total)}</b>
            </div>
            <div className="cart-actions">
              <button
                className="primary full whatsapp-order"
                type="button"
                onClick={() => {
                  setCheckoutError("");
                  setCheckoutOpen(true);
                }}
              >
                Continue to checkout
              </button>
              <button
                className="cart-share-button"
                type="button"
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} /> Share this bag
              </button>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <ShoppingBag size={36} />
            <h3>Your bag is empty</h3>
            <p>Start with a texture that speaks to you.</p>
            <Link href="/products" className="primary" onClick={closeDrawer}>
              Browse fabrics
            </Link>
          </div>
        )}
      </aside>
      {shareOpen && (
        <div
          className="share-modal-backdrop"
          onClick={() => setShareOpen(false)}
        >
          <section
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-cart-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="share-modal-close"
              onClick={() => setShareOpen(false)}
              aria-label="Close share options"
            >
              <X size={20} />
            </button>
            <span className="share-modal-icon">
              <Share2 size={22} />
            </span>
            <h3 id="share-cart-title">Share your bag</h3>
            <p>
              Send these {count} {count === 1 ? "item" : "items"} to a friend.
            </p>
            <div className="share-options">
              <a
                className="share-option whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(`${cartMessage}\n${shareUrl()}`)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>W</span>
                <b>WhatsApp</b>
                <small>Send to a chat</small>
              </a>
              <a
                className="share-option facebook"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}&quote=${encodeURIComponent(cartMessage)}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>f</span>
                <b>Facebook</b>
                <small>Share with friends</small>
              </a>
              <button
                className="share-option instagram"
                onClick={shareInstagram}
              >
                <span>◎</span>
                <b>Instagram</b>
                <small>Share or copy</small>
              </button>
            </div>
            <button className="copy-cart-button" onClick={copyCart}>
              {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
              {copied ? "Cart copied" : "Copy cart details"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function ProductGridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div
      className="product-grid product-grid-skeleton"
      aria-label="Loading products"
      aria-busy="true"
    >
      {Array.from({ length: count }, (_, index) => (
        <article className="product-skeleton" key={index} aria-hidden="true">
          <span className="skeleton-block skeleton-product-art" />
          <span className="skeleton-block skeleton-kicker" />
          <span className="skeleton-block skeleton-title" />
          <span className="skeleton-block skeleton-price" />
        </article>
      ))}
    </div>
  );
}

function CategoryRail({
  products,
  loading,
}: {
  products: Product[];
  loading: boolean;
}) {
  if (loading)
    return (
      <div
        className="category-rail-skeleton"
        aria-label="Loading new products"
        aria-busy="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <span className="skeleton-block" key={index} aria-hidden="true" />
        ))}
      </div>
    );
  const latestProducts = products.slice(0, 10);
  if (!latestProducts.length)
    return <p className="categories-empty">New products are coming soon.</p>;
  return (
    <div
      className="category-rail recent-product-rail"
      aria-label="Recently uploaded products"
    >
      <div className="category-track recent-product-track">
        {latestProducts.map((product, index) => (
          <Link
            href={`/product?slug=${encodeURIComponent(toProductSlug(product.name))}`}
            key={product.id ?? product.name}
            className={`category-card recent-product-card c${index % 4}`}
            style={{ "--swatch": product.color } as React.CSSProperties}
          >
            <ProductMediaView product={product} />
            <span className="category-text">
              <small>{product.category}</small>
              <b>{product.name}</b>
              <p>
                {formatNaira(product.price)} / {productSaleUnit(product)}
              </p>
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

function HomeView({ add }: { add: () => void }) {
  const { products, categories, loading } = useContext(CatalogContext);
  const siteSettings = useContext(SiteSettingsContext);
  const featuredCategories = categories
    .filter((category) => (category.section ?? "fabric") === "fabric")
    .map((category) => category.name);
  return (
    <main>
      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">{siteSettings.heroEyebrow}</p>
          <h1>
            {siteSettings.heroTitle}
            <br />
            <em>{siteSettings.heroAccent}</em>
          </h1>
          <p>{siteSettings.heroDescription}</p>
          <div className="hero-buttons">
            <Link href={siteSettings.primaryHref} className="primary">
              {siteSettings.primaryLabel}
            </Link>
            <Link href={siteSettings.secondaryHref} className="text-link">
              {siteSettings.secondaryLabel} <ChevronRight size={16} />
            </Link>
          </div>
          <div className="hero-trust">
            <span>
              <Truck size={17} /> {siteSettings.trustOne}
            </span>
            <span>
              <Sparkles size={17} /> {siteSettings.trustTwo}
            </span>
          </div>
        </div>
        <div
          className="hero-image"
          role="img"
          aria-label="Blue, gold, ivory and patterned fabrics"
          style={
            siteSettings.heroImageUrl
              ? { backgroundImage: `url(${siteSettings.heroImageUrl})` }
              : undefined
          }
        >
          <span className="image-note">
            <i /> {siteSettings.imageNote}
          </span>
        </div>
      </section>
      <section className="category-section">
        <SectionTitle
          eyebrow="Just uploaded"
          title="New to the collection"
          href="/products"
          link="View all products"
        />
        <CategoryRail products={products} loading={loading} />
      </section>
      {loading && (
        <section className="products-section home-category-section">
          <SectionTitle
            eyebrow="Featured collections"
            title="Loading the collection"
            href="/products"
            link="View all products"
          />
          <ProductGridSkeleton />
        </section>
      )}
      <div className="home-category-sections">
        {featuredCategories.map((category, index) => (
          <section
            className="products-section home-category-section"
            key={category}
          >
            <SectionTitle
              eyebrow={
                index === 0 ? "Featured collections" : "Explore the collection"
              }
              title={category}
              href="/category"
              link={`View all ${category}`}
            />
            <div className="product-grid">
              {products
                .filter((product) => product.category === category)
                .map((product) => (
                  <ProductCard key={product.name} product={product} add={add} />
                ))}
            </div>
          </section>
        ))}
      </div>
      <section className="studio-story">
        <div>
          <p className="eyebrow">The HSG standard</p>
          <h2>
            Chosen by hand.
            <br />
            Made to be remembered.
          </h2>
        </div>
        <div>
          <p>
            We look beyond colour. Every fabric in our edit is selected for its
            handle, fall, finish and the way it transforms in the hands of a
            maker.
          </p>
          <Link href="/about" className="text-link light">
            Meet HSG Texture <ChevronRight size={16} />
          </Link>
        </div>
      </section>
      <section className="service-grid">
        {[
          [
            "01",
            "Swatch-ready",
            "See and feel a fabric before committing to the required quantity.",
          ],
          [
            "02",
            "Measured with care",
            "Every cut is checked twice and packed with intention.",
          ],
          [
            "03",
            "Human guidance",
            "Tell us what you’re making; we’ll help you choose well.",
          ],
        ].map((x) => (
          <div key={x[0]}>
            <span>{x[0]}</span>
            <h3>{x[1]}</h3>
            <p>{x[2]}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
function SectionTitle({
  eyebrow,
  title,
  href,
  link,
}: {
  eyebrow: string;
  title: string;
  href: string;
  link: string;
}) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      <Link href={href}>
        {link} <ChevronRight size={16} />
      </Link>
    </div>
  );
}
function PriceFilter({
  minPrice,
  maxPrice,
  onMinPriceChange,
  onMaxPriceChange,
}: {
  minPrice: string;
  maxPrice: string;
  onMinPriceChange: (value: string) => void;
  onMaxPriceChange: (value: string) => void;
}) {
  const rangeMax = 100000;
  const [draftMin, setDraftMin] = useState(Number(minPrice) || 0);
  const [draftMax, setDraftMax] = useState(Number(maxPrice) || rangeMax);
  const minPercent = (draftMin / rangeMax) * 100;
  const maxPercent = (draftMax / rangeMax) * 100;
  const apply = () => {
    onMinPriceChange(draftMin === 0 ? "" : String(draftMin));
    onMaxPriceChange(draftMax === rangeMax ? "" : String(draftMax));
  };
  return (
    <fieldset
      className="price-filter"
      style={
        {
          "--range-start": `${minPercent}%`,
          "--range-end": `${maxPercent}%`,
        } as React.CSSProperties
      }
    >
      <legend>Price range</legend>
      <div className="price-values">
        <label>
          <span>Min</span>
          <span className="price-input">
            <b>₦</b>
            <input
              aria-label="Minimum price"
              type="number"
              min="0"
              max={draftMax - 500}
              step="500"
              inputMode="numeric"
              value={draftMin}
              onChange={(event) =>
                setDraftMin(
                  Math.min(Number(event.target.value) || 0, draftMax - 500),
                )
              }
            />
          </span>
        </label>
        <i aria-hidden="true" />
        <label>
          <span>Max</span>
          <span className="price-input">
            <b>₦</b>
            <input
              aria-label="Maximum price"
              type="number"
              min={draftMin + 500}
              max={rangeMax}
              step="500"
              inputMode="numeric"
              value={draftMax}
              onChange={(event) =>
                setDraftMax(
                  Math.max(
                    Number(event.target.value) || rangeMax,
                    draftMin + 500,
                  ),
                )
              }
            />
          </span>
        </label>
      </div>
      <div className="price-range-track">
        <input
          aria-label="Minimum price slider"
          type="range"
          min="0"
          max={rangeMax}
          step="500"
          value={draftMin}
          onChange={(event) =>
            setDraftMin(Math.min(Number(event.target.value), draftMax - 500))
          }
        />
        <input
          aria-label="Maximum price slider"
          type="range"
          min="0"
          max={rangeMax}
          step="500"
          value={draftMax}
          onChange={(event) =>
            setDraftMax(Math.max(Number(event.target.value), draftMin + 500))
          }
        />
      </div>
      <button type="button" onClick={apply}>
        Apply
      </button>
    </fieldset>
  );
}
function matchesPriceRange(price: number, minPrice: string, maxPrice: string) {
  const minimum = minPrice === "" ? undefined : Number(minPrice);
  const maximum = maxPrice === "" ? undefined : Number(maxPrice);
  return (
    (minimum === undefined || price >= minimum) &&
    (maximum === undefined || price <= maximum)
  );
}
function Listing({
  category = false,
  add,
}: {
  category?: boolean;
  add: (product: Product) => void;
}) {
  const { products, categories, loading } = useContext(CatalogContext);
  const searchParams = useSearchParams();
  const section =
    searchParams.get("section") === "accessories" ? "accessories" : "fabric";
  const isNewArrivals = searchParams.get("filter") === "new";
  const requestedCategory = searchParams.get("category") ?? "All";
  const [filter, setFilter] = useState(requestedCategory);
  const [accessoryFilter, setAccessoryFilter] = useState("All");
  const [fabricMinPrice, setFabricMinPrice] = useState("");
  const [fabricMaxPrice, setFabricMaxPrice] = useState("");
  const [accessoryMinPrice, setAccessoryMinPrice] = useState("");
  const [accessoryMaxPrice, setAccessoryMaxPrice] = useState("");
  const fabricProducts = useMemo(
    () =>
      products.filter((product) => (product.section ?? "fabric") === "fabric"),
    [products],
  );
  const accessoryProducts = useMemo(
    () => products.filter((product) => product.section === "accessories"),
    [products],
  );
  const shown = useMemo(
    () =>
      fabricProducts.filter(
        (product) =>
          (filter === "All" || product.category === filter) &&
          (!isNewArrivals || product.badge === "New") &&
          matchesPriceRange(product.price, fabricMinPrice, fabricMaxPrice),
      ),
    [filter, fabricMinPrice, fabricMaxPrice, isNewArrivals, fabricProducts],
  );
  const shownAccessories = useMemo(
    () =>
      accessoryProducts.filter(
        (item) =>
          (accessoryFilter === "All" || item.category === accessoryFilter) &&
          matchesPriceRange(item.price, accessoryMinPrice, accessoryMaxPrice),
      ),
    [accessoryProducts, accessoryFilter, accessoryMinPrice, accessoryMaxPrice],
  );
  const filters = [
    "All",
    ...categories
      .filter((item) => (item.section ?? "fabric") === "fabric")
      .map((item) => item.name),
  ];
  const accessoryFilters = [
    "All",
    ...categories
      .filter((item) => item.section === "accessories")
      .map((item) => item.name),
  ];

  return (
    <main>
      {!category && (
        <section className="listing-hero">
          <p className="eyebrow">
            {isNewArrivals ? "Just in" : "Shop the edit"}
          </p>
          <h1>
            {isNewArrivals ? "New arrivals" : "Fabrics worth making with"}
          </h1>
          <p>
            {isNewArrivals
              ? "Explore the latest additions to our fabric edit."
              : "Curated textiles, ready for your next idea."}
          </p>
        </section>
      )}
      {!category || section === "fabric" ? (
        <section
          id="category-products"
          className={`catalog ${category ? "category-catalog fabric-view" : ""}`}
        >
          {category && (
            <div className="fabric-filter-heading">
              <p className="eyebrow">Shop fabric</p>
              <h2>Choose your cloth</h2>
            </div>
          )}
          <div className="catalog-tools">
            <p>
              <b>{shown.length}</b>{" "}
              {isNewArrivals
                ? "new arrivals"
                : filter === "All"
                  ? "items across all fabrics"
                  : `${filter} ${shown.length === 1 ? "item" : "items"}`}
            </p>
            <div className="filters">
              {filters.map((value) => (
                <button
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <PriceFilter
            minPrice={fabricMinPrice}
            maxPrice={fabricMaxPrice}
            onMinPriceChange={setFabricMinPrice}
            onMaxPriceChange={setFabricMaxPrice}
          />
          {loading ? (
            <ProductGridSkeleton count={8} />
          ) : (
            <div className="product-grid">
              {shown.map((product) => (
                <ProductCard
                  key={product.id ?? product.name}
                  product={product}
                  add={add}
                />
              ))}
            </div>
          )}
        </section>
      ) : (
        <section className="accessories-view">
          <div className="accessories-heading">
            <p className="eyebrow">Finishing touches</p>
            <h2>Accessories for every look</h2>
            <p>
              Discover considered details to complement your fabric and complete
              your style.
            </p>
          </div>
          <div className="catalog-tools">
            <p>
              <b>{shownAccessories.length}</b>{" "}
              {accessoryFilter === "All"
                ? "accessories"
                : `${accessoryFilter} ${shownAccessories.length === 1 ? "item" : "items"}`}
            </p>
            <div className="filters">
              {accessoryFilters.map((value) => (
                <button
                  className={accessoryFilter === value ? "active" : ""}
                  onClick={() => setAccessoryFilter(value)}
                  key={value}
                >
                  {value}
                </button>
              ))}
            </div>
          </div>
          <PriceFilter
            minPrice={accessoryMinPrice}
            maxPrice={accessoryMaxPrice}
            onMinPriceChange={setAccessoryMinPrice}
            onMaxPriceChange={setAccessoryMaxPrice}
          />
          {loading ? (
            <ProductGridSkeleton count={6} />
          ) : shownAccessories.length > 0 ? (
            <div className="lifestyle-grid">
              {shownAccessories.map((item, index) => (
                <article
                  className={`lifestyle-card ${item.texture}`}
                  key={item.id ?? item.name}
                >
                  <span className="lifestyle-number">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <Link
                    href={`/product?slug=${encodeURIComponent(toProductSlug(item.name))}`}
                    className="lifestyle-art"
                    aria-label={`View ${item.name}`}
                  >
                    <span aria-hidden="true">
                      {item.texture === "fragrance" ||
                      item.texture === "perfume-oil"
                        ? "✦"
                        : item.texture === "body-spray"
                          ? "◒"
                          : item.texture === "ofi"
                            ? "◇"
                            : "◆"}
                    </span>
                  </Link>
                  <div>
                    <small>{item.category}</small>
                    <Link
                      href={`/product?slug=${encodeURIComponent(toProductSlug(item.name))}`}
                    >
                      <h3>{item.name}</h3>
                    </Link>
                    <p>
                      {item.description ??
                        "A considered finishing touch for a complete look."}
                    </p>
                    <p className="lifestyle-price">{formatNaira(item.price)}</p>
                    <button className="accessory-add" onClick={() => add(item)}>
                      <ShoppingBag size={15} /> Add to bag
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="accessories-empty" role="status">
              No items match those filters.
            </p>
          )}
        </section>
      )}
    </main>
  );
}
function ProductShare({ product }: { product: Product }) {
  const [notice, setNotice] = useState("");
  const shareDetails = () => {
    const url = window.location.href;
    return {
      url,
      text: `Take a look at ${product.name} from HSG Texture — ${formatNaira(product.price)} per ${productSaleUnit(product)}.`,
    };
  };
  const shareWhatsApp = () => {
    const { url, text } = shareDetails();
    window.open(
      `https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const shareFacebook = () => {
    const { url } = shareDetails();
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
      "_blank",
      "noopener,noreferrer",
    );
  };
  const shareInstagram = async () => {
    const { url, text } = shareDetails();
    try {
      if (navigator.share) {
        await navigator.share({ title: product.name, text, url });
        setNotice("Choose Instagram from the share menu.");
        return;
      }
      await navigator.clipboard.writeText(url);
      setNotice("Product link copied. Paste it into Instagram.");
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setNotice(
        "Sharing is unavailable in this browser. Open Instagram and share this page directly.",
      );
    }
  };
  return (
    <div className="product-share">
      <span>Share this item</span>
      <div>
        <button className="share-whatsapp" onClick={shareWhatsApp}>
          WhatsApp
        </button>
        <button className="share-facebook" onClick={shareFacebook}>
          Facebook
        </button>
        <button className="share-instagram" onClick={shareInstagram}>
          Instagram
        </button>
      </div>
      {notice && <small role="status">{notice}</small>}
    </div>
  );
}
function ProductDetail({
  slug,
  add,
}: {
  slug: string;
  add: (quantity: number) => void;
}) {
  const [quantity, setQuantity] = useState(1);
  const { products, loading } = useContext(CatalogContext);
  const product = products.find((item) => toProductSlug(item.name) === slug);
  if (loading && !product)
    return (
      <main
        className="product-detail product-detail-skeleton"
        aria-label="Loading product"
        aria-busy="true"
      >
        <div className="skeleton-block skeleton-detail-media" />
        <div className="skeleton-detail-copy">
          <span className="skeleton-block skeleton-kicker" />
          <span className="skeleton-block skeleton-detail-title" />
          <span className="skeleton-block skeleton-price" />
          <span className="skeleton-block skeleton-detail-line" />
          <span className="skeleton-block skeleton-detail-line short" />
        </div>
      </main>
    );
  if (!product)
    return (
      <main className="missing-product">
        <p className="eyebrow">Product not found</p>
        <h1>This item is no longer in the edit.</h1>
        <Link href="/products" className="primary">
          Return to all products
        </Link>
      </main>
    );
  const isAccessory = product.section === "accessories";
  const step = quantityStep(product);
  const unit = productSaleUnit(product);
  const orderMessage = `Hello HSG Texture, I would like to order:\n\n${product.name}\nCategory: ${product.category}\nQuantity: ${quantity} ${quantity === 1 ? unit : `${unit}s`}\nPrice per ${unit}: ${formatNaira(product.price)}\nTotal: ${formatNaira(product.price * quantity)}\n\nPlease confirm availability and delivery details.`;
  const bulkMessage = `Hello HSG Texture, I am interested in buying ${product.name} in a large quantity. Please tell me about your bulk-order discount and minimum quantity.`;
  return (
    <main className="product-detail">
      <nav className="breadcrumbs" aria-label="Breadcrumb">
        <Link href="/">Home</Link>
        <span>/</span>
        <Link
          href={isAccessory ? "/category?section=accessories" : "/products"}
        >
          {isAccessory ? "Accessories" : "Products"}
        </Link>
        <span>/</span>
        <b>{product.name}</b>
      </nav>
      <section className="product-detail-grid">
        <div
          className={`product-detail-art product-art ${product.texture}`}
          style={{ "--swatch": product.color } as React.CSSProperties}
        >
          {product.badge && <span className="badge">{product.badge}</span>}
          {product.media?.length || product.image ? (
            <ProductMediaView product={product} all />
          ) : (
            <>
              <span className="fabric-roll one" />
              <span className="fabric-roll two" />
              <span className="fabric-fold" />
            </>
          )}
        </div>
        <div className="product-detail-copy">
          <p className="eyebrow">{product.category} collection</p>
          <h1>{product.name}</h1>
          <div className="detail-price">
            {formatNaira(product.price)} <small>per {unit}</small>
          </div>
          <p className="detail-intro">
            {product.description ??
              (isAccessory
                ? "A considered finishing touch selected to complete your look with character."
                : "A carefully selected fabric with a beautiful hand, assured structure and an elegant finish. Designed to cut cleanly and drape with confidence for considered everyday and occasion wear.")}
          </p>
          {(product.composition ||
            product.width ||
            product.feel ||
            product.care) && (
            <dl className="fabric-specs">
              {product.composition && (
                <div>
                  <dt>Composition</dt>
                  <dd>{product.composition}</dd>
                </div>
              )}
              {product.width && (
                <div>
                  <dt>Width</dt>
                  <dd>{product.width}</dd>
                </div>
              )}
              {product.feel && (
                <div>
                  <dt>Feel</dt>
                  <dd>{product.feel}</dd>
                </div>
              )}
              {product.care && (
                <div>
                  <dt>Care</dt>
                  <dd>{product.care}</dd>
                </div>
              )}
            </dl>
          )}
          <div className="trouser-selector">
            <span>Quantity in {quantity === 1 ? unit : `${unit}s`}</span>
            <div>
              <button
                onClick={() => setQuantity((q) => Math.max(step, q - step))}
                aria-label="Reduce quantity"
              >
                <Minus size={16} />
              </button>
              <b>{quantity}</b>
              <button
                onClick={() => setQuantity((q) => q + step)}
                aria-label="Increase quantity"
              >
                <Plus size={16} />
              </button>
            </div>
          </div>
          <div className="detail-order-actions">
            <button
              className="primary detail-add"
              onClick={() => add(quantity)}
            >
              <ShoppingBag size={18} /> Add {quantity}{" "}
              {quantity === 1 ? unit : `${unit}s`} to bag ·{" "}
              {formatNaira(product.price * quantity)}
            </button>
            <a
              className="whatsapp-order-direct"
              href={whatsappOrderUrl(orderMessage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Order now on WhatsApp
            </a>
          </div>
          <div className="bulk-order-callout">
            <div>
              <b>Buying a large quantity?</b>
              <p>Reach out to us for a special bulk-order discount.</p>
            </div>
            <a
              href={whatsappOrderUrl(bulkMessage)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask about discounts <ChevronRight size={15} />
            </a>
          </div>
          <ProductShare product={product} />
          <div className="detail-notes">
            <span>
              <Truck size={18} />
              <b>Nationwide delivery</b>
              <small>Carefully packed and tracked</small>
            </span>
            <span>
              <Sparkles size={18} />
              <b>Quality checked</b>
              <small>Inspected before dispatch</small>
            </span>
          </div>
        </div>
      </section>
      <section className="related-products">
        <SectionTitle
          eyebrow="You may also like"
          title={
            isAccessory ? "More finishing touches" : "More from the fabric room"
          }
          href={isAccessory ? "/category?section=accessories" : "/products"}
          link="View all products"
        />
        <div className="product-grid">
          {products
            .filter(
              (item) =>
                item.name !== product.name &&
                (item.section ?? "fabric") === (product.section ?? "fabric"),
            )
            .slice(0, 4)
            .map((item) => (
              <ProductCard
                key={item.id ?? item.name}
                product={item}
                add={() => add(1)}
              />
            ))}
        </div>
      </section>
    </main>
  );
}
function About() {
  const [story, setStory] = useState<StorySettings>(defaultStorySettings);
  useEffect(() => {
    let mounted = true;
    let latest = 0;
    const commit = async (next: StorySettings, request: number) => {
      const ready = await preloadStoryMedia(next);
      if (mounted && ready && request === latest) setStory(next);
    };
    const refresh = async () => {
      const request = ++latest;
      try {
        await commit(await getStorySettings(), request);
      } catch {}
    };
    const initialize = async () => {
      const request = ++latest;
      await commit(getCachedStorySettings(), request);
      if (mounted && request === latest) await refresh();
    };
    const syncCached = (event: StorageEvent) => {
      if (event.key === STORY_CACHE_KEY) {
        const request = ++latest;
        void commit(getCachedStorySettings(), request);
      }
    };
    void initialize();
    window.addEventListener("storage", syncCached);
    window.addEventListener("hsg-story-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("storage", syncCached);
      window.removeEventListener("hsg-story-updated", refresh);
    };
  }, []);
  const visibleFeedback = story.feedback.filter((item) => item.active);
  return (
    <main>
      <section className="about-hero">
        <div>
          <p className="eyebrow">{story.eyebrow}</p>
          <h1>{story.title}</h1>
        </div>
        <div className="about-collage">
          {[0, 1, 2].map((index) => (
            <AboutMedia
              key={index}
              id={story.collageMediaIds[index]}
              url={story.collageMedia?.[index]?.url}
              alt={`HSG Texture story ${index + 1}`}
            />
          ))}
        </div>
      </section>
      <section className="about-copy">
        <p className="big-copy">{story.intro}</p>
        <div>
          <p>{story.paragraphOne}</p>
          <p>{story.paragraphTwo}</p>
        </div>
      </section>
      <section className="values">
        <p className="eyebrow">{story.valuesEyebrow}</p>
        <div>
          {story.values.map((value) => (
            <article key={value.id}>
              <b>{value.number}</b>
              <h3>{value.title}</h3>
              <p>{value.description}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="customer-stories">
        <div className="customer-stories-heading">
          <p className="eyebrow">{story.feedbackEyebrow}</p>
          <h2>{story.feedbackTitle}</h2>
          <p>{story.feedbackIntro}</p>
        </div>
        {visibleFeedback.length ? (
          <div className="customer-stories-grid">
            {visibleFeedback.map((item) => (
              <article
                key={item.id}
                className={
                  item.mediaId || item.mediaUrl ? "has-media" : "text-only"
                }
              >
                {(item.mediaId || item.mediaUrl) && (
                  <AboutFeedbackMedia feedback={item} />
                )}
                <div>
                  <span className="customer-quote">“</span>
                  <blockquote>{item.quote}</blockquote>
                  <b>{item.customerName}</b>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="customer-stories-empty">
            <Sparkles size={22} />
            <p>Customer stories are coming soon.</p>
          </div>
        )}
      </section>
    </main>
  );
}

function AboutMedia({
  id,
  url: remoteUrl,
  alt,
}: {
  id?: string;
  url?: string;
  alt: string;
}) {
  const [url, setUrl] = useState(remoteUrl ?? "");
  useEffect(() => {
    let active = true;
    let created = "";
    if (remoteUrl) queueMicrotask(() => active && setUrl(remoteUrl));
    else if (id)
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
  }, [id, remoteUrl]);
  return url ? (
    <span
      style={{ backgroundImage: `url(${url})` }}
      role="img"
      aria-label={alt}
    />
  ) : (
    <span />
  );
}
function AboutFeedbackMedia({ feedback }: { feedback: CustomerFeedback }) {
  const [url, setUrl] = useState(feedback.mediaUrl ?? "");
  useEffect(() => {
    let active = true;
    let created = "";
    if (feedback.mediaUrl)
      queueMicrotask(() => active && setUrl(feedback.mediaUrl ?? ""));
    else if (feedback.mediaId)
      void getProductMedia(feedback.mediaId).then((blob) => {
        if (blob && active) {
          created = URL.createObjectURL(blob);
          setUrl(created);
        }
      });
    return () => {
      active = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [feedback.mediaId, feedback.mediaUrl]);
  if (!url) return <div className="customer-media-placeholder" />;
  return feedback.mediaType === "video" ? (
    <video src={url} controls playsInline preload="metadata" />
  ) : (
    <img src={url} alt={`${feedback.customerName}'s HSG Texture feedback`} />
  );
}
function Contact() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <>
      <main className="contact-page">
        <section>
          <p className="eyebrow">Visit or write</p>
          <h1>Let’s find your fabric.</h1>
          <p>
            Share the idea, colour or occasion you have in mind. Our fabric team
            will guide you from there.
          </p>
          <div className="contact-details" id="contact-details">
            <div>
              <small>Store location</small>
              <b>
                Adjacent to LAUTECH College of Health Sciences
                <br />
                Ogbomoso, Oyo State, Nigeria
              </b>
            </div>
            <div>
              <small>Call / WhatsApp</small>
              <b>+234 810 705 0824</b>
            </div>
            <div>
              <small>Hours</small>
              <b>Monday–Saturday, 9:00am–6:30pm</b>
            </div>
          </div>
          <div className="contact-guidance">
            <article id="delivery">
              <h2>Delivery</h2>
              <p>
                Nationwide delivery is available. Delivery fees and timing
                depend on your location; contact us to confirm your options.
              </p>
            </article>
            <article id="fabric-care">
              <h2>Fabric care</h2>
              <p>
                Care needs vary by fabric. Dry cleaning is recommended for our
                current fabric edit; ask us for guidance on a specific cloth
                before cleaning.
              </p>
            </article>
          </div>
        </section>
        <form
          className="contact-form"
          onSubmit={(event) => {
            event.preventDefault();
            setSubmitted(true);
            event.currentTarget.reset();
          }}
        >
          <label>
            Name
            <input required placeholder="Your name" />
          </label>
          <label>
            Email
            <input required type="email" placeholder="you@example.com" />
          </label>
          <label>
            What are you making?
            <select>
              <option>Everyday wear</option>
              <option>Wedding or occasion</option>
              <option>Interior project</option>
              <option>Something else</option>
            </select>
          </label>
          <label>
            Tell us more
            <textarea
              rows={5}
              placeholder="Colours, quantity, date, inspiration…"
            />
          </label>
          <button className="primary">Send enquiry</button>
        </form>
      </main>
      <AppDialog
        open={submitted}
        title="Enquiry received"
        description="Thank you. The HSG Texture team will be in touch shortly."
        confirmLabel="Done"
        cancelLabel={null}
        tone="success"
        onClose={() => setSubmitted(false)}
      />
    </>
  );
}
function FavoritesDrawer({
  open,
  close,
  items,
  add,
  toggle,
}: {
  open: boolean;
  close: () => void;
  items: Product[];
  add: (product: Product) => void;
  toggle: (product: Product) => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedProduct, setAddedProduct] = useState("");
  const shareUrl = () => window.location.origin;
  const favoritesMessage = () =>
    [
      "Take a look at my HSG Texture favourites:",
      "",
      ...items.map(
        (product, index) =>
          `${index + 1}. ${product.name} — ${formatNaira(product.price)} per ${productSaleUnit(product)}\n${shareUrl()}/product?slug=${encodeURIComponent(toProductSlug(product.name))}`,
      ),
    ].join("\n");
  const copyFavorites = async () => {
    await navigator.clipboard.writeText(favoritesMessage());
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };
  const shareInstagram = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "My HSG Texture favourites",
          text: favoritesMessage(),
          url: shareUrl(),
        });
        return;
      }
      await copyFavorites();
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      window.open(
        "https://www.instagram.com/",
        "_blank",
        "noopener,noreferrer",
      );
    }
  };
  const addFavouriteToCart = (product: Product) => {
    add(product);
    setAddedProduct(product.name);
    window.setTimeout(
      () =>
        setAddedProduct((current) => (current === product.name ? "" : current)),
      2200,
    );
  };
  const closeDrawer = () => {
    setShareOpen(false);
    close();
  };

  return (
    <div
      className={open ? "cart-overlay show" : "cart-overlay"}
      onClick={closeDrawer}
    >
      <aside
        onClick={(event) => event.stopPropagation()}
        aria-label="Favourites"
      >
        <div className="cart-title">
          <div>
            <h2>Favourites</h2>
            {items.length > 0 && (
              <small>
                {items.length} saved {items.length === 1 ? "item" : "items"}
              </small>
            )}
          </div>
          <button onClick={closeDrawer} aria-label="Close favourites">
            <X />
          </button>
        </div>
        <span className="sr-only" role="status" aria-live="polite">
          {addedProduct && `${addedProduct} added to your bag.`}
        </span>
        {items.length ? (
          <>
            <div className="cart-items">
              {items.map((product) => {
                const justAdded = addedProduct === product.name;
                return (
                  <div className="cart-item" key={product.name}>
                    <span
                      className={`mini-swatch ${product.texture}`}
                      style={
                        { "--swatch": product.color } as React.CSSProperties
                      }
                    />
                    <div>
                      <Link
                        href={`/product?slug=${encodeURIComponent(toProductSlug(product.name))}`}
                        onClick={closeDrawer}
                      >
                        <b>{product.name}</b>
                      </Link>
                      <p>
                        {formatNaira(product.price)} /{" "}
                        {productSaleUnit(product)}
                      </p>
                      <div className="favorite-actions">
                        <button
                          className={justAdded ? "added" : ""}
                          onClick={() => addFavouriteToCart(product)}
                        >
                          {justAdded ? (
                            <Check size={15} />
                          ) : (
                            <ShoppingBag size={15} />
                          )}{" "}
                          {justAdded ? "Added to bag" : "Add to cart"}
                        </button>
                        <button onClick={() => toggle(product)}>Remove</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="favourites-share-action">
              <button
                className="cart-share-button"
                type="button"
                onClick={() => setShareOpen(true)}
              >
                <Share2 size={18} /> Share all favourites
              </button>
            </div>
          </>
        ) : (
          <div className="empty-cart">
            <Heart size={36} />
            <h3>No favourites yet</h3>
            <p>Save fabrics you love and find them here.</p>
            <Link href="/products" className="primary" onClick={closeDrawer}>
              Browse fabrics
            </Link>
          </div>
        )}
      </aside>
      {shareOpen && (
        <div
          className="share-modal-backdrop"
          onClick={() => setShareOpen(false)}
        >
          <section
            className="share-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="share-favourites-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="share-modal-close"
              onClick={() => setShareOpen(false)}
              aria-label="Close share options"
            >
              <X size={20} />
            </button>
            <span className="share-modal-icon">
              <Heart size={22} />
            </span>
            <h3 id="share-favourites-title">Share your favourites</h3>
            <p>
              Send all {items.length} saved{" "}
              {items.length === 1 ? "item" : "items"} to a friend.
            </p>
            <div className="share-options">
              <a
                className="share-option whatsapp"
                href={`https://wa.me/?text=${encodeURIComponent(favoritesMessage())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>W</span>
                <b>WhatsApp</b>
                <small>Send to a chat</small>
              </a>
              <a
                className="share-option facebook"
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl())}&quote=${encodeURIComponent(favoritesMessage())}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span>f</span>
                <b>Facebook</b>
                <small>Share with friends</small>
              </a>
              <button
                className="share-option instagram"
                onClick={shareInstagram}
              >
                <span>◎</span>
                <b>Instagram</b>
                <small>Share or copy</small>
              </button>
            </div>
            <button className="copy-cart-button" onClick={copyFavorites}>
              {copied ? <Check size={17} /> : <Copy size={17} />}{" "}
              {copied ? "Favourites copied" : "Copy favourite details"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
function WhatsAppButton() {
  return (
    <a
      className="whatsapp-button"
      href="https://wa.me/2348107050824?text=Hello%20HSG%20Texture%2C%20I%27d%20like%20help%20choosing%20a%20fabric."
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with HSG Texture on WhatsApp"
    >
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.04 3A12.9 12.9 0 0 0 5.03 22.62L3.2 29l6.53-1.71A12.97 12.97 0 1 0 16.04 3Zm0 23.77c-1.9 0-3.76-.5-5.38-1.44l-.39-.23-3.87 1.02 1.03-3.77-.25-.4a10.72 10.72 0 1 1 8.86 4.82Zm5.88-8.04c-.32-.16-1.9-.94-2.2-1.05-.29-.11-.5-.16-.72.16-.21.33-.82 1.05-1 1.27-.19.21-.38.24-.7.08-.32-.16-1.36-.5-2.59-1.6a9.68 9.68 0 0 1-1.79-2.23c-.19-.32-.02-.5.14-.66.15-.14.33-.37.49-.56.16-.19.21-.32.32-.54.11-.21.05-.4-.03-.56-.08-.16-.72-1.73-.98-2.37-.26-.62-.52-.54-.72-.55h-.61c-.22 0-.57.08-.86.4-.3.33-1.13 1.11-1.13 2.7s1.16 3.13 1.32 3.35c.16.21 2.28 3.48 5.52 4.88.77.33 1.37.53 1.84.68.77.24 1.47.21 2.03.13.62-.09 1.9-.78 2.17-1.53.27-.76.27-1.41.19-1.54-.08-.14-.3-.22-.62-.38Z"
        />
      </svg>
      <span>Chat with us</span>
    </a>
  );
}
export function Storefront({
  view,
  productSlug: slug,
}: {
  view: StorefrontView;
  productSlug?: string;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const liveSlug = slug ?? searchParams.get("slug") ?? undefined;
  const categorySection =
    searchParams.get("section") === "accessories" ? "accessories" : "fabric";
  const [cart, setCart] = useLocalStorageState<CartItem[]>(
    "hsg-texture-cart",
    [],
  );
  const [managedProducts, setManagedProducts] = useState<Product[]>([]);
  const [managedCategories, setManagedCategories] = useState<Category[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState("");
  const [drawer, setDrawer] = useState(false);
  const [favoritesDrawer, setFavoritesDrawer] = useState(false);
  const [favorites, setFavorites] = useLocalStorageState<Product[]>(
    "hsg-texture-favorites",
    [],
  );
  const [siteSettings, setSiteSettings] =
    useState<SiteSettings>(defaultSiteSettings);
  useEffect(() => {
    let mounted = true;
    let latestRequest = 0;
    const commit = async (next: SiteSettings, request: number) => {
      const imageReady = await preloadSiteImage(next.heroImageUrl);
      if (!mounted || request !== latestRequest) return;
      setSiteSettings((current) =>
        imageReady
          ? next
          : {
              ...next,
              heroImageKey: current.heroImageKey,
              heroImageUrl: current.heroImageUrl,
            },
      );
    };
    const applyCached = () => {
      const request = ++latestRequest;
      void commit(getCachedSiteSettings(), request);
    };
    const refresh = async () => {
      const request = ++latestRequest;
      try {
        await commit(await getSiteSettings(), request);
      } catch {
        // Keep the currently rendered defaults or last successful settings.
      }
    };
    const initialize = async () => {
      const request = ++latestRequest;
      await commit(getCachedSiteSettings(), request);
      if (mounted && request === latestRequest) await refresh();
    };
    void initialize();
    const syncCached = (event: StorageEvent) => {
      if (event.key === SITE_SETTINGS_CACHE_KEY) applyCached();
    };
    window.addEventListener("storage", syncCached);
    window.addEventListener("hsg-site-settings-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("storage", syncCached);
      window.removeEventListener("hsg-site-settings-updated", refresh);
    };
  }, []);
  useEffect(() => {
    let mounted = true;
    let latestRequest = 0;
    const refresh = async () => {
      const request = ++latestRequest;
      const [productResult, categoryResult] = await Promise.allSettled([
        getStorefrontProducts(),
        getStorefrontCategories(),
      ]);
      if (!mounted || request !== latestRequest) return;

      const errors: string[] = [];
      if (productResult.status === "fulfilled") {
        setManagedProducts(productResult.value);
      } else {
        errors.push(
          `Products: ${productResult.reason instanceof Error ? productResult.reason.message : "could not be loaded"}`,
        );
      }
      if (categoryResult.status === "fulfilled") {
        setManagedCategories(categoryResult.value);
      } else {
        errors.push(
          `Categories: ${categoryResult.reason instanceof Error ? categoryResult.reason.message : "could not be loaded"}`,
        );
      }
      setCatalogError(errors.join(". "));
      setCatalogLoading(false);
    };
    void refresh();
    window.addEventListener("hsg-products-updated", refresh);
    window.addEventListener("hsg-categories-updated", refresh);
    return () => {
      mounted = false;
      window.removeEventListener("hsg-products-updated", refresh);
      window.removeEventListener("hsg-categories-updated", refresh);
    };
  }, []);
  const products = managedProducts.filter(
    (product) => product.active !== false,
  );
  const categories = managedCategories.filter(
    (category) => category.active !== false,
  );
  const addToCart = (product: Product, quantity = 1) =>
    setCart((items) => {
      const existing = items.find((item) => item.product.name === product.name);
      return existing
        ? items.map((item) =>
            item.product.name === product.name
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [...items, { product, quantity }];
    });
  const add = (product: Product, quantity = 1) => {
    addToCart(product, quantity);
    setDrawer(true);
  };
  const addCardProduct = (product?: Product) => {
    if (product) add(product);
  };
  const toggleFavorite = (product: Product) =>
    setFavorites((items) =>
      items.some((item) => item.name === product.name)
        ? items.filter((item) => item.name !== product.name)
        : [...items, product],
    );
  const update = (name: string, quantity: number) =>
    setCart((items) =>
      quantity <= 0
        ? items.filter((item) => item.product.name !== name)
        : items.map((item) =>
            item.product.name === name ? { ...item, quantity } : item,
          ),
    );
  const count = cart.length;
  const detailProduct = products.find(
    (product) => toProductSlug(product.name) === liveSlug,
  );
  const favoriteValue = {
    names: new Set(favorites.map((item) => item.name)),
    toggle: toggleFavorite,
  };
  const catalogValue = { products, categories, loading: catalogLoading };
  return (
    <SiteSettingsContext.Provider value={siteSettings}>
      <CatalogContext.Provider value={catalogValue}>
        <FavoriteContext.Provider value={favoriteValue}>
          <div>
            <Header
              cart={count}
              favorites={favorites.length}
              openCart={() => setDrawer(true)}
              openFavorites={() => setFavoritesDrawer(true)}
            />
            {catalogError && (
              <div className="catalog-api-error" role="alert">
                The live catalogue could not be fully loaded. {catalogError}{" "}
                Check the backend connection and refresh the page.
              </div>
            )}
            {view === "home" && <HomeView add={addCardProduct} />}{" "}
            {view === "category" && <Listing category add={addCardProduct} />}{" "}
            {view === "products" && <Listing add={addCardProduct} />}{" "}
            {view === "product-detail" && liveSlug && (
              <ProductDetail
                slug={liveSlug}
                add={(quantity) =>
                  detailProduct && add(detailProduct, quantity)
                }
              />
            )}{" "}
            {view === "about" && <About />} {view === "contact" && <Contact />}
            <Footer />
            <WhatsAppButton />
            <StorefrontBottomNav
              pathname={pathname}
              categorySection={categorySection}
              cart={count}
              favorites={favorites.length}
              openCart={() => setDrawer(true)}
              openFavorites={() => setFavoritesDrawer(true)}
            />
            <CartDrawer
              open={drawer}
              close={() => setDrawer(false)}
              items={cart}
              update={update}
              clear={() => setCart([])}
            />
            <FavoritesDrawer
              open={favoritesDrawer}
              close={() => setFavoritesDrawer(false)}
              items={favorites}
              add={(product) => addToCart(product)}
              toggle={toggleFavorite}
            />
          </div>
        </FavoriteContext.Provider>
      </CatalogContext.Provider>
    </SiteSettingsContext.Provider>
  );
}
