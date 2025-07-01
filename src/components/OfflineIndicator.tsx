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
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 transition-all duration-300 font-mono">
      <div
        className={`flex items-center gap-2 px-2 py-1 text-xs border ${
          isOnline
            ? "bg-black/90 text-yellow-400 border-yellow-400"
            : "bg-black/90 text-red-400 border-red-400"
        }`}
      >
        {isOnline ? (
          <>
            <Wifi size={12} />
            <span className="tracking-wider">ONLINE</span>
          </>
        ) : (
          <>
            <WifiOff size={12} />
            <span className="tracking-wider">OFFLINE</span>
          </>
        )}
      </div>
    </div>
  );
}
