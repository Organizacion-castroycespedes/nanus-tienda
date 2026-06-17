"use client";

import { useEffect, useState, type ReactNode } from "react";
import { apiBlobClient } from "../../../lib/http";
import { normalizeInventoryImageApiPath } from "../utils/inventory-image-upload";

type InventoryImagePreviewProps = {
  imageUrl?: string | null;
  altText?: string | null;
  className: string;
  fallback: ReactNode;
};

export const InventoryImagePreview = ({
  imageUrl,
  altText,
  className,
  fallback,
}: InventoryImagePreviewProps) => {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let mounted = true;
    let currentObjectUrl: string | null = null;
    const apiPath = normalizeInventoryImageApiPath(imageUrl);

    setObjectUrl(null);
    setFailed(false);

    if (!apiPath) {
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
  }, [imageUrl]);

  return (
    <div
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
