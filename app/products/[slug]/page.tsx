import { Storefront } from "@/components/storefront";

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <Storefront view="product-detail" productSlug={slug} />;
}
