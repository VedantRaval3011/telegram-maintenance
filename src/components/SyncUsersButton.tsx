"use client";

import { useState } from "react";

interface SyncMetrics {
  users: {
    created: number;
    updated: number;
    skipped: number;
    errors: number;
  };
  locations: {
    created: number;
    updated: number;
    skipped: number;
  };
}

interface SyncResponse {
  success: boolean;
  metrics?: SyncMetrics;
  duration?: number;
  timestamp?: string;
  error?: string;
  errorDetails?: Array<{ user: string; error: string }>;
}

export default function SyncUsersButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SyncResponse | null>(null);

  const handleSync = async () => {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/sync/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          syncLocations: true, // Also sync locations from tickets
        }),
      });

      const data: SyncResponse = await response.json();
      setResult(data);
    } catch (err) {
      setResult({
        success: false,
        error: err instanceof Error ? err.message : "Unknown error occurred",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <button
          onClick={handleSync}
          disabled={loading}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            loading
              ? "bg-gray-400 cursor-not-allowed"
              : "bg-blue-600 hover:bg-blue-700 text-white"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-5 w-5"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Syncing...
            </span>
          ) : (
            "🔄 Sync Telegram Users"
          )}
        </button>
      </div>

      {result && (
        <div
          className={`p-4 rounded-lg border ${
            result.success
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}
        >
          {result.success ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-semibold">
                <span>✓</span>
                <span>Sync Completed Successfully</span>
              </div>

              {result.metrics && (
                <div className="space-y-2 text-sm">
                  <div className="font-medium text-green-900">Users:</div>
                  <div className="grid grid-cols-2 gap-2 text-green-800">
                    <div>• Created: {result.metrics.users.created}</div>
                    <div>• Updated: {result.metrics.users.updated}</div>
                    <div>• Skipped: {result.metrics.users.skipped}</div>
                    <div>• Errors: {result.metrics.users.errors}</div>
                  </div>

                  <div className="font-medium text-green-900 mt-3">
                    Locations:
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-green-800">
                    <div>• Created: {result.metrics.locations.created}</div>
                    <div>• Updated: {result.metrics.locations.updated}</div>
                    <div>• Skipped: {result.metrics.locations.skipped}</div>
                  </div>

                  {result.duration && (
                    <div className="text-green-700 text-xs mt-2">
                      Duration: {result.duration}ms
                    </div>
                  )}
                </div>
              )}

              {result.errorDetails && result.errorDetails.length > 0 && (
                <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="text-yellow-800 font-medium text-sm mb-1">
                    Partial Errors:
                  </div>
                  <div className="text-xs text-yellow-700 space-y-1">
                    {result.errorDetails.map((err, idx) => (
                      <div key={idx}>
                        • {err.user}: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-red-800 font-semibold">
                <span>✗</span>
                <span>Sync Failed</span>
              </div>
              <div className="text-sm text-red-700">{result.error}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
