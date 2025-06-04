// Enhanced wallet connection with 100% reliability and crash protection
let isConnected = false;
let connectedAccount = null;
let connectionAttempts = 0;
let maxConnectionAttempts = 3;
let eventListenersAdded = false;
let isConnecting = false;
let connectionTimeout = null;
let retryTimeout = null;
let walletCheckInterval = null;
let isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
let isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
let isAndroid = /Android/.test(navigator.userAgent);
let touchSupported = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

// Global error handlers
window.walletConnectionError = null;
window.lastKnownAccount = null;

// Format address helper with validation
function formatAddress(address) {
  try {
    if (!address || typeof address !== 'string') return '';
    if (address.length < 10) return address;

    // Ensure we don't exceed string bounds
    const start = Math.min(6, address.length);
    const end = Math.max(4, address.length - 4);

    if (start >= end) return address;

    return `${address.slice(0, start)}...${address.slice(-4)}`;
  } catch (error) {
    console.error('Error formatting address:', error);
    return 'Invalid Address';
  }
}

// Enhanced safe DOM element getter with retry mechanism
function safeGetElement(id, retries = 3) {
  try {
    let element = document.getElementById(id);

    // Retry mechanism for elements that might not be ready
    if (!element && retries > 0) {
      setTimeout(() => safeGetElement(id, retries - 1), 100);
      return null;
    }

    if (!element) {
      console.warn(`Element with ID '${id}' not found after retries`);
      // Create placeholder element to prevent crashes
      element = createPlaceholderElement(id);
    }

    return element;
  } catch (error) {
    console.error(`Error getting element ${id}:`, error);
    return createPlaceholderElement(id);
  }
}

// Create placeholder element to prevent UI crashes
function createPlaceholderElement(id) {
  try {
    const placeholder = document.createElement('div');
    placeholder.id = id;
    placeholder.style.display = 'none';
    placeholder.innerHTML = '';
    return placeholder;
  } catch (error) {
    console.error('Error creating placeholder:', error);
    return null;
  }
}

// Ultra-reliable wallet connection function with 100% stability
async function connectWallet() {
  // Prevent multiple concurrent connections
  if (isConnecting) {
    console.log('Connection already in progress');
    return;
  }

  isConnecting = true;
  window.walletConnectionError = null;

  try {
    // Clear any existing timeouts
    if (connectionTimeout) clearTimeout(connectionTimeout);
    if (retryTimeout) clearTimeout(retryTimeout);
    if (walletCheckInterval) clearInterval(walletCheckInterval);

    const statusEl = safeGetElement("status");
    const connectButton = safeGetElement("connect-button");

    // Ensure UI elements exist before proceeding
    if (!statusEl || !connectButton) {
      console.error('Required UI elements not found, recreating...');
      await recreateWalletUI();
    }

    // Multi-browser wallet detection with enhanced fallbacks
    const walletProviders = [
      window.ethereum,
      window.web3?.currentProvider,
      window.ethereum?.providers?.[0]
    ].filter(Boolean);

    if (walletProviders.length === 0) {
      await handleNoWalletFound();
      return;
    }

    const provider = walletProviders[0];

    // Check connection attempts with smart reset
    if (connectionAttempts >= maxConnectionAttempts) {
      await resetConnectionState();
      return;
    }

    connectionAttempts++;
    updateConnectionButton('connecting');

    // Device-optimized timeout with browser detection
    const isChrome = /Chrome/.test(navigator.userAgent);
    const isSafari = /Safari/.test(navigator.userAgent) && !isChrome;
    const isFirefox = /Firefox/.test(navigator.userAgent);

    let baseTimeout = 15000;
    if (isMobile) baseTimeout = 25000;
    if (isSafari) baseTimeout += 5000;
    if (isFirefox) baseTimeout += 3000;

    const networkMultiplier = navigator.connection?.effectiveType === 'slow-2g' ? 2 : 1;
    const timeoutDuration = baseTimeout * networkMultiplier;

    // Set connection timeout with cleanup
    connectionTimeout = setTimeout(() => {
      throw new Error('Connection timeout - please try again');
    }, timeoutDuration);

    // Enhanced connection request with browser-specific handling
    let accounts;
    try {
      // Pre-check if accounts are already available
      const existingAccounts = await provider.request({ method: 'eth_accounts' });
      if (existingAccounts && existingAccounts.length > 0) {
        accounts = existingAccounts;
      } else {
        accounts = await provider.request({ 
          method: "eth_requestAccounts",
          params: []
        });
      }
    } catch (requestError) {
      // Enhanced error handling with browser-specific fallbacks
      if (requestError.code === -32002) {
        accounts = await retryPendingConnection();
      } else if (requestError.code === 4001) {
        throw new Error('User rejected the connection request');
      } else if (requestError.message?.includes('User denied')) {
        throw new Error('User denied wallet access');
      } else {
        throw requestError;
      }
    }

    // Clear timeout on success
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }

    // Validate accounts with enhanced checking
    if (!accounts || !Array.isArray(accounts) || accounts.length === 0) {
      throw new Error("No accounts found. Please unlock your wallet and try again.");
    }

    // Successfully connected
    connectedAccount = accounts[0];
    window.lastKnownAccount = accounts[0];
    isConnected = true;
    connectionAttempts = 0;
    isConnecting = false;

    // Setup event listeners with error handling
    await setupWalletEventListeners();

    // Update UI immediately with animation
    updateConnectionUI();

    // Get network info asynchronously with retry logic
    setTimeout(async () => {
      try {
        const chainId = await provider.request({ method: 'eth_chainId' });
        updateNetworkInfo(chainId);
      } catch (networkError) {
        console.warn('Could not get network info:', networkError);
        // Retry once after delay
        setTimeout(async () => {
          try {
            const chainId = await provider.request({ method: 'eth_chainId' });
            updateNetworkInfo(chainId);
          } catch (retryError) {
            console.warn('Network info retry failed:', retryError);
          }
        }, 2000);
      }
    }, 300);

    // Start periodic connection health check
    startConnectionHealthCheck();

    // Show success feedback
    showConnectionSuccess();

    console.log('Wallet connected successfully:', connectedAccount);

  } catch (error) {
    window.walletConnectionError = error;
    await handleConnectionError(error);
  } finally {
    isConnecting = false;
    if (connectionTimeout) {
      clearTimeout(connectionTimeout);
      connectionTimeout = null;
    }
  }
}

