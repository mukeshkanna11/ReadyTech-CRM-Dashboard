import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { pickReturnParams, saveShopifyReturn } from "../../components/shopify/shopifyReturn";

/* Public landing page for Shopify redirects (OAuth callback result and the
   App URL launch from Shopify admin). Keeps the result across a login, then
   opens the workspace's Shopify page. It never connects anything itself. */
export default function ShopifyReturn() {
  const { search, hash } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // The install link code arrives in the fragment (never sent to servers)
    const all = new URLSearchParams(search);
    new URLSearchParams(hash.replace(/^#/, "")).forEach((v, k) => all.set(k, v));
    const params = pickReturnParams(all.toString());
    saveShopifyReturn(params);
    if (!localStorage.getItem("token")) {
      toast("Log in to ReadyTech to finish connecting your Shopify store.");
      navigate("/login", { replace: true });
      return;
    }
    navigate(`/integrations/shopify${params ? `?${params}` : ""}`, { replace: true });
  }, [search, hash, navigate]);

  return null;
}
