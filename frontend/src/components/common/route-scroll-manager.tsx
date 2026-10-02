import { useLayoutEffect, useRef } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

export function RouteScrollManager() {
  const location = useLocation();
  const navigationType = useNavigationType();
  const previousPathname = useRef(location.pathname);

  useLayoutEffect(() => {
    const pathnameChanged = previousPathname.current !== location.pathname;

    if (pathnameChanged && navigationType !== "POP") {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    previousPathname.current = location.pathname;
  }, [location.pathname, navigationType]);

  return null;
}
