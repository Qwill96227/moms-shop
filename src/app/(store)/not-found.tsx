import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 pt-20 text-center">
      <h1 className="text-5xl font-extrabold">That page isn&apos;t here</h1>
      <p className="mt-3 text-lg text-ink-soft">The item may have sold out for good, or the link has a typo.</p>
      <Link href="/shop" className="btn btn-primary mt-8">Go to the shop</Link>
    </div>
  );
}
