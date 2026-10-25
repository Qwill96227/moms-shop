"use client";

import { useActionState } from "react";
import type { Category } from "@/lib/db/schema";
import { saveCategory } from "../../actions";

export function CategoryForm({ category }: { category?: Category }) {
  const [state, action, pending] = useActionState(saveCategory, undefined);
  const k = category?.id ?? "new";
  return (
    <form action={action} className="mt-2 flex flex-wrap items-end gap-3">
      {category && <input type="hidden" name="id" value={category.id} />}
      <div className="min-w-40 flex-1">
        <label className="label" htmlFor={`n${k}`}>Name</label>
        <input id={`n${k}`} name="name" defaultValue={category?.name} className="input" required />
      </div>
      <div className="min-w-56 flex-[2]">
        <label className="label" htmlFor={`b${k}`}>Short description</label>
        <input id={`b${k}`} name="blurb" defaultValue={category?.blurb} className="input" placeholder="Shown under the name on the home page" />
      </div>
      <button className="btn btn-primary" disabled={pending}>{category ? "Save" : "Add category"}</button>
      {state?.ok && <p role="status" className="w-full font-bold text-okra">{state.ok}</p>}
      {state?.error && <p role="alert" className="w-full font-bold text-hibiscus-dark">{state.error}</p>}
    </form>
  );
}
