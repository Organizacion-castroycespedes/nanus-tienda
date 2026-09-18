"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "../../../components/design-system/Button";
import { Modal } from "../../../components/design-system/Modal";
import { downloadBlob, getApiErrorMessage } from "../utils";

type PdfPreviewModalProps = {
  isOpen: boolean;
  title: string;
  fileName: string;
  onClose: () => void;
  getPdf: () => Promise<Blob>;
  description?: string;
  onDownloadExcel?: () => void;
  onDownloadPdf?: () => void;
  allowPrint?: boolean;
  pagination?: { page: number; totalPages: number; onPageChange: (page: number) => void };
};

export const PdfPreviewModal = ({
  isOpen,
  title,
  fileName,
  onClose,
  getPdf,
  description = "Vista previa del Ticket",
  onDownloadExcel,
  onDownloadPdf,
  allowPrint = false,
  pagination,
}: PdfPreviewModalProps) => {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameReady, setFrameReady] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setBlob(null);
      setError(null);
      setFrameReady(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);
    setFrameReady(false);

    void getPdf()
      .then((result) => {
        if (active) {
          setBlob(result);
        }
      })
      .catch((error) => {
        if (active) {
          setError(getApiErrorMessage(error, "No se pudo abrir el PDF."));
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [getPdf, isOpen]);

  const objectUrl = useMemo(() => {
    if (!blob) {
      return null;
    }

    return URL.createObjectURL(blob);
  }, [blob]);

  useEffect(() => {
    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [objectUrl]);

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      title={title}
      description={description}
      onClose={onClose}
      size="xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (onDownloadPdf) {
                onDownloadPdf();
                return;
              }
              if (blob) {
                downloadBlob(blob, fileName);
              }
            }}
            disabled={!blob || loading}
          >
            Descargar PDF
          </Button>
          {onDownloadExcel ? (
            <Button variant="outline" onClick={onDownloadExcel} disabled={!blob || loading}>
              Descargar Excel
            </Button>
          ) : null}
          {allowPrint ? (
            <Button variant="outline" onClick={() => frameRef.current?.contentWindow?.print()}
              disabled={!blob || loading || !frameReady}>
              Imprimir
            </Button>
          ) : null}
          {pagination ? (
            <>
              <Button variant="ghost" onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}>Anterior</Button>
              <span className="px-2 text-sm">Pagina {pagination.page} / {pagination.totalPages || 1}</span>
              <Button variant="ghost" onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.totalPages}>Siguiente</Button>
            </>
          ) : null}
        </>
      }
    >
      <div className="min-h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        {loading ? (
          <div className="flex h-[520px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            Generando vista previa del PDF...
          </div>
        ) : error ? (
          <div className="flex h-[520px] items-center justify-center px-6 text-center text-sm text-rose-600">
            {error}
          </div>
        ) : objectUrl ? (
          <iframe
            ref={frameRef}
            onLoad={() => setFrameReady(true)}
            src={objectUrl}
            title={title}
            className="h-[520px] w-full bg-white"
          />
        ) : (
          <div className="flex h-[520px] items-center justify-center text-sm text-slate-500 dark:text-slate-400">
            No fue posible cargar el archivo.
          </div>
        )}
      </div>
    </Modal>
  );
};
