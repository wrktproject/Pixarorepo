/**
 * Ad Network Integration
 * Handles Google AdSense integration with lazy loading and ad blocker detection
 */

export interface AdNetworkConfig {
  publisherId: string;
  testMode?: boolean;
}

export interface AdUnit {
  adSlot: string;
  adClient: string;
  adFormat?: string;
  fullWidthResponsive?: boolean;
}

class AdNetworkManager {
  private static instance: AdNetworkManager;
  private isScriptLoaded = false;
  private isScriptLoading = false;
  private scriptLoadPromise: Promise<boolean> | null = null;
  private adBlockerDetected = false;
  private config: AdNetworkConfig | null = null;

  private constructor() {}

  static getInstance(): AdNetworkManager {
    if (!AdNetworkManager.instance) {
      AdNetworkManager.instance = new AdNetworkManager();
    }
    return AdNetworkManager.instance;
  }

  /**
   * Initialize the ad network with configuration
   */
  initialize(config: AdNetworkConfig): void {
    this.config = config;
  }

  /**
   * Detect if ad blocker is present
   */
  async detectAdBlocker(): Promise<boolean> {
    if (this.adBlockerDetected) {
      return true;
    }

    try {
      // Try to load a test ad script
      const testAd = document.createElement('div');
      testAd.className = 'adsbygoogle';
      testAd.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;';
      document.body.appendChild(testAd);

      // Wait a bit to see if it gets blocked
      await new Promise((resolve) => setTimeout(resolve, 100));

      const isBlocked =
        testAd.offsetHeight === 0 ||
        window.getComputedStyle(testAd).display === 'none';

      document.body.removeChild(testAd);

      this.adBlockerDetected = isBlocked;
      return isBlocked;
    } catch (error) {
      console.warn('Ad blocker detection failed:', error);
      return false;
    }
  }

  /**
   * Load AdSense script lazily
   */
  async loadAdScript(): Promise<boolean> {
    if (this.isScriptLoaded) {
      return true;
    }

    if (this.isScriptLoading && this.scriptLoadPromise) {
      return this.scriptLoadPromise;
    }

    this.isScriptLoading = true;

    this.scriptLoadPromise = new Promise((resolve) => {
      try {
        // Check for ad blocker first
        this.detectAdBlocker().then((blocked) => {
          if (blocked) {
            console.info('Ad blocker detected - ads will not be displayed');
            this.isScriptLoading = false;
            resolve(false);
            return;
          }

          // Load AdSense script
          const script = document.createElement('script');
          script.async = true;
          script.crossOrigin = 'anonymous';
          
          // Use test mode or production
          if (this.config?.testMode) {
            // For development/testing, use a placeholder
            script.src = 'about:blank';
            script.onload = () => {
              console.info('Ad network in test mode');
              this.isScriptLoaded = true;
              this.isScriptLoading = false;
              resolve(true);
            };
          } else {
            // Production AdSense script
            script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${this.config?.publisherId}`;
            script.onload = () => {
              this.isScriptLoaded = true;
              this.isScriptLoading = false;
              resolve(true);
            };
          }

          script.onerror = () => {
            console.error('Failed to load ad network script');
            this.isScriptLoading = false;
            resolve(false);
          };

          document.head.appendChild(script);
        });
      } catch (error) {
        console.error('Error loading ad script:', error);
        this.isScriptLoading = false;
        resolve(false);
      }
    });

    return this.scriptLoadPromise;
  }

  /**
   * Initialize an ad unit
   */
  async initializeAdUnit(element: HTMLElement, adUnit: AdUnit): Promise<boolean> {
    try {
      // Load script if not already loaded
      const scriptLoaded = await this.loadAdScript();
      if (!scriptLoaded) {
        return false;
      }

      // Check if ad blocker is active
      if (this.adBlockerDetected) {
        return false;
      }

      // Create ins element for AdSense
      const ins = document.createElement('ins');
      ins.className = 'adsbygoogle';
      ins.style.display = 'block';
      ins.setAttribute('data-ad-client', adUnit.adClient);
      ins.setAttribute('data-ad-slot', adUnit.adSlot);
      
      if (adUnit.adFormat) {
        ins.setAttribute('data-ad-format', adUnit.adFormat);
      }
      
      if (adUnit.fullWidthResponsive) {
        ins.setAttribute('data-full-width-responsive', 'true');
      }

      // Clear existing content
      element.innerHTML = '';
      element.appendChild(ins);

      // Push ad (only in production with real AdSense)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!this.config?.testMode && (window as any).adsbygoogle) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        } catch (error) {
          console.error('Error pushing ad:', error);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error initializing ad unit:', error);
      return false;
    }
  }

  /**
   * Check if ads are blocked
   */
  isAdBlocked(): boolean {
    return this.adBlockerDetected;
  }

  /**
   * Check if script is loaded
   */
  isLoaded(): boolean {
    return this.isScriptLoaded;
  }
}

export const adNetworkManager = AdNetworkManager.getInstance();
