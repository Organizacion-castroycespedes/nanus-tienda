"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { apiBlobClient } from "../../../lib/http";
import { normalizeInventoryImageApiPath } from "../utils/inventory-image-upload";

type InventoryImagePreviewProps = {
  imageUrl?: string | null;
  altText?: string | null;
  className: string;
  fallback: ReactNode;
  lazy?: boolean;
};

export const InventoryImagePreview = ({
  imageUrl,
  altText,
  className,
  fallback,
  lazy = false,
}: InventoryImagePreviewProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy);

  useEffect(() => {
    const apiPath = normalizeInventoryImageApiPath(imageUrl);

    if (!lazy || !apiPath) {
      setShouldLoad(true);
      return;
    }

    setShouldLoad(false);

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const node = containerRef.current;
    if (!node) {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "160px" }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [imageUrl, lazy]);

  useEffect(() => {
    let mounted = true;
    let currentObjectUrl: string | null = null;
    const apiPath = normalizeInventoryImageApiPath(imageUrl);

    setObjectUrl(null);
    setFailed(false);

    if (!apiPath || !shouldLoad) {
      return () => {
        mounted = false;
      };
    }

    if (apiPath.startsWith("blob:") || apiPath.startsWith("data:")) {
      setObjectUrl(apiPath);
      return () => {
        mounted = false;
      };
    }

    const loadImage = async () => {
      try {
        const blob = await apiBlobClient(apiPath);
        if (!mounted) {
          return;
        }
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);
      } catch {
        if (mounted) {
          setFailed(true);
        }
      }
    };

    void loadImage();

    return () => {
      mounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [imageUrl, shouldLoad]);

  return (
    <div
      ref={containerRef}
      aria-label={altText ?? undefined}
      className={className}
      role="img"
      style={
        objectUrl && !failed
          ? { backgroundImage: `url("${objectUrl}")` }
          : undefined
      }
    >
      {objectUrl && !failed ? null : fallback}
    </div>
  );
};
