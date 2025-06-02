// Enhanced wallet connection with comprehensive error handling
let isConnected = false;
let connectedAccount = null;
let connectionAttempts = 0;
let maxConnectionAttempts = 3;
let eventListenersAdded = false;

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
  
  if (!window.ethereum) {
    if (statusEl) {
      statusEl.innerText = "No Ethereum wallet found. Please install MetaMask or another Web3 wallet.";
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
    // Add loading state
    if (statusEl) {
      statusEl.innerText = "Connecting wallet...";
      statusEl.className = "connecting";
    }

    const accounts = await Promise.race([
      window.ethereum.request({ method: "eth_requestAccounts" }),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Connection timeout')), 10000)
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
      statusEl.className = "error";
      
      if (error.code === 4001) {
        statusEl.innerText = "Connection rejected by user.";
      } else if (error.code === -32002) {
        statusEl.innerText = "Connection request already pending. Please check your wallet.";
      } else if (error.message === 'Connection timeout') {
        statusEl.innerText = "Connection timed out. Please try again.";
      } else {
        statusEl.innerText = `Connection failed: ${error.message || "Unknown error"}`;
      }
    }
    
    // Auto-retry for certain errors
    if (error.code !== 4001 && connectionAttempts < maxConnectionAttempts) {
      setTimeout(() => {
        if (statusEl) statusEl.innerText = "Retrying connection...";
      }, 2000);
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
const defaultQuests = [
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

// Premium loading screen
function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    setTimeout(() => {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 800);
    }, 2000);
  }
}

// Initialize the app with error handling
document.addEventListener('DOMContentLoaded', () => {
  try {
    // Hide loading screen after content loads
    hideLoadingScreen();
    
    const statusEl = safeGetElement('status');
    if (statusEl) {
      statusEl.textContent = 'Ready to connect wallet...';
    }
    
    updateConnectionUI();
    checkExistingConnection();
    
    // Initialize quest system with error handling
    try {
      questManager = new QuestManager();
      questManager.initializeDefaultQuests();
    } catch (questError) {
      console.error('Error initializing quest system:', questError);
    }
    
    // Add smooth scroll behavior
    if (document.documentElement) {
      document.documentElement.style.scrollBehavior = 'smooth';
    }
    
    // Add global error handler
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
    });
    
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
    });
    
  } catch (error) {
    console.error('Error during initialization:', error);
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

// Make functions global for onclick handlers
window.connectWallet = connectWallet;
window.disconnectWallet = disconnectWallet;