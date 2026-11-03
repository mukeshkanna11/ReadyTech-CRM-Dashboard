import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/* RTS AI Assistant deep links: /page?q=<search>&status=<filter>
   Feeds the page's EXISTING search/filter state — nothing else.
   No-op when the URL carries no assistant params. */
export default function useAssistantFilters({ setSearch, setStatus } = {}) {
  const { search } = useLocation();
  useEffect(() => {
    const params = new URLSearchParams(search);
    const q = params.get("q");
    const status = params.get("status");
    if (q !== null) setSearch?.(q.slice(0, 100));
    if (status !== null) setStatus?.(status.slice(0, 40));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);
}
