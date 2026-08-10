"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function RouteProgress() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const link = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank") return;
      const next = new URL(link.href, window.location.href);
      if (next.origin !== window.location.origin || next.hash || next.href === window.location.href) return;
      setVisible(true);
      setWidth(18);
      window.requestAnimationFrame(() => setWidth(64));
      window.setTimeout(() => {
        setWidth((current) => (current > 0 && current < 100 ? 82 : current));
      }, 500);
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  useEffect(() => {
    if (!visible) return;
    setWidth(100);
    const timer = window.setTimeout(() => {
      setVisible(false);
      setWidth(0);
    }, 240);
    return () => window.clearTimeout(timer);
  }, [pathname]);

  return <span aria-hidden className="ws-route-progress" style={{ width: `${width}%`, opacity: visible ? 1 : 0 }} />;
}
