// Enhanced wallet connection with comprehensive error handling and cross-platform support
let isConnected = false;
let connectedAccount = null;
let connectionAttempts = 0;
let maxConnectionAttempts = 3;
let eventListenersAdded = false;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
let isAndroid = /Android/.test(navigator.userAgent);
let touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Format address helper with validation
function formatAddress(address) {
  if (!address || typeof address !== 'string') return '';
  if (address.length < 10) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

// Safe DOM element getter
function safeGetElement(id) {
  const element = document.getElementById(id);
  if (!element) {
    console.warn(`Element with ID '${id}' not found`);
  }
  return element;
}

// Main wallet connection function with enhanced error handling
async function connectWallet() {
  const statusEl = safeGetElement("status");
  
  // Enhanced wallet detection for mobile devices
  if (!window.ethereum) {
    let errorMessage = "No Ethereum wallet found. ";
    
    if (isMobile) {
      if (isIOS) {
        errorMessage += "Please install MetaMask mobile app or use Safari with a Web3 wallet extension.";
      } else if (isAndroid) {
        errorMessage += "Please install MetaMask mobile app or use Chrome/Firefox with Web3 wallet support.";
      } else {
        errorMessage += "Please install a mobile Web3 wallet like MetaMask.";
      }
    } else {
      errorMessage += "Please install MetaMask or another Web3 wallet extension.";
    }
    
    if (statusEl) {
      statusEl.innerText = errorMessage;
      statusEl.className = "error mobile-friendly";
    }
    return;
  }

  if (connectionAttempts >= maxConnectionAttempts) {
    if (statusEl) {
      statusEl.innerText = "Maximum connection attempts reached. Please refresh the page.";
    }
    return;
  }

  connectionAttempts++;

  try {
    // Add loading state with mobile-specific messaging
    if (statusEl) {
      const loadingMsg = isMobile ? "Opening wallet app..." : "Connecting wallet...";
      statusEl.innerText = loadingMsg;
      statusEl.className = "connecting";
    }

    // Increased timeout for mobile devices
    const timeoutDuration = isMobile ? 15000 : 10000;
    
    const accounts = await Promise.race([
      window.ethereum.request({ method: "eth_requestAccounts" }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), timeoutDuration)
      )
    ]);

    if (!accounts || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your wallet.");
    }

    connectedAccount = accounts[0];
    isConnected = true;
    connectionAttempts = 0; // Reset on success
    
    // Add event listeners only once
    if (!eventListenersAdded && window.ethereum) {
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('disconnect', handleDisconnect);
      eventListenersAdded = true;
    }

    updateConnectionUI();

    // Get network info with timeout
    try {
      const chainId = await Promise.race([
        window.ethereum.request({ method: 'eth_chainId' }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network info timeout')), 5000)
        )
      ]);
      updateNetworkInfo(chainId);
    } catch (networkError) {
      console.warn('Could not get network info:', networkError);
    }

  } catch (error) {
    console.error("Connection error:", error);
    
    if (statusEl) {
      statusEl.className = "error mobile-friendly";
      
      // Enhanced error messages for different platforms
      if (error.code === 4001) {
        statusEl.innerText = isMobile ? 
          "Connection cancelled. Please try again and approve in your wallet app." :
          "Connection rejected by user.";
      } else if (error.code === -32002) {
        statusEl.innerText = isMobile ?
          "Wallet request pending. Please check your wallet app." :
          "Connection request already pending. Please check your wallet.";
      } else if (error.message === 'Connection timeout') {
        statusEl.innerText = isMobile ?
          "Connection timed out. Please ensure your wallet app is running." :
          "Connection timed out. Please try again.";
      } else if (error.code === -32603) {
        statusEl.innerText = "Internal wallet error. Please restart your wallet and try again.";
      } else {
        const safeErrorMsg = (error.message || "Unknown error").substring(0, 100);
        statusEl.innerText = `Connection failed: ${safeErrorMsg}`;
      }
    }
    
    // Auto-retry for certain errors with exponential backoff
    if (error.code !== 4001 && connectionAttempts < maxConnectionAttempts) {
      const retryDelay = Math.pow(2, connectionAttempts) * 1000; // Exponential backoff
      setTimeout(() => {
        if (statusEl) statusEl.innerText = "Retrying connection...";
      }, retryDelay);
    }
  }
}

