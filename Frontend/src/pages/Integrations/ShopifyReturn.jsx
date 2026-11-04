import { useEffect, useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CheckCircle2, ShoppingBag, XCircle } from "lucide-react";
import { Button } from "../../components/shopify/ui";
import { pickReturnParams, saveShopifyReturn } from "../../components/shopify/shopifyReturn";

/* Public landing page for Shopify redirects (OAuth callback result, App URL).
   This IS the ReadyTech app UI Shopify sends the merchant to after OAuth:
   - signed in → continues straight to the workspace's Shopify page;
   - not signed in → shows the result and the next step (no automatic bounce
     to /login). The result is kept for this tab, so it resumes after login.
   It never connects or links anything itself. */
export default function ShopifyReturn() {
  const { search, hash } = useLocation();
  const navigate = useNavigate();
  const signedIn = Boolean(localStorage.getItem("token"));

  // The install link code arrives in the fragment (never sent to servers)
  const params = useMemo(() => {
    const all = new URLSearchParams(search);
    new URLSearchParams(hash.replace(/^#/, "")).forEach((v, k) => all.set(k, v));
    return pickReturnParams(all.toString());
  }, [search, hash]);

  useEffect(() => {
    saveShopifyReturn(params);
    if (signedIn) navigate(`/integrations/shopify${params ? `?${params}` : ""}`, { replace: true });
  }, [params, signedIn, navigate]);

  if (signedIn) return null;

  const q = new URLSearchParams(params);
  const shop = q.get("shop");
  const failed = q.get("connected") === "0";
  const view = failed
    ? { icon: XCircle, tone: "text-red-600", title: "Shopify connection didn't finish", text: q.get("message") || "Please try again from Shopify or from ReadyTech." }
    : q.get("installed")
      ? { icon: CheckCircle2, tone: "text-emerald-600", title: "ReadyTech CRM+ERP is installed", text: "Log in to your ReadyTech workspace to link this store and start syncing products, orders and stock. The link is valid for 10 minutes." }
      : q.get("connected") === "1"
        ? { icon: CheckCircle2, tone: "text-emerald-600", title: "Your Shopify store is connected", text: "Log in to ReadyTech to see products, orders and stock sync for this store." }
        : { icon: ShoppingBag, tone: "text-[#5E8E3E]", title: "ReadyTech CRM+ERP for Shopify", text: "Log in to ReadyTech to manage your Shopify integration." };
  const Icon = view.icon;

  return (
    <main className="grid min-h-screen p-4 bg-slate-50 place-items-center">
      <section className="w-full max-w-md p-6 space-y-4 text-center bg-white border shadow-sm sm:p-8 rounded-2xl border-slate-200">
        <div className="grid mx-auto text-white w-12 h-12 rounded-xl place-items-center bg-[#5E8E3E]"><ShoppingBag size={24} /></div>
        <h1 className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-900">
          <Icon size={20} className={view.tone} /> {view.title}
        </h1>
        {shop && <p className="text-sm font-medium break-all text-slate-700">{shop}</p>}
        <p className="text-sm text-slate-500">{view.text}</p>
        <Button variant="shopify" className="w-full" onClick={() => navigate("/login")}>Log in to ReadyTech</Button>
      </section>
    </main>
  );
}
