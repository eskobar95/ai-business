"use client";

import { Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { TemplatePreviewModal } from "@/components/dashboard/template-preview-modal";
import type { TemplatePreview } from "@/lib/templates/get-template-preview";

export function SetupBanner({
  businessId,
  preview,
  previewError,
}: {
  businessId: string;
  preview: TemplatePreview | null;
  previewError: string | null;
}) {
  const storageKey = `setup-banner-dismissed-${businessId}`;
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      if (typeof localStorage !== "undefined" && localStorage.getItem(storageKey) === "1") {
        setDismissed(true);
      }
    } catch {
      /* storage blocked */
    }
  }, [storageKey]);

  function dismiss(): void {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  }

  if (!mounted || dismissed) return null;

  return (
    <>
      <div className="rounded-lg border border-primary/35 bg-gradient-to-br from-primary/10 via-card to-card p-4 shadow-md">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/15">
              <Sparkles className="size-4 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-foreground">Set up your AI team</h2>
              <p className="mt-1 max-w-xl text-[12px] leading-relaxed text-muted-foreground">
                Deploy your enterprise agent team in one click — Product and Build streams ready to go.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2 self-end sm:self-start">
            <Button
              type="button"
              size="sm"
              className="cursor-pointer gap-1.5"
              onClick={() => setModalOpen(true)}
              data-testid="setup-banner-cta"
            >
              Preview &amp; Activate
            </Button>
            <button
              type="button"
              onClick={dismiss}
              className="cursor-pointer rounded-md p-2 text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"
              aria-label="Dismiss setup banner"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>
      </div>
      <TemplatePreviewModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        businessId={businessId}
        preview={preview}
        previewError={previewError}
      />
    </>
  );
}
