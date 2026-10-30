"use client";

import { useEffect, useState } from "react";

/** html[data-saver="1"] — Ko'rinish → «Ma'lumot tejash» yoki brauzer Data Saver (init skripti). SSR'da false. */
export function useDataSaver(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const d = document.documentElement;
    const sync = () => setOn(d.dataset.saver === "1");
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(d, { attributes: true, attributeFilter: ["data-saver"] });
    return () => mo.disconnect();
  }, []);
  return on;
}
