"use client";

import { useState, useEffect } from "react";

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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ syncLocations: true }),
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

  // 🔥 Auto hide message after 3 seconds
  useEffect(() => {
    if (!result) return;

    const timer = setTimeout(() => {
      setResult(null);
    }, 3000);

    return () => clearTimeout(timer);
  }, [result]);

  return (
    <div className="w-full md:w-auto">
      <div className="flex items-center gap-3">
        <button
          onClick={handleSync}
          disabled={loading}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
            loading
              ? "bg-gray-300 cursor-not-allowed text-gray-700"
              : "bg-gradient-to-r from-teal-500 to-indigo-600 text-white shadow-lg hover:opacity-95"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
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
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                ></path>
              </svg>
              Syncing...
            </span>
          ) : (
            <span>🔄 Sync Telegram Users</span>
          )}
        </button>
      </div>

      {result && (
        <div
          className={`mt-3 p-4 rounded-lg ${
            result.success
              ? "bg-green-50 border border-green-200"
              : "bg-red-50 border border-red-200"
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
