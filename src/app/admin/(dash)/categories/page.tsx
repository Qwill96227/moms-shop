import { requireAdmin } from "@/lib/auth";
import { listCategories } from "@/lib/catalog";
import { CategoryForm } from "./category-form";

export default async function Categories() {
  await requireAdmin("owner");
  const cats = await listCategories();
  return (
    <div className="space-y-6">
      <h1 className="text-4xl font-extrabold">Categories</h1>
      <p className="max-w-prose text-ink-soft">Categories group products in the shop. Add a new one when you start making something new.</p>
      <section className="rounded-lg bg-paper p-5">
        <h2 className="text-xl font-extrabold">Add a category</h2>
        <CategoryForm />
      </section>
      <ul className="space-y-3">
        {cats.map((c) => (
          <li key={c.id} className="rounded-lg bg-paper p-5"><CategoryForm category={c} /></li>
        ))}
      </ul>
    </div>
  );
}
