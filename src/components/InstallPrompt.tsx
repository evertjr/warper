import { Download, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "react-aria-components";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Check if already installed
    const isStandalone = window.matchMedia(
      "(display-mode: standalone)",
    ).matches;
    const isInWebAppiOS = (window.navigator as any).standalone === true;
    setIsInstalled(isStandalone || isInWebAppiOS);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);

      // Show prompt after a short delay to not be intrusive
      setTimeout(() => {
        setShowPrompt(true);
      }, 3000);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;

      if (outcome === "accepted") {
        console.log("User accepted the install prompt");
      } else {
        console.log("User dismissed the install prompt");
      }
    } catch (error) {
      console.error("Error during installation:", error);
    } finally {
      setDeferredPrompt(null);
      setShowPrompt(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    // Don't show again for this session
    sessionStorage.setItem("installPromptDismissed", "true");
  };

  // Don't show if already installed, no prompt available, or dismissed this session
  if (
    isInstalled ||
    !deferredPrompt ||
    !showPrompt ||
    sessionStorage.getItem("installPromptDismissed")
  ) {
    return null;
  }

  return (
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-6 md:max-w-sm z-50">
      <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Download size={20} className="text-blue-600" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-medium text-gray-900 mb-1">
              Install Warper
            </h3>
            <p className="text-xs text-gray-600 mb-3">
              Install the app for faster access and offline editing
            </p>

            <div className="flex gap-2">
              <Button
                onPress={handleInstall}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              >
                Install
              </Button>
              <Button
                onPress={handleDismiss}
                className="px-3 py-1.5 text-gray-600 hover:text-gray-800 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded-md"
              >
                Not now
              </Button>
            </div>
          </div>

          <Button
            onPress={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 rounded"
            aria-label="Dismiss install prompt"
          >
            <X size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
