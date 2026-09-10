import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { getPoolBackup } from "@/lib/pool/server";
import { downloadPoolBackupXlsx } from "@/lib/pool/excel";
import { Button } from "@/components/ui/button";

export function BackupButton({ size = "sm" }: { size?: "default" | "sm" }) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      size={size}
      disabled={busy}
      aria-label="Download Excel backup"
      onClick={() => {
        setBusy(true);
        void getPoolBackup()
          .then((backup) => downloadPoolBackupXlsx(backup))
          .then(() => toast.success("Excel backup downloaded."))
          .catch((err) => toast.error(err instanceof Error ? err.message : "Could not export."))
          .finally(() => setBusy(false));
      }}
    >
      <Download />
      {busy ? "Exporting…" : "Backup"}
    </Button>
  );
}
