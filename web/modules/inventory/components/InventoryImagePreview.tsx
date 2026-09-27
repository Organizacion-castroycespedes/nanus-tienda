"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  fetchAndCacheInventoryImage,
  getCachedInventoryImageUrl,
  observeInventoryImageElement,
} from "../services/inventory-image-cache";
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
  const normalizedPath = normalizeInventoryImageApiPath(imageUrl);
  const [objectUrl, setObjectUrl] = useState<string | null>(() =>
    normalizedPath ? getCachedInventoryImageUrl(normalizedPath) : null
  );
  const [failed, setFailed] = useState(false);
  const [shouldLoad, setShouldLoad] = useState(!lazy || Boolean(objectUrl));

  useEffect(() => {
    if (!lazy || !normalizedPath || shouldLoad) {
      setShouldLoad(true);
      return;
    }

    const node = containerRef.current;
    if (!node) {
      setShouldLoad(true);
      return;
    }

    const cleanup = observeInventoryImageElement(node, () => {
      setShouldLoad(true);
    });

    return cleanup;
  }, [lazy, normalizedPath, shouldLoad]);

  useEffect(() => {
    let mounted = true;

    if (!normalizedPath || !shouldLoad) {
      return;
    }

    const cached = getCachedInventoryImageUrl(normalizedPath);
    if (cached) {
      setObjectUrl(cached);
      setFailed(false);
      return;
    }

    setFailed(false);

    const load = async () => {
      try {
        const url = await fetchAndCacheInventoryImage(normalizedPath);
        if (mounted) {
          setObjectUrl(url);
          setFailed(false);
        }
      } catch {
        if (mounted) {
          setFailed(true);
        }
      }
    };

    void load();

    const handleInvalidation = (event: Event) => {
      const customEvent = event as CustomEvent<{ path: string | null }>;
      const targetPath = customEvent.detail?.path;
      if (!targetPath || targetPath === normalizedPath) {
        if (mounted) {
          void fetchAndCacheInventoryImage(normalizedPath, { forceRefresh: true })
            .then((url) => {
              if (mounted) {
                setObjectUrl(url);
                setFailed(false);
              }
            })
            .catch(() => {
              if (mounted) {
                setFailed(true);
              }
            });
        }
      }
    };

    window.addEventListener("manus:inventory-image-invalidated", handleInvalidation);

    return () => {
      mounted = false;
      window.removeEventListener(
        "manus:inventory-image-invalidated",
        handleInvalidation
      );
    };
  }, [normalizedPath, shouldLoad]);

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

