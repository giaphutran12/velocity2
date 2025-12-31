"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { refreshDeals } from "../actions";
import { toast } from "sonner";

interface RefreshDealsButtonProps {
  isAdmin: boolean;
  selectedBrokerId?: string;
}

export function RefreshDealsButton({
  isAdmin,
  selectedBrokerId,
}: RefreshDealsButtonProps) {
  const [isPending, startTransition] = useTransition();

  const handleRefresh = () => {
    startTransition(async () => {
      const brokerId = isAdmin ? selectedBrokerId : undefined;
      const result = await refreshDeals(brokerId);

      if (result.success) {
        toast.success(`Synced ${result.dealsSynced} deals`);
      } else {
        toast.error(result.message);
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleRefresh}
      disabled={isPending}
    >
      <RefreshCw
        className={`h-4 w-4 mr-2 ${isPending ? "animate-spin" : ""}`}
      />
      {isPending ? "Syncing..." : "Refresh"}
    </Button>
  );
}
