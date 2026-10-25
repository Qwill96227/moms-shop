"use client";

import { useTransition } from "react";
import { toggleProductActive } from "../../actions";

export function ActiveToggle({ id, active }: { id: number; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => toggleProductActive(id, !active))}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${active ? "bg-okra text-paper" : "bg-ink/10"}`}
      aria-label={active ? "Hide from store" : "Show in store"}
    >
      {pending ? "…" : active ? "In store" : "Hidden"}
    </button>
  );
}
