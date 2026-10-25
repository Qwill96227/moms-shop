import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { ProductForm } from "../product-form";

export default async function NewProduct() {
  await requireAdmin("owner");
  return (
    <div>
      <h1 className="text-4xl font-extrabold">Add a product</h1>
      <ProductForm categories={await listCategories()} />
    </div>
  );
}
