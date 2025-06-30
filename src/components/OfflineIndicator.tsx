import { Wifi, WifiOff } from "lucide-react";
import { useEffect, useState } from "react";

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showIndicator, setShowIndicator] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowIndicator(true);
      // Hide after 3 seconds
      setTimeout(() => setShowIndicator(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setShowIndicator(true);
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Show indicator initially if offline
    if (!navigator.onLine) {
      setShowIndicator(true);
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (!showIndicator) return null;

  return (
    <div
      className={`fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300`}
    >
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium shadow-lg ${
          isOnline
            ? "bg-green-100 text-green-800 border border-green-200"
            : "bg-red-100 text-red-800 border border-red-200"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={16} />
            <span>Back online</span>
          </>
        ) : (
          <>
            <WifiOff size={16} />
            <span>Offline mode</span>
          </>
        )}
      </div>
    </div>
  );
}
