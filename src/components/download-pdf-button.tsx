import { useState } from "react";
import { Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function DownloadPdfButton({
  label = "Print",
  onDownload,
  variant = "outline",
  size = "sm",
}: {
  label?: string;
  onDownload: () => Promise<void>;
  variant?: "default" | "secondary" | "outline" | "ghost";
  size?: "default" | "sm";
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void onDownload()
          .catch((err) => toast.error(err instanceof Error ? err.message : "Could not create PDF."))
          .finally(() => setBusy(false));
      }}
    >
      <Printer />
      {busy ? "Preparing…" : label}
    </Button>
  );
}