function disconnectWallet() {
  isConnected = false;
  connectedAccount = null;
  connectionAttempts = 0;
  
  updateConnectionUI();

  // Safely remove event listeners
  if (window.ethereum && eventListenersAdded) {
    try {
      window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum.removeListener('chainChanged', handleChainChanged);
      window.ethereum.removeListener('disconnect', handleDisconnect);
      eventListenersAdded = false;
    } catch (error) {
      console.warn('Error removing event listeners:', error);
    }
  }
  
  const statusEl = safeGetElement("status");
  if (statusEl) {
    statusEl.className = "";
  }
}

function updateConnectionUI() {
  const connectButton = safeGetElement("connect-button");
  const status = safeGetElement("status");
  const accountInfo = safeGetElement("account-info");
  const networkInfo = safeGetElement("network-info");

  if (isConnected && connectedAccount) {
    if (connectButton) {
      connectButton.innerHTML = `
        <button onclick="disconnectWallet()" class="disconnect-btn">Disconnect Wallet</button>
      `;
    }
    
    if (status) {
      status.innerHTML = `✅ Wallet Connected`;
      status.className = "connected";
    }

    if (accountInfo) {
      accountInfo.innerHTML = `
        <div class="wallet-info">
          <div><strong>Address:</strong> ${formatAddress(connectedAccount)}</div>
        </div>
      `;
    }
  } else {
    if (connectButton) {
      connectButton.innerHTML = `
        <button onclick="connectWallet()" class="connect-btn">Connect Wallet</button>
      `;
    }
    
    if (status) {
      status.innerText = "No wallet connected";
      status.className = "";
    }
    
    if (accountInfo) {
      accountInfo.innerHTML = "";
    }
    
    if (networkInfo) {
      networkInfo.innerHTML = "";
    }
  }
}

function updateNetworkInfo(chainId) {
  const networkInfo = safeGetElement("network-info");
  if (!networkInfo) return;

  try {
    const chainIdDecimal = parseInt(chainId, 16);
    
    if (isNaN(chainIdDecimal)) {
      console.warn('Invalid chain ID:', chainId);
      return;
    }

    const networks = {
      1: 'Ethereum Mainnet',
      137: 'Polygon',
      10: 'Optimism',
      42161: 'Arbitrum One',
      8453: 'Base',
      11155111: 'Sepolia Testnet',
      56: 'BNB Smart Chain',
      43114: 'Avalanche'
    };

    const networkName = networks[chainIdDecimal] || `Chain ID: ${chainIdDecimal}`;
    const isTestnet = [11155111, 5, 4, 3, 1].includes(chainIdDecimal) === false;

    networkInfo.innerHTML = `
      <div class="network-info">
        <div><strong>Network:</strong> ${networkName}</div>
        ${isTestnet ? '<div class="network-warning">⚠️ Testnet</div>' : ''}
      </div>
    `;
  } catch (error) {
    console.error('Error updating network info:', error);
    networkInfo.innerHTML = `
      <div class="network-info">
        <div><strong>Network:</strong> Unknown</div>
      </div>
    `;
  }
}

function handleAccountsChanged(accounts) {
  if (accounts.length === 0) {
    disconnectWallet();
  } else if (accounts[0] !== connectedAccount) {
    connectedAccount = accounts[0];
    updateConnectionUI();
  }
}

function handleChainChanged(chainId) {
  try {
    updateNetworkInfo(chainId);
    // Refresh connection state on chain change
    if (isConnected) {
      setTimeout(checkExistingConnection, 1000);
    }
  } catch (error) {
    console.error('Error handling chain change:', error);
  }
}

function handleDisconnect(error) {
  console.log('Wallet disconnected:', error);
  disconnectWallet();
}

// Check if already connected on page load
async function checkExistingConnection() {
  if (window.ethereum) {
    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (accounts.length > 0) {
        connectedAccount = accounts[0];
        isConnected = true;
        updateConnectionUI();

        // Set up event listeners
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        // Get network info
        const chainId = await window.ethereum.request({ method: 'eth_chainId' });
        updateNetworkInfo(chainId);
      }
    } catch (error) {
      console.error("Error checking existing connection:", error);
    }
  }
}

// Quest management
let questManager;
let questForm;

// Default quests data
window.defaultQuests = [
  {
    id: 1,
    title: "Promote Fluxora on Twitter",
    description: "Post about Fluxora and tag us to earn 0.01 ETH!",
    reward: "0.01",
    status: "open"
  },
  {
    id: 2,
    title: "Find a Bug",
    description: "Report any UI or code bugs to earn 0.005 ETH!",
    reward: "0.005",
    status: "open"
  },
  {
    id: 3,
    title: "Refer a Friend",
    description: "Invite someone to complete a quest and earn 0.008 ETH!",
    reward: "0.008",
    status: "open"
  }
];

