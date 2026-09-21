"use client";

import Image from "next/image";
import { useState } from "react";
import Icon from "./icon";

/** Direct image requests retain session cookies for private, permission-checked media. */
export default function PhotoImage({ src, alt, className = "", sizes = "(max-width: 700px) 100vw, 50vw", priority = false }: {
  src: string; alt: string; className?: string; sizes?: string; priority?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  return <div className={`photo-image ${className}`}>
    {failed || !src ? <div className="image-fallback"><Icon name="camera" size={32} /><span>{alt || "等待第一张相片"}</span></div> :
      <Image src={src} alt={alt} fill unoptimized sizes={sizes} loading={priority ? "eager" : "lazy"} onError={() => setFailed(true)} />}
  </div>;
}
