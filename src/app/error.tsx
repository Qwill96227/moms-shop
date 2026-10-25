"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="mx-auto max-w-2xl px-4 pt-20 text-center">
      <h1 className="text-4xl font-extrabold">This page didn&apos;t load</h1>
      <p className="mt-3 text-lg">Something went wrong on our side and it&apos;s been logged{error.digest ? ` (ref ${error.digest})` : ""}.</p>
      <button type="button" className="btn btn-primary mt-8" onClick={reset}>Try again</button>
    </div>
  );
}
