import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { getProductById, listCategories } from "@/lib/catalog";
import { ProductForm } from "../product-form";

export default async function EditProduct({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin("owner");
  const id = Number((await params).id);
  const product = Number.isInteger(id) ? await getProductById(id) : null;
  if (!product) notFound();
  return (
    <div>
      <h1 className="text-4xl font-extrabold">Edit {product.name}</h1>
      <ProductForm
        categories={await listCategories()}
        initial={{
          id: product.id, name: product.name, description: product.description, categoryId: product.categoryId,
          price: (product.priceCents / 100).toFixed(2), featured: product.featured, active: product.active, images: product.images,
          variants: product.variants.map((v) => ({
            id: v.id, name: v.name, stock: v.stock, sku: v.sku ?? "", price: v.priceCents ? (v.priceCents / 100).toFixed(2) : "",
          })),
        }}
      />
    </div>
  );
}