// Premium loading screen with fallback
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    // Reduce loading time and add fallback
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 300);
    }, 800); // Reduced from 2000ms to 800ms
  }
}

// Fallback to force hide loading screen if it gets stuck
function forceHideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen && loadingScreen.style.display !== 'none') {
    loadingScreen.style.display = 'none';
    console.log('Force hidden loading screen');
  }
}

// Initialize the app with error handling and platform detection
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Platform-specific initialization
    initializePlatformFeatures();
    
    // Hide loading screen after content loads
    hideLoadingScreen();
    
    // Force hide loading screen after 3 seconds if it's still visible
    setTimeout(forceHideLoadingScreen, 3000);
    
    const statusEl = safeGetElement('status');
    if (statusEl) {
      const readyMsg = isMobile ? 
        'Ready to connect wallet app...' : 
        'Ready to connect wallet...';
      statusEl.textContent = readyMsg;
    }
    
    updateConnectionUI();
    checkExistingConnection();
    
    // Initialize quest system with error handling
    try {
      if (typeof QuestManager !== 'undefined') {
        questManager = new QuestManager();
        questManager.initializeDefaultQuests();
      }
    } catch (questError) {
      console.warn('Quest system not available:', questError);
    }
    
    // Initialize bubble experience with error handling
    try {
      bubbleExperience = new BubbleExperience();
    } catch (bubbleError) {
      console.warn('Bubble experience initialization failed:', bubbleError);
    }
    
    // Initialize mouse input system with error handling
    try {
      mouseInput = new MouseInput();
    } catch (mouseError) {
      console.warn('Mouse input initialization failed:', mouseError);
    }
    
    // Add smooth scroll behavior
    if (document.documentElement) {
      document.documentElement.style.scrollBehavior = 'smooth';
    }
    
    // Add global error handler
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      // Don't let errors block the UI
      forceHideLoadingScreen();
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      event.preventDefault(); // Prevent crash
      // Don't let promise rejections block the UI
      forceHideLoadingScreen();
    });
    
  } catch (error) {
    console.error('Error during initialization:', error);
    // Force hide loading screen on any initialization error
    forceHideLoadingScreen();
  }
});

// Enhanced connection UI with quest form
function updateConnectionUI() {
  const connectButton = document.getElementById("connect-button");
  const status = document.getElementById("status");
  const accountInfo = document.getElementById("account-info");
  const networkInfo = document.getElementById("network-info");
  const questFormContainer = document.getElementById("quest-form-container");

  if (isConnected && connectedAccount) {
    connectButton.innerHTML = `
      <button onclick="disconnectWallet()">Disconnect Wallet</button>
    `;
    status.innerHTML = `✅ Wallet Connected`;
    status.className = "connected";

    accountInfo.innerHTML = `
      <div class="wallet-info">
        <div><strong>Address:</strong> ${formatAddress(connectedAccount)}</div>
      </div>
    `;

    // Show quest form when wallet is connected
    questFormContainer.style.display = 'block';
    if (!questForm) {
      questForm = new PostQuestForm('quest-form-container', (questData) => {
        questManager.addQuest(questData);
      });
    }
  } else {
    connectButton.innerHTML = `
      <button onclick="connectWallet()">Connect Wallet</button>
    `;
    status.innerText = "No wallet connected";
    status.className = "";
    accountInfo.innerHTML = "";
    networkInfo.innerHTML = "";
    
    // Hide quest form when wallet is disconnected
    questFormContainer.style.display = 'none';
  }
}

// Platform-specific initialization with performance optimization
function initializePlatformFeatures() {
  try {
    // Add platform-specific CSS classes
    document.body.classList.add(isMobile ? 'mobile' : 'desktop');
    if (isIOS) document.body.classList.add('ios');
    if (isAndroid) document.body.classList.add('android');
    if (touchSupported) document.body.classList.add('touch-device');
    
    // Auto-detect low performance devices
    const isLowPerformance = detectLowPerformanceDevice();
    if (isLowPerformance) {
      document.body.classList.add('low-performance-mode');
      optimizeForPerformance();
    }
    
    // Auto-adjust viewport based on device
    const viewport = document.querySelector('meta[name="viewport"]');
    if (viewport) {
      if (isMobile) {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=3.0, user-scalable=yes, viewport-fit=cover'
        );
      } else {
        viewport.setAttribute('content', 
          'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes'
        );
      }
    }
    
    // Add zoom detection and handling
    setupZoomHandling();
    
    // Add touch-friendly hover effects for mobile
    if (touchSupported) {
      document.addEventListener('touchstart', function() {}, true);
    }
    
    // Handle orientation changes on mobile
    if (isMobile && window.DeviceOrientationEvent) {
      window.addEventListener('orientationchange', handleOrientationChange);
    }
    
    // Add network status monitoring
    if ('onLine' in navigator) {
      window.addEventListener('online', handleNetworkChange);
      window.addEventListener('offline', handleNetworkChange);
    }
    
    // Auto-adjust for device capabilities
    adjustForDeviceCapabilities();
    
  } catch (error) {
    console.warn('Platform initialization error:', error);
  }
}

