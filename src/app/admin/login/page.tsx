import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { site } from "@/lib/site";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in", robots: { index: false } };

export default async function LoginPage() {
  if (await getSession()) redirect("/admin");
  return (
    <div className="grid min-h-dvh place-items-center bg-ink px-4">
      <div className="w-full max-w-sm rounded-lg bg-paper p-8">
        <p className="font-display text-4xl font-extrabold">{site.name}</p>
        <h1 className="mt-1 text-xl font-bold text-ink-soft">Shop owner sign in</h1>
        <LoginForm />
      </div>
    </div>
  );
}
