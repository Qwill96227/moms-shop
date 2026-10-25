"use client";

import Image from "next/image";
import { useActionState, useRef, useState } from "react";
import type { Category } from "@/lib/db/schema";
import { saveProduct } from "../../actions";

type VariantRow = { id?: number; name: string; stock: number; price: string; sku: string };
type Initial = {
  id?: number; name: string; description: string; categoryId: number | null; price: string;
  featured: boolean; active: boolean; images: string[]; variants: VariantRow[];
};

const SIZES = ["S", "M", "L", "XL", "2XL", "3XL"];
const blank: Initial = {
  name: "", description: "", categoryId: null, price: "", featured: false, active: true, images: [],
  variants: [{ name: "Standard", stock: 1, price: "", sku: "" }],
};

/** Shrinks phone photos before upload so they're fast to send and fast to load. */
async function shrink(file: File): Promise<Blob> {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * scale);
    canvas.height = Math.round(bmp.height * scale);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    return await new Promise((res) => canvas.toBlob((b) => res(b ?? file), "image/jpeg", 0.85));
  } catch {
    return file;
  }
}

export function ProductForm({ categories, initial = blank }: { categories: Category[]; initial?: Initial }) {
  const [state, action, pending] = useActionState(saveProduct, undefined);
  const [p, setP] = useState<Initial>(initial);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Initial>(k: K, v: Initial[K]) => setP((prev) => ({ ...prev, [k]: v }));
  const setVariant = (i: number, patch: Partial<VariantRow>) =>
    set("variants", p.variants.map((v, j) => (j === i ? { ...v, ...patch } : v)));

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setUploadError(null);
    const urls: string[] = [];
    for (const f of Array.from(files).slice(0, 8 - p.images.length)) {
      const body = new FormData();
      body.append("file", await shrink(f), f.name.replace(/\.\w+$/, ".jpg"));
      const res = await fetch("/api/upload", { method: "POST", body });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setUploadError(data.error ?? "That photo didn't upload. Try a JPG or PNG."); break; }
      urls.push(data.url);
    }
    setP((prev) => ({ ...prev, images: [...prev.images, ...urls] }));
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  const payload = JSON.stringify({ ...p, variants: p.variants.map((v) => ({ ...v, stock: Number(v.stock) || 0 })) });

  return (
    <form action={action} className="mt-6 space-y-8 pb-28">
      <input type="hidden" name="payload" value={payload} />

      <Section title="Photos" hint="The first photo is the one shoppers see first.">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {p.images.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-md bg-shell">
              <Image src={src} alt="" fill sizes="160px" className="object-cover" />
              <div className="absolute inset-x-1 bottom-1 flex gap-1">
                {i > 0 && (
                  <button type="button" className="flex-1 rounded bg-paper/90 px-1 py-1 text-xs font-bold"
                    onClick={() => set("images", [src, ...p.images.filter((x) => x !== src)])}>Make first</button>
                )}
                <button type="button" aria-label="Remove photo" className="rounded bg-paper/90 px-2 py-1 text-xs font-bold"
                  onClick={() => set("images", p.images.filter((x) => x !== src))}>✕</button>
              </div>
            </div>
          ))}
          {p.images.length < 8 && (
            <label className="grid aspect-square cursor-pointer place-items-center rounded-md border-2 border-dashed border-ink/40 p-2 text-center font-bold hover:bg-paper">
              {uploading ? "Uploading…" : "Add photos"}
              <input ref={fileRef} type="file" accept="image/*" multiple className="sr-only" onChange={(e) => onFiles(e.target.files)} disabled={uploading} />
            </label>
          )}
        </div>
        {uploadError && <p role="alert" className="mt-2 font-bold text-hibiscus-dark">{uploadError}</p>}
      </Section>

      <Section title="Details">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="label" htmlFor="name">Name</label>
            <input id="name" className="input" value={p.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
          </div>
          <div>
            <label className="label" htmlFor="price">Price ($)</label>
            <input id="price" className="input" inputMode="decimal" placeholder="24.00" value={p.price} onChange={(e) => set("price", e.target.value)} required />
          </div>
          <div>
            <label className="label" htmlFor="cat">Category</label>
            <select id="cat" className="input" value={p.categoryId ?? ""} onChange={(e) => set("categoryId", e.target.value ? Number(e.target.value) : null)}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="desc">Description</label>
            <textarea id="desc" rows={5} className="input" value={p.description} onChange={(e) => set("description", e.target.value)}
              placeholder="What it's made of, how it fits, how to care for it." />
          </div>
        </div>
      </Section>

      <Section title="Options and stock" hint="Sizes, colors or styles. Leave the price blank to use the main price.">
        <div className="mb-3 flex flex-wrap gap-2">
          <button type="button" className="rounded-full border-2 border-ink px-3 py-1 text-sm font-bold"
            onClick={() => set("variants", SIZES.map((s) => ({ name: s, stock: 0, price: "", sku: "" })))}>Use shirt sizes S–3XL</button>
          <button type="button" className="rounded-full border-2 border-ink px-3 py-1 text-sm font-bold"
            onClick={() => set("variants", [{ name: "Standard", stock: 0, price: "", sku: "" }])}>Just one kind</button>
        </div>
        <div className="space-y-2">
          <div className="grid grid-cols-[1fr_5rem_6rem_2.5rem] gap-2 text-sm font-bold text-ink-soft">
            <span>Option</span><span>In stock</span><span>Price</span><span />
          </div>
          {p.variants.map((v, i) => (
            <div key={v.id ?? `n${i}`} className="grid grid-cols-[1fr_5rem_6rem_2.5rem] gap-2">
              <input aria-label="Option name" className="input" value={v.name} onChange={(e) => setVariant(i, { name: e.target.value })} required />
              <input aria-label="In stock" className="input" type="number" min={0} inputMode="numeric" value={v.stock} onChange={(e) => setVariant(i, { stock: Number(e.target.value) })} />
              <input aria-label="Price override" className="input" inputMode="decimal" placeholder="Same" value={v.price} onChange={(e) => setVariant(i, { price: e.target.value })} />
              <button type="button" aria-label={`Remove ${v.name}`} disabled={p.variants.length === 1} className="rounded-lg font-bold hover:bg-paper disabled:opacity-30"
                onClick={() => set("variants", p.variants.filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="mt-3 font-bold underline underline-offset-4"
          onClick={() => set("variants", [...p.variants, { name: "", stock: 0, price: "", sku: "" }])}>Add an option</button>
      </Section>

      <Section title="Where it shows">
        <label className="flex items-center gap-3 font-bold"><input type="checkbox" className="size-5" checked={p.active} onChange={(e) => set("active", e.target.checked)} /> Show in the store</label>
        <label className="mt-3 flex items-center gap-3 font-bold"><input type="checkbox" className="size-5" checked={p.featured} onChange={(e) => set("featured", e.target.checked)} /> Feature on the home page</label>
      </Section>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t-2 border-ink bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4 px-4 py-3">
          <button className="btn btn-primary" disabled={pending || uploading}>{pending ? "Saving…" : p.id ? "Save changes" : "Add product"}</button>
          {state?.error && <p role="alert" className="font-bold text-hibiscus-dark">{state.error}</p>}
        </div>
      </div>
    </form>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg bg-paper p-5">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {hint && <p className="mb-4 text-ink-soft">{hint}</p>}
      <div className={hint ? "" : "mt-4"}>{children}</div>
    </section>
  );
}