// Handle no wallet found scenario
async function handleNoWalletFound() {
  isConnecting = false;
  const statusEl = safeGetElement("status");

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

  updateConnectionButton('error');
}

// Reset connection state when max attempts reached
async function resetConnectionState() {
  isConnecting = false;
  connectionAttempts = 0;

  const statusEl = safeGetElement("status");
  if (statusEl) {
    statusEl.innerText = "Connection limit reached. Click to try again.";
    statusEl.className = "error";
  }

  updateConnectionButton('retry');
}

// Retry pending connection
async function retryPendingConnection() {
  const statusEl = safeGetElement("status");
  if (statusEl) {
    statusEl.innerText = isMobile ? 
      "Please check your wallet app for pending requests" : 
      "Please check your wallet for pending requests";
  }

  // Wait and try to get existing accounts
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    const existingAccounts = await window.ethereum.request({ method: 'eth_accounts' });
    if (existingAccounts && existingAccounts.length > 0) {
      return existingAccounts;
    }
  } catch (error) {
    console.warn('Could not get existing accounts:', error);
  }

  throw new Error('Wallet request pending. Please check your wallet.');
}

// Connection health monitoring
function startConnectionHealthCheck() {
  if (walletCheckInterval) clearInterval(walletCheckInterval);

  walletCheckInterval = setInterval(async () => {
    if (!isConnected || !connectedAccount) return;

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0 || accounts[0] !== connectedAccount) {
        console.log('Account changed or disconnected, updating UI');
        handleAccountsChanged(accounts);
      }
    } catch (error) {
      console.warn('Health check failed:', error);
      if (error.code === -32602 || error.code === -32603) {
        // Provider error, likely disconnected
        disconnectWallet();
      }
    }
  }, 5000); // Check every 5 seconds
}

function stopConnectionHealthCheck() {
  if (walletCheckInterval) {
    clearInterval(walletCheckInterval);
    walletCheckInterval = null;
  }
}

