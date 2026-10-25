import Image from "next/image";
import Link from "next/link";
import type { Metadata } from "next";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "About" };

export default function About() {
  return (
    <div className="mx-auto grid max-w-6xl gap-10 px-4 pt-10 md:grid-cols-[0.8fr_1fr] md:pt-16">
      <div className="relative aspect-[4/5] overflow-hidden rounded-lg">
        <Image src={site.maker.photo} alt="" fill priority sizes="(min-width: 768px) 40vw, 100vw" className="object-cover" />
      </div>
      <div>
        <h1 className="text-5xl font-extrabold sm:text-6xl">{site.maker.heading}</h1>
        {site.maker.story.map((p) => <p key={p.slice(0, 20)} className="mt-5 max-w-prose text-lg">{p}</p>)}
        <h2 className="mt-10 text-2xl font-extrabold">How orders work</h2>
        <ol className="mt-3 max-w-prose list-decimal space-y-2 pl-5 text-lg">
          <li>You order and pay through Stripe&apos;s secure checkout.</li>
          <li>I press, check and pack your items, usually within a week.</li>
          <li>You get an email with tracking when it ships.</li>
        </ol>
        <Link href="/shop" className="btn btn-primary mt-8">Shop everything</Link>
      </div>
    </div>
  );
}
