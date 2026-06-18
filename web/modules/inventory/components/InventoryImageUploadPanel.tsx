"use client";

import { ImageIcon, Trash2, Upload } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { InventoryImagePreview } from "./InventoryImagePreview";
import {
  formatInventoryImageSize,
  INVENTORY_IMAGE_MAX_SIZE_MB,
  validateInventoryImageFile,
} from "../utils/inventory-image-upload";

type InventoryImageUploadPanelProps = {
  entityId?: string | null;
  title: string;
  imageUrl?: string | null;
  imageAltText?: string | null;
  imageMimeType?: string | null;
  imageSizeBytes?: number | null;
  disabledMessage: string;
  fallbackLabel: string;
  onUpload: (file: File) => Promise<void>;
  onDelete: () => Promise<void>;
};

export const InventoryImageUploadPanel = ({
  entityId,
  title,
  imageUrl,
  imageAltText,
  imageMimeType,
  imageSizeBytes,
  disabledMessage,
  fallbackLabel,
  onUpload,
  onDelete,
}: InventoryImageUploadPanelProps) => {
  const inputId = useId();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const hasSavedImage = Boolean(imageUrl?.trim());
  const isDisabled = !entityId;

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextPreviewUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextPreviewUrl);
    return () => URL.revokeObjectURL(nextPreviewUrl);
  }, [selectedFile]);

  useEffect(() => {
    setSelectedFile(null);
    setErrorMessage(null);
  }, [entityId, imageUrl]);

  const previewImageUrl = previewUrl ?? imageUrl;
  const metaText = useMemo(() => {
    if (selectedFile) {
      return `${selectedFile.type} - ${formatInventoryImageSize(selectedFile.size)}`;
    }
    if (imageMimeType || imageSizeBytes) {
      return `${imageMimeType ?? "Imagen"} - ${formatInventoryImageSize(imageSizeBytes)}`;
    }
    return `JPG, PNG o WebP hasta ${INVENTORY_IMAGE_MAX_SIZE_MB} MB.`;
  }, [imageMimeType, imageSizeBytes, selectedFile]);

  const handleUpload = async () => {
    const validationError = validateInventoryImageFile(selectedFile);
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setIsUploading(true);
    setErrorMessage(null);
    try {
      await onUpload(selectedFile!);
      setSelectedFile(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo subir la imagen."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async () => {
    if (!hasSavedImage) {
      return;
    }

    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await onDelete();
      setSelectedFile(null);
    } catch (error) {
      setErrorMessage(
        error instanceof Error && error.message.trim()
          ? error.message
          : "No se pudo eliminar la imagen."
      );
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <section className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[128px_1fr]">
      <InventoryImagePreview
        imageUrl={previewImageUrl}
        altText={imageAltText ?? fallbackLabel}
        className="flex h-32 w-32 items-center justify-center rounded-xl border border-slate-200 bg-white bg-cover bg-center text-slate-500"
        fallback={<ImageIcon className="h-8 w-8" />}
      />

      <div className="min-w-0 space-y-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-xs text-slate-500">{metaText}</p>
        </div>

        {isDisabled ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {disabledMessage}
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <input
              id={inputId}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="block w-full max-w-sm rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;
                setSelectedFile(file);
                setErrorMessage(validateInventoryImageFile(file));
              }}
            />
            <Button
              type="button"
              onClick={() => void handleUpload()}
              disabled={!selectedFile || Boolean(errorMessage) || isDeleting}
              isLoading={isUploading}
            >
              <Upload className="h-4 w-4" />
              Subir
            </Button>
            {hasSavedImage ? (
              <Button
                type="button"
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={isUploading}
                isLoading={isDeleting}
              >
                <Trash2 className="h-4 w-4" />
                Eliminar
              </Button>
            ) : null}
          </div>
        )}

        {errorMessage ? (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {errorMessage}
          </div>
        ) : null}
      </div>
    </section>
  );
};