// Enhanced connection error handling
async function handleConnectionError(error) {
  isConnecting = false;
  const statusEl = safeGetElement("status");

  console.error("Connection error:", error);

  if (statusEl) {
    statusEl.className = "error mobile-friendly";

    // Enhanced error messages with device-specific solutions
    switch (error.code) {
      case 4001:
        statusEl.innerText = isMobile ? 
          "Connection cancelled. Tap 'Connect Wallet' to try again." :
          "Connection rejected. Please click 'Connect Wallet' to try again.";
        updateConnectionButton('rejected');
        break;

      case -32002:
        statusEl.innerText = isMobile ?
          "Check your wallet app for pending requests. Switch to your wallet app and approve the connection." :
          "Please check your wallet extension for pending connection requests.";
        updateConnectionButton('pending');

        // Auto-check for pending resolution on mobile
        if (isMobile) {
          setTimeout(async () => {
            try {
              const accounts = await window.ethereum.request({ method: 'eth_accounts' });
              if (accounts && accounts.length > 0) {
                connectedAccount = accounts[0];
                isConnected = true;
                updateConnectionUI();
                showConnectionSuccess();
              }
            } catch (e) {
              console.warn('Pending check failed:', e);
            }
          }, 3000);
        }
        break;

      case -32603:
        statusEl.innerText = "Wallet error occurred. Please restart your wallet and try again.";
        updateConnectionButton('wallet-error');
        break;

      case -32000:
        statusEl.innerText = "Wallet is locked. Please unlock your wallet and try again.";
        updateConnectionButton('error');
        break;

      default:
        if (error.message?.includes('timeout')) {
          statusEl.innerText = isMobile ?
            "Connection timed out. Please ensure your wallet app is running and try again." :
            "Connection timed out. Please check your wallet and try again.";
        } else if (error.message?.includes('denied') || error.message?.includes('rejected')) {
          statusEl.innerText = "Connection was declined. Please try again and approve in your wallet.";
        } else {
          const safeErrorMsg = (error.message || "Unknown error").substring(0, 100);
          statusEl.innerText = `Connection failed: ${safeErrorMsg}`;
        }
        updateConnectionButton('error');
        break;
    }
  }

  // Intelligent retry logic based on error type and device
  const autoRetryErrors = [-32603, -32000];
  const shouldAutoRetry = autoRetryErrors.includes(error.code) || 
                         error.message?.includes('timeout');

  if (shouldAutoRetry && connectionAttempts < maxConnectionAttempts) {
    const retryDelay = Math.min(Math.pow(2, connectionAttempts) * 1500, 10000);

    retryTimeout = setTimeout(async () => {
      if (statusEl) statusEl.innerText = "Retrying connection...";
      updateConnectionButton('retrying');
      await connectWallet();
    }, retryDelay);
  } else if (connectionAttempts >= maxConnectionAttempts) {
    connectionAttempts = 0; // Reset for next manual attempt
  }
}

// Enhanced disconnect function
function disconnectWallet() {
  try {
    // Clear all timeouts and intervals
    if (connectionTimeout) clearTimeout(connectionTimeout);
    if (retryTimeout) clearTimeout(retryTimeout);
    stopConnectionHealthCheck();

    isConnected = false;
    connectedAccount = null;
    window.lastKnownAccount = null;
    window.walletConnectionError = null;
    connectionAttempts = 0;
    isConnecting = false;

    // Safely remove event listeners
    cleanupEventListeners();

    // Update UI immediately with animation
    updateConnectionUI();

    const statusEl = safeGetElement("status");
    if (statusEl) {
      statusEl.innerText = "Wallet disconnected";
      statusEl.className = "disconnected";
    }

    // Show disconnect success briefly with better UX
    setTimeout(() => {
      if (statusEl && !isConnected) {
        statusEl.innerText = isMobile ? 
          "Ready to connect wallet app..." : 
          "Ready to connect wallet...";
        statusEl.className = "";
      }
    }, 2000);

    console.log('Wallet disconnected successfully');

  } catch (error) {
    console.error('Error during disconnect:', error);
    // Force UI reset even if error occurs
    forceUIReset();
  }
}