// Setup zoom detection and handling
function setupZoomHandling() {
  try {
    let zoomLevel = 1;
    let isZoomed = false;
    
    function detectZoom() {
      const newZoomLevel = Math.round((window.outerWidth / window.innerWidth) * 100) / 100;
      
      if (Math.abs(newZoomLevel - zoomLevel) > 0.1) {
        zoomLevel = newZoomLevel;
        const wasZoomed = isZoomed;
        isZoomed = zoomLevel > 1.1 || zoomLevel < 0.9;
        
        if (isZoomed !== wasZoomed) {
          document.body.classList.toggle('zoomed', isZoomed);
          
          // Disable animations when zoomed to prevent blinking
          if (isZoomed) {
            document.body.style.setProperty('--animation-state', 'paused');
          } else {
            document.body.style.setProperty('--animation-state', 'running');
          }
        }
      }
    }
    
    // Monitor zoom changes
    window.addEventListener('resize', detectZoom);
    window.addEventListener('orientationchange', () => {
      setTimeout(detectZoom, 500);
    });
    
    // Initial detection
    detectZoom();
    
  } catch (error) {
    console.warn('Zoom handling setup error:', error);
  }
}

// Auto-adjust for device capabilities
function adjustForDeviceCapabilities() {
  try {
    // Detect device performance level
    const isLowEndDevice = navigator.hardwareConcurrency <= 2 || 
                          (navigator.deviceMemory && navigator.deviceMemory <= 2);
    


// Performance detection and optimization
function detectLowPerformanceDevice() {
  try {
    // Check for low-end device indicators
    const lowCPU = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
    const lowRAM = navigator.deviceMemory && navigator.deviceMemory <= 2;
    const slowConnection = navigator.connection && 
                          (navigator.connection.effectiveType === 'slow-2g' || 
                           navigator.connection.effectiveType === '2g');
    const oldDevice = /Android [1-4]/.test(navigator.userAgent) || 
                     /iPhone OS [1-9]_/.test(navigator.userAgent);
    
    return lowCPU || lowRAM || slowConnection || oldDevice;
  } catch (error) {
    console.warn('Performance detection error:', error);
    return false;
  }
}

function optimizeForPerformance() {
  try {
    // Remove floating elements
    const floatingElements = document.querySelectorAll('.floating-f');
    floatingElements.forEach(el => el.style.display = 'none');
    
    // Simplify animations
    const style = document.createElement('style');
    style.textContent = `
      .low-performance-mode * {
        animation-duration: 0s !important;
        transition-duration: 0.1s !important;
      }
      .low-performance-mode .feature-card {
        backdrop-filter: none !important;
        background: rgba(15, 23, 42, 0.95) !important;
      }
      .low-performance-mode .loading-screen {
        animation: none !important;
      }
    `;
    document.head.appendChild(style);
    
    // Reduce loading screen time
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
    
    console.log('Performance optimizations applied');
  } catch (error) {
    console.warn('Performance optimization error:', error);
  }
}

// Throttle scroll events for better performance
let scrollTimeout;
function handleScroll() {
  if (scrollTimeout
      
    // Automatically hide loading screen after page loads
document.addEventListener("DOMContentLoaded", function () {
  const loadingScreen = document.getElementById("loading-screen");
  if (loadingScreen) {
    loadingScreen.style.display = "none";
  }

  // You can also initialize quest manager or wallet here if needed
  if (typeof QuestManager !== "undefined") {
    const questManager = new QuestManager();
    window.questManager = questManager;
    questManager.initializeDefaultQuests();

    // Attach the post quest form
    new PostQuestForm("quest-form-container", (questData) => {
      questManager.addQuest(questData);
    });
  }
});

  document.addEventListener("DOMContentLoaded", function () {
  const loader = document.getElementById("loading-screen");
  if (loader) {
    loader.style.transition = "opacity 0.5s ease";
    loader.style.opacity = 0;
    setTimeout(() => {
      loader.style.display = "none";

      // Optional: reveal other sections
      const app = document.querySelector(".hero-section");
      if (app) app.style.display = "block";
    }, 500);
  } else {
    console.warn("⚠️ Loading screen not found.");
  }
});
  
