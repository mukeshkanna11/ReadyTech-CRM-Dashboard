import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import { pickReturnParams, saveShopifyReturn } from "../../components/shopify/shopifyReturn";

/* Public landing page for Shopify redirects (OAuth callback result and the
   App URL launch from Shopify admin). Keeps the result across a login, then
   opens the workspace's Shopify page. It never connects anything itself. */
export default function ShopifyReturn() {
  const { search } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = pickReturnParams(search);
    saveShopifyReturn(params);
    if (!localStorage.getItem("token")) {
      toast("Log in to ReadyTech to finish connecting your Shopify store.");
      navigate("/login", { replace: true });
      return;
    }
    navigate(`/integrations/shopify${params ? `?${params}` : ""}`, { replace: true });
  }, [search, navigate]);

  return null;
}
