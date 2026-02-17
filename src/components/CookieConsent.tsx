import { useState, useEffect } from "react";
import { Button } from "@/ui/button";
import { X, Cookie, Shield, Info } from "lucide-react";

interface CookieConsentProps {
  onConsent?: (consents: Record<string, boolean>) => void;
  className?: string;
}

export function CookieConsent({ onConsent, className }: CookieConsentProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [consents, setConsents] = useState({
    necessary: true, // Always enabled
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    try {
      // SECURITY: Validate and sanitize stored consent data
      const hasConsented = localStorage.getItem("cookie-consent");
      if (!hasConsented) {
        setIsVisible(true);
      } else {
        // SECURITY: Validate JSON structure and sanitize input
        const savedConsents = JSON.parse(hasConsented);
        if (typeof savedConsents === "object" && savedConsents !== null) {
          // SECURITY: Ensure only expected properties exist
          const sanitizedConsents = {
            necessary: Boolean(savedConsents.necessary),
            analytics: Boolean(savedConsents.analytics),
            marketing: Boolean(savedConsents.marketing),
            functional: Boolean(savedConsents.functional),
          };
          setConsents(sanitizedConsents);
        } else {
          // SECURITY: Clear corrupted data
          localStorage.removeItem("cookie-consent");
          setIsVisible(true);
        }
      }
    } catch (error) {
      // SECURITY: Don't expose error details, clear corrupted data
      console.warn("Invalid consent data found, resetting");
      localStorage.removeItem("cookie-consent");
      setIsVisible(true);
    }
  }, []);

  const handleAcceptAll = () => {
    const allConsents = {
      necessary: true,
      analytics: true,
      marketing: true,
      functional: true,
    };
    setConsents(allConsents);
    // SECURITY: Validate before storage
    try {
      localStorage.setItem("cookie-consent", JSON.stringify(allConsents));
      setIsVisible(false);
      onConsent?.(allConsents);
    } catch (error) {
      console.error("Failed to save consent preferences");
    }
  };

  const handleAcceptNecessary = () => {
    const necessaryConsents = {
      necessary: true,
      analytics: false,
      marketing: false,
      functional: false,
    };
    setConsents(necessaryConsents);
    // SECURITY: Validate before storage
    try {
      localStorage.setItem("cookie-consent", JSON.stringify(necessaryConsents));
      setIsVisible(false);
      onConsent?.(necessaryConsents);
    } catch (error) {
      console.error("Failed to save consent preferences");
    }
  };

  const handleSavePreferences = () => {
    // SECURITY: Validate consent state before saving
    try {
      const validatedConsents = {
        necessary: Boolean(consents.necessary),
        analytics: Boolean(consents.analytics),
        marketing: Boolean(consents.marketing),
        functional: Boolean(consents.functional),
      };
      localStorage.setItem("cookie-consent", JSON.stringify(validatedConsents));
      setIsVisible(false);
      onConsent?.(validatedConsents);
    } catch (error) {
      console.error("Failed to save consent preferences");
    }
  };

  const handleConsentChange = (type: string, value: boolean) => {
    if (type === "necessary") return; // Cannot disable necessary cookies
    setConsents((prev) => ({ ...prev, [type]: value }));
  };

  if (!isVisible) return null;

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-background border-t shadow-lg z-50 ${className}`}
    >
      <div className="container mx-auto p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <Cookie className="h-6 w-6 text-primary mt-1" />
              <div>
                <h3 className="font-semibold text-lg">We Value Your Privacy</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  We use cookies and similar technologies to help personalize
                  content, tailor and measure ads, and provide a better
                  experience. By clicking accept, you agree to this, as outlined
                  in our Cookie Policy.
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsVisible(false)}
              className="ml-4"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {!showDetails ? (
            /* Simple view */
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <Button onClick={handleAcceptAll} className="w-full sm:w-auto">
                Accept All
              </Button>
              <Button
                variant="outline"
                onClick={handleAcceptNecessary}
                className="w-full sm:w-auto"
              >
                Accept Necessary Only
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowDetails(true)}
                className="w-full sm:w-auto"
              >
                Customize Preferences
              </Button>
            </div>
          ) : (
            /* Detailed view */
            <div className="space-y-6">
              {/* Cookie Categories */}
              <div className="grid md:grid-cols-2 gap-4">
                {/* Necessary Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Necessary Cookies</h4>
                    <input
                      type="checkbox"
                      checked={consents.necessary}
                      disabled
                      className="h-4 w-4 ml-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Essential for the website to function properly, including
                    authentication and security features. These cannot be
                    disabled.
                  </p>
                </div>

                {/* Analytics Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Analytics Cookies</h4>
                    <input
                      type="checkbox"
                      checked={consents.analytics}
                      onChange={(e) =>
                        handleConsentChange("analytics", e.target.checked)
                      }
                      className="h-4 w-4 ml-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Help us understand how visitors interact with our website by
                    collecting and reporting information anonymously.
                  </p>
                </div>

                {/* Marketing Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Marketing Cookies</h4>
                    <input
                      type="checkbox"
                      checked={consents.marketing}
                      onChange={(e) =>
                        handleConsentChange("marketing", e.target.checked)
                      }
                      className="h-4 w-4 ml-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Used to track visitors across websites to display relevant
                    ads and marketing campaigns.
                  </p>
                </div>

                {/* Functional Cookies */}
                <div className="border rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Info className="h-4 w-4 text-primary" />
                    <h4 className="font-medium">Functional Cookies</h4>
                    <input
                      type="checkbox"
                      checked={consents.functional}
                      onChange={(e) =>
                        handleConsentChange("functional", e.target.checked)
                      }
                      className="h-4 w-4 ml-auto"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enable enhanced functionality and personalization, such as
                    remembering your preferences and settings.
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleSavePreferences}
                  className="w-full sm:w-auto"
                >
                  Save My Preferences
                </Button>
                <Button
                  variant="outline"
                  onClick={handleAcceptAll}
                  className="w-full sm:w-auto"
                >
                  Accept All
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setShowDetails(false)}
                  className="w-full sm:w-auto"
                >
                  Cancel
                </Button>
              </div>

              {/* Links */}
              <div className="text-xs text-muted-foreground">
                <p>
                  Learn more in our{" "}
                  <a href="/privacy" className="underline hover:text-primary">
                    Privacy Policy
                  </a>{" "}
                  and{" "}
                  <a href="/terms" className="underline hover:text-primary">
                    Cookie Policy
                  </a>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Hook to check if user has given consent for specific cookie types
export function useCookieConsent() {
  const [consents, setConsents] = useState({
    necessary: true,
    analytics: false,
    marketing: false,
    functional: false,
  });

  useEffect(() => {
    try {
      const savedConsents = localStorage.getItem("cookie-consent");
      if (savedConsents) {
        setConsents(JSON.parse(savedConsents));
      }
    } catch (error) {
      console.error("Error reading cookie consents:", error);
    }
  }, []);

  const hasConsent = (type: keyof typeof consents) => consents[type];

  return {
    consents,
    hasConsent,
    canUseAnalytics: consents.analytics,
    canUseMarketing: consents.marketing,
    canUseFunctional: consents.functional,
  };
}
