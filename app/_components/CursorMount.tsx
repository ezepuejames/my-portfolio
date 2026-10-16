"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const GrainCursor = dynamic(() => import("./GrainCursor"), { ssr: false });

// Only mount the grain cursor for mouse/trackpad users who allow motion;
// touch devices and reduced-motion users keep the native cursor.
export default function CursorMount() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)");
    const update = () => setEnabled(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  return enabled ? <GrainCursor /> : null;
}
