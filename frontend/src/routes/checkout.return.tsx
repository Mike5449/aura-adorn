import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { orderApi } from "@/lib/api";
import { z } from "zod";
import { fallback, zodValidator } from "@tanstack/zod-adapter";

/**
 * Static return URL registered in the MonCash merchant portal:
 *   https://<your-host>/checkout/return
 *
 * MonCash appends `transactionId` to that URL when redirecting the customer
 * back. We never embed order info in the registered URL.
 *
 * Verification strategy (two stages, in order):
 *
 *   1. Primary — `POST /orders/pay/moncash/resolve { transactionId }`
 *      The backend asks MonCash for the transaction details, reads back the
 *      `orderId` (= our order_number) MonCash echoes, and finalises the order.
 *      Works even if the customer changed device/browser between paying and
 *      returning.
 *
 *   2. Fallback — `POST /orders/{id}/pay/moncash/verify { transactionId }`
 *      If MonCash didn't echo our orderId (some flows or older sandboxes),
 *      we fall back to the order id we stashed in localStorage at checkout
 *      and verify the transaction against THAT order.
 */
const searchSchema = z.object({
  transactionId: fallback(z.string(), "").default(""),
  transaction_id: fallback(z.string(), "").default(""),
  data: fallback(z.string(), "").default(""),
});

export const Route = createFileRoute("/checkout/return")({
  validateSearch: zodValidator(searchSchema),
  head: () => ({
    meta: [
      { title: "Vérification du paiement — Beauté & Élégance" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ReturnPage,
});

function pickTransactionId(s: { transactionId: string; transaction_id: string; data: string }): string {
  if (s.transactionId) return s.transactionId;
  if (s.transaction_id) return s.transaction_id;
  if (s.data) {
    try {
      const decoded = JSON.parse(atob(s.data));
      return decoded.transactionId || decoded.transaction_id || "";
    } catch {
      /* not a base64 JSON blob */
    }
  }
  return "";
}

interface PendingOrder {
  id: number;
  number: string;
  ts?: number;
}

function readPendingOrder(): PendingOrder | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem("maison_pending_order");
    if (!raw) return null;
    // Accept both new {id,number} format and legacy plain id
    if (raw.startsWith("{")) return JSON.parse(raw);
    const id = Number(raw);
    return Number.isFinite(id) ? { id, number: "" } : null;
  } catch {
    return null;
  }
}

function clearPendingOrder() {
  try { localStorage.removeItem("maison_pending_order"); } catch { /* ignore */ }
}

function ReturnPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();

  useEffect(() => {
    const txn = pickTransactionId(search);
    const pending = readPendingOrder();

    if (!txn) {
      // No transactionId in the URL. Fall back to the recover endpoint:
      // ask the backend to look up the transaction via MonCash using our
      // order_number (kept in localStorage at checkout time).
      if (pending?.number) {
        (async () => {
          try {
            const order = await orderApi.recoverMonCash(pending.number);
            clearPendingOrder();
            if (order.payment_status === "success") {
              navigate({ to: "/checkout/success", search: { order: order.order_number } });
            } else {
              navigate({
                to: "/checkout/alert",
                search: { reason: "invalid_transaction", order: order.order_number },
              });
            }
          } catch (e: any) {
            navigate({
              to: "/checkout/alert",
              search: { reason: e?.message ?? "missing_params", order: pending.number },
            });
          }
        })();
        return;
      }
      navigate({ to: "/checkout/alert", search: { reason: "missing_params", order: "" } });
      return;
    }

    (async () => {
      // Stage 1 — try the transactionId-only resolve
      try {
        const order = await orderApi.resolveMonCash(txn);
        clearPendingOrder();
        if (order.payment_status === "success") {
          navigate({ to: "/checkout/success", search: { order: order.order_number } });
        } else {
          navigate({
            to: "/checkout/alert",
            search: { reason: "invalid_transaction", order: order.order_number },
          });
        }
        return;
      } catch (e: any) {
        // Stage 2 — only fall back if we still have a local pending order
        if (!pending?.id) {
          navigate({
            to: "/checkout/alert",
            search: { reason: e?.message ?? "network", order: "" },
          });
          return;
        }
      }

      // Stage 2 fallback — verify against the locally-stashed order id
      try {
        const order = await orderApi.verifyMonCash(pending!.id, txn);
        clearPendingOrder();
        if (order.payment_status === "success") {
          navigate({ to: "/checkout/success", search: { order: order.order_number } });
        } else {
          navigate({
            to: "/checkout/alert",
            search: { reason: "invalid_transaction", order: order.order_number },
          });
        }
      } catch (e: any) {
        navigate({
          to: "/checkout/alert",
          search: { reason: e?.message ?? "network", order: pending?.number ?? "" },
        });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="mx-auto max-w-md px-6 py-32 text-center">
      <Loader2 className="mx-auto h-12 w-12 animate-spin text-gold" />
      <h1 className="mt-6 font-display text-3xl">Vérification du paiement…</h1>
      <p className="mt-3 text-sm text-muted-foreground">
        Merci de patienter — nous validons votre transaction MonCash.
      </p>
    </div>
  );
}
