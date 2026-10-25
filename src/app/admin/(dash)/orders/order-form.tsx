"use client";

import { useActionState, useState } from "react";
import { updateOrder } from "../../actions";

const options = [
  { value: "paid", label: "Paid, to pack" },
  { value: "shipped", label: "Shipped" },
  { value: "delivered", label: "Delivered" },
  { value: "needs_attention", label: "Needs a look" },
  { value: "canceled", label: "Canceled (refund in Stripe)" },
];

export function OrderForm({ id, status, trackingNumber, emailOn }: { id: number; status: string; trackingNumber: string; emailOn: boolean }) {
  const [state, action, pending] = useActionState(updateOrder, undefined);
  const [next, setNext] = useState(status === "paid" || status === "needs_attention" ? "shipped" : status);
  return (
    <form action={action} className="mt-4 flex flex-wrap items-end gap-3 border-t-2 border-ink/10 pt-4">
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label" htmlFor={`s${id}`}>Status</label>
        <select id={`s${id}`} name="status" className="input w-auto" value={next} onChange={(e) => setNext(e.target.value)}>
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      {next === "shipped" && (
        <div className="min-w-48 flex-1">
          <label className="label" htmlFor={`t${id}`}>Tracking number</label>
          <input id={`t${id}`} name="trackingNumber" defaultValue={trackingNumber} className="input" placeholder="Optional" />
        </div>
      )}
      {next === "shipped" && emailOn && (
        <label className="flex min-h-11 items-center gap-2 font-bold">
          <input type="checkbox" name="notify" defaultChecked className="size-5" /> Email the customer
        </label>
      )}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : "Save"}</button>
      {state?.ok && <p role="status" className="w-full font-bold text-okra">{state.ok}</p>}
      {state?.error && <p role="alert" className="w-full font-bold text-hibiscus-dark">{state.error}</p>}
    </form>
  );
}
