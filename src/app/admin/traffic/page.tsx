import { Activity } from "lucide-react";
import TrafficDashboard from "@/components/admin/traffic/TrafficDashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Traffic Manager" };

export default function TrafficPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Activity className="h-6 w-6 text-primary" /> Traffic Manager
        </h1>
        <p className="text-sm text-muted-foreground">
          Live requests, visitors and their devices as they reach the server.
        </p>
      </div>
      <TrafficDashboard />
    </div>
  );
}
