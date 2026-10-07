import { Storefront } from "@/components/storefront";
import { defaultAdminProducts } from "@/lib/catalog-admin";
import { toProductSlug } from "@/lib/storefront";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Storefront view="product-detail" productSlug={slug} />;
}

export function generateStaticParams() {
  return defaultAdminProducts.map((product) => ({
    slug: toProductSlug(product.name),
  }));
}
