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
    <div className="fixed bottom-20 left-4 right-4 md:left-auto md:right-4 md:max-w-xs z-50 font-mono">
      <div className="bg-black/90 border border-gray-700 p-3">
        <div className="flex items-start gap-2">
          <div className="flex-shrink-0 w-6 h-6 border border-yellow-400 flex items-center justify-center">
            <Download size={12} className="text-yellow-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="text-xs text-yellow-400 mb-1 tracking-wider">
              INSTALL APP
            </h3>
            <p className="text-xs text-gray-300 mb-2 leading-tight">
              Offline editing & faster access
            </p>

            <div className="flex gap-2">
              <Button
                onPress={handleInstall}
                className="px-2 py-1 bg-yellow-400 hover:bg-yellow-300 text-black text-xs tracking-wider transition-colors focus:outline-none"
              >
                INSTALL
              </Button>
              <Button
                onPress={handleDismiss}
                className="px-2 py-1 text-gray-400 hover:text-gray-300 text-xs tracking-wider transition-colors focus:outline-none"
              >
                SKIP
              </Button>
            </div>
          </div>

          <Button
            onPress={handleDismiss}
            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-300 transition-colors focus:outline-none"
            aria-label="Dismiss"
          >
            <X size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