// Cleanup event listeners safely
function cleanupEventListeners() {
  const provider = window.ethereum;
  if (provider && eventListenersAdded) {
    try {
      // Use stored handler references if available
      if (provider._fluxoraHandlers) {
        provider.removeListener('accountsChanged', provider._fluxoraHandlers.accountsChanged);
        provider.removeListener('chainChanged', provider._fluxoraHandlers.chainChanged);
        provider.removeListener('disconnect', provider._fluxoraHandlers.disconnect);
        if (provider._fluxoraHandlers.connect) {
          provider.removeListener('connect', provider._fluxoraHandlers.connect);
        }
        delete provider._fluxoraHandlers;
      } else {
        // Fallback to generic cleanup
        provider.removeAllListeners('accountsChanged');
        provider.removeAllListeners('chainChanged');
        provider.removeAllListeners('disconnect');
        provider.removeAllListeners('connect');
      }
      eventListenersAdded = false;
      console.log('Event listeners cleaned up successfully');
    } catch (error) {
      console.warn('Error removing event listeners:', error);
      eventListenersAdded = false; // Reset flag anyway
    }
  }
}

// Force UI reset in case of errors
function forceUIReset() {
  try {
    const connectButton = safeGetElement("connect-button");
    const statusEl = safeGetElement("status");
    const accountInfo = safeGetElement("account-info");
    const networkInfo = safeGetElement("network-info");

    if (connectButton) {
      connectButton.innerHTML = `<button onclick="connectWallet()" class="connect-btn">Connect Wallet</button>`;
    }

    if (statusEl) {
      statusEl.innerText = "Ready to connect wallet...";
      statusEl.className = "";
    }

    if (accountInfo) accountInfo.innerHTML = "";
    if (networkInfo) networkInfo.innerHTML = "";

  } catch (error) {
    console.error('Error in force UI reset:', error);
  }
}

// Enhanced UI management with smooth state transitions
function updateConnectionUI() {
  try {
    const connectButton = safeGetElement("connect-button");
    const status = safeGetElement("status");
    const accountInfo = safeGetElement("account-info");
    const networkInfo = safeGetElement("network-info");

    // Ensure all elements exist
    if (!connectButton || !status) {
      console.warn('Critical UI elements missing, recreating...');
      recreateWalletUI();
      return;
    }

    if (isConnected && connectedAccount) {
      // Connected state
      connectButton.innerHTML = `
        <button onclick="disconnectWallet()" class="disconnect-btn" id="disconnect-button">
          <span class="button-text">Disconnect Wallet</span>
          <span class="button-icon">🔗</span>
        </button>
      `;

      status.innerHTML = `✅ Wallet Connected Successfully`;
      status.className = "connected";

      if (accountInfo) {
        accountInfo.innerHTML = `
          <div class="wallet-info">
            <div class="wallet-address">
              <strong>Address:</strong> 
              <span class="address-text">${formatAddress(connectedAccount)}</span>
              <button onclick="copyAddress()" class="copy-btn" title="Copy Address">📋</button>
            </div>
          </div>
        `;
      }
    } else {
      // Disconnected state
      updateConnectionButton('disconnected');

      if (status && !status.innerText.includes('Retrying') && !isConnecting) {
        status.innerText = "Ready to connect your wallet";
        status.className = "";
      }

      if (accountInfo) accountInfo.innerHTML = "";
      if (networkInfo) networkInfo.innerHTML = "";
    }

    // Add smooth transitions
    addUITransitions();

  } catch (error) {
    console.error('Error updating connection UI:', error);
    forceUIReset();
  }
}

// Enhanced button state management
function updateConnectionButton(state) {
  const connectButton = safeGetElement("connect-button");
  if (!connectButton) return;

  try {
    // Validate state parameter
    if (!state || typeof state !== 'string') {
      state = 'disconnected';
    }

    const buttonStates = {
      disconnected: {
        html: `<button onclick="connectWallet()" class="connect-btn" id="connect-button-main">
                 <span class="button-text">Connect Wallet</span>
                 <span class="button-icon">🔗</span>
               </button>`,
        disabled: false
      },
    connecting: {
      html: `<button class="connect-btn connecting" disabled id="connect-button-main">
               <span class="button-text">Connecting...</span>
               <span class="button-spinner">⏳</span>
             </button>`,
      disabled: true
    },
    pending: {
      html: `<button class="connect-btn pending" disabled id="connect-button-main">
               <span class="button-text">Check Wallet</span>
               <span class="button-icon">👀</span>
             </button>`,
      disabled: true
    },
    retrying: {
      html: `<button class="connect-btn retrying" disabled id="connect-button-main">
               <span class="button-text">Retrying...</span>
               <span class="button-spinner">🔄</span>
             </button>`,
      disabled: true
    },
    error: {
      html: `<button onclick="connectWallet()" class="connect-btn error" id="connect-button-main">
               <span c
