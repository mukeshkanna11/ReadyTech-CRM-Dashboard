import { useState } from "react";
import { CheckCircle2, ExternalLink, Lock, ShieldCheck, ShoppingBag } from "lucide-react";
import { Button } from "./ui";
import { validateShopInput } from "./storeInput";

const RETURN_STEP = ["Return here automatically", "Shopify brings you back to this workspace. New orders and product changes then sync automatically; choose a warehouse to also sync stock."];
const STEPS = [
  ["Click Connect Shopify", "You'll go to Shopify's own secure page."],
  ["Sign in and pick your store", "Log in to Shopify, choose the store (if you have several) and approve ReadyTech's access."],
  RETURN_STEP,
];
const MANUAL_STEPS = [
  ["Find your store address", "In Shopify admin open Settings → Domains. Copy the address ending in .myshopify.com — or simply paste the URL of your Shopify admin."],
  ["Approve access in Shopify", "You'll be sent to Shopify to review exactly what ReadyTech can access, then approve with your Shopify login."],
  RETURN_STEP,
];

const ACCESS = [
  "Products and SKUs, to match them with your ERP products",
  "Orders, to create draft ERP sales orders",
  "Stock at the one location you choose, set from your ERP",
  "Locations and fulfilments, to keep stock and deliveries in step",
];

/* Shopify-branded connect card (authorization-code OAuth started from ReadyTech).
   - The store address form: Connect is enabled only for a valid myshopify.com
     store; the authenticated backend validates again and binds the attempt to
     this admin + workspace.
   - installUrl set: an optional "Sign in with Shopify" link (Shopify's install
     page; the store comes back as ?shop=… and the same OAuth continues).
   - pendingShop: Shopify returned a store without a fresh click here → confirm it. */
export default function ConnectCard({ shop, setShop, onConnect, onInstall, installUrl, pendingShop, onCancelPending, busy, reconnecting }) {
  const [touched, setTouched] = useState(false);
  const { shop: domain, error } = validateShopInput(shop);
  const showError = touched && error;

  const submit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (domain) onConnect(domain);
  };

  return (
    <section className="overflow-hidden bg-white border shadow-sm rounded-2xl border-slate-200">
      <div className="grid xl:grid-cols-5">
        {/* Connect */}
        <div className="p-5 space-y-5 sm:p-7 xl:col-span-3">
          <div className="flex items-center gap-3">
            <div className="grid w-11 h-11 text-white rounded-xl place-items-center shrink-0 bg-[#5E8E3E]">
              <ShoppingBag size={22} />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{reconnecting ? "Connect a different Shopify store" : "Connect your Shopify store"}</h2>
              <p className="text-sm text-slate-500">Sync products, orders and stock between Shopify and ReadyTech — for this workspace only.</p>
            </div>
          </div>

          {pendingShop ? (
            <div className="p-4 space-y-3 border rounded-xl border-emerald-200 bg-emerald-50/60">
              <p className="text-sm text-slate-700">
                Shopify returned the store <strong className="break-all">{pendingShop}</strong>. Connect it to this ReadyTech workspace?
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Button variant="shopify" icon={ExternalLink} loading={busy === "connect"} disabled={!!busy} onClick={() => onConnect(pendingShop)}>
                  {busy === "connect" ? "Connecting…" : "Connect this store"}
                </Button>
                <Button disabled={!!busy} onClick={onCancelPending}>Not now</Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
            <form onSubmit={submit} noValidate className="space-y-2">
            <label htmlFor="shopify-store" className="text-sm font-medium text-slate-700">Shopify store address</label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="shopify-store"
                value={shop}
                onChange={(e) => setShop(e.target.value)}
                onBlur={() => setTouched(true)}
                placeholder="your-store.myshopify.com"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={Boolean(showError)}
                aria-describedby="shopify-store-help"
                className={`flex-1 px-4 py-2.5 text-sm border rounded-xl focus:outline-none focus:ring-2 ${showError ? "border-red-300 focus:ring-red-400" : "border-slate-300 focus:ring-emerald-500"}`}
              />
              <Button type="submit" variant="shopify" icon={ExternalLink} loading={busy === "connect"} disabled={!!busy || !domain}>
                {busy === "connect" ? "Opening Shopify…" : "Connect Shopify"}
              </Button>
            </div>
            <p id="shopify-store-help" className={`text-xs ${showError ? "text-red-600" : domain ? "text-emerald-700" : "text-slate-500"}`} aria-live="polite">
              {showError
                ? error
                : domain
                  ? <span className="inline-flex items-center gap-1"><CheckCircle2 size={13} /> Will connect <strong>{domain}</strong></span>
                  : "Example: your-store.myshopify.com, or https://admin.shopify.com/store/your-store"}
            </p>
          </form>
            {installUrl && (
              <p className="text-xs text-slate-500">
                Don't know your store address?{" "}
                <button type="button" onClick={onInstall} disabled={!!busy} className="font-semibold underline text-[#4A7330] disabled:opacity-50">
                  {busy === "install" ? "Opening Shopify…" : "Sign in with Shopify and choose your store"}
                </button>
              </p>
            )}
            </div>
          )}

          <ol className="grid gap-3 md:grid-cols-3">
            {(pendingShop ? STEPS : MANUAL_STEPS).map(([title, text], i) => (
              <li key={title} className="p-3 rounded-xl bg-slate-50">
                <span className="grid w-6 h-6 text-xs font-bold text-white rounded-full place-items-center bg-[#5E8E3E]">{i + 1}</span>
                <p className="mt-2 text-sm font-semibold text-slate-800">{title}</p>
                <p className="mt-1 text-xs text-slate-500">{text}</p>
              </li>
            ))}
          </ol>
        </div>

        {/* Trust */}
        <aside className="p-5 space-y-4 border-t sm:p-7 xl:col-span-2 xl:border-t-0 xl:border-l border-slate-200 bg-slate-50/60">
          <p className="flex items-center gap-2 text-sm font-semibold text-slate-800"><ShieldCheck size={16} className="text-emerald-600" /> Secure Shopify approval</p>
          <ul className="space-y-2 text-xs text-slate-600">
            <li className="flex gap-2"><Lock size={13} className="mt-0.5 shrink-0 text-slate-400" /> You approve access on Shopify's own page. ReadyTech never sees your Shopify password.</li>
            <li className="flex gap-2"><Lock size={13} className="mt-0.5 shrink-0 text-slate-400" /> The access key is stored encrypted and is never shown in the browser.</li>
            <li className="flex gap-2"><Lock size={13} className="mt-0.5 shrink-0 text-slate-400" /> Only this workspace's admins can connect or disconnect, and the store links to this workspace only.</li>
          </ul>
          <div>
            <p className="text-sm font-semibold text-slate-800">ReadyTech will ask to access</p>
            <ul className="mt-2 space-y-1.5 text-xs text-slate-600">
              {ACCESS.map((a) => (
                <li key={a} className="flex gap-2"><CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" /> {a}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-slate-500">Shopify shows the exact list before you approve. ReadyTech never changes your products, prices or orders in Shopify — only stock at the location you choose.</p>
          </div>
        </aside>
      </div>
    </section>
  );
}
