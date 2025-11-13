"use client";

import React, { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function ReceiptScanner({ onScanComplete }) {
  const fileInputRef = useRef(null);

  const [scanReceiptLoading, setScanReceiptLoading] = React.useState(false);
  let scannedData = null; // we don't keep hook state here — outcome returned from fetch

  const handleReceiptScan = async (file) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size should be less than 5MB");
      return;
    }
    const formData = new FormData();
    formData.append("file", file);
    setScanReceiptLoading(true);
    // Show loading toast and update it once we have a result
    const tId = toast.loading("Scanning receipt...");
    try {
      const res = await fetch("/api/scan-receipt", { method: "POST", body: formData });
      console.log("[ReceiptScanner] fetch status:", res.status, "content-type:", res.headers.get('content-type'));
      let json = null;
      try {
        json = await res.json();
      } catch (parseErr) {
        const text = await res.text();
        console.error('[ReceiptScanner] failed to parse JSON response, raw text:', text);
        toast.error('Scan failed: invalid JSON response from server. See console for details.', { id: tId });
        return;
      }

      console.log("[ReceiptScanner] scan response (fetch):", json);

      if (json && typeof json === 'object' && Object.keys(json).length === 0) {
        console.error('[ReceiptScanner] scan failed: server returned empty object {}', { status: res.status, json });
        toast.error('Scan failed: server returned empty response. Check server logs.', { id: tId });
        return;
      }

      if (!json) {
        toast.error("No response from server", { id: tId });
        console.error("[ReceiptScanner] empty response from /api/scan-receipt");
        return;
      }

      if (json.success) {
        toast.success("Receipt scanned successfully", { id: tId });
        try {
          onScanComplete?.(json.data);
        } catch (err) {
          console.error("Error in onScanComplete handler:", err);
        }
      } else {
        const msg = json.error || json.message || "Failed to scan the receipt";
        toast.error(msg, { id: tId });
        console.error("[ReceiptScanner] scan failed:", json);
      }
    } catch (err) {
      toast.error(err?.message || "Scan failed", { id: tId });
      console.error("[ReceiptScanner] scan exception:", err);
    } finally {
      setScanReceiptLoading(false);
    }
  };

  // We handle toasts and onScanComplete directly in handleReceiptScan so the
  // feedback is immediate and we avoid duplicate notifications.

  return (
    <div className="flex items-center gap-4">
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept="image/*"
        capture="environment"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleReceiptScan(file);
        }}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full h-10 bg-gradient-to-br from-orange-500 via-pink-500 to-purple-500 animate-gradient hover:opacity-90 transition-opacity text-white hover:text-white"
        onClick={() => fileInputRef.current?.click()}
        disabled={scanReceiptLoading}
      >
        {scanReceiptLoading ? (
          <>
            <Loader2 className="mr-2 animate-spin" />
            <span>Scanning Receipt...</span>
          </>
        ) : (
          <>
            <Camera className="mr-2" />
            <span>Scan Receipt with AI</span>
          </>
        )}
      </Button>
    </div>
  );
}