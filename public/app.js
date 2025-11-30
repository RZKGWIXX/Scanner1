// public/app.js
(function() {
  'use strict';

  const API_BASE = '';
  const MANIFEST_PATH = '/tonconnect-manifest.json'; // <- переконайтесь, що файл саме з дефісом

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

  // Help: завантаження зовнішнього скрипта, якщо не підключено в HTML
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector(`script[src="${src}"]`)) {
        // вже підключений
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Script load error: ' + src));
      document.head.appendChild(s);
    });
  }

  async function initTonConnect() {
    const tonBtnRoot = document.getElementById('tonConnectBtn');
    if (!tonBtnRoot) {
      console.warn('tonConnectBtn not found in DOM');
      return;
    }

    const manifestUrl = window.location.origin + MANIFEST_PATH;

    // Перевірка доступності маніфесту — щоб уникнути Cannot GET /...
    try {
      const r = await fetch(manifestUrl, { method: 'GET' });
      if (!r.ok) {
        console.error('Manifest fetch failed:', r.status, r.statusText);
        showBoostMessage('⚠️ TON manifest not available at ' + MANIFEST_PATH + '. Place the file in public/ and ensure correct name.', 'error');
        return;
      }
    } catch (e) {
      console.error('Manifest fetch error:', e);
      showBoostMessage('⚠️ Failed to fetch TON manifest. Check file and CORS.', 'error');
      return;
    }

    // Завантажити бібліотеку якщо її нема
    try {
      if (!window.TON_CONNECT_UI) {
        await loadScript('https://unpkg.com/@tonconnect/ui@latest/dist/tonconnect-ui.min.js');
      }
    } catch (e) {
      console.error('Failed to load TON Connect UI script:', e);
      showBoostMessage('⚠️ Failed to load TON Connect UI library.', 'error');
      return;
    }

    try {
      tonConnectUI = new TON_CONNECT_UI.TonConnectUI({
        manifestUrl: manifestUrl,
        buttonRootId: 'tonConnectBtn'
      });

      tonConnectUI.onStatusChange(wallet => {
        // Підтримати різні форми відповіді
        let addr = null;
        try {
          addr = wallet && (
            (wallet.account && wallet.account.address) ||
            wallet.accountAddress ||
            wallet.address ||
            (wallet?.wallet?.address)
          );
        } catch (e) {
          addr = null;
        }

        if (addr) {
          walletAddress = addr;
          showBoostMessage(`✅ Wallet connected: ${addr.slice(0,6)}...${addr.slice(-4)}`, 'success');
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
      showBoostMessage('⚠️ TON Connect initialization failed. Check manifest and library.', 'error');
    }
  }

  navBtns.forEach(b => b.addEventListener('click', () => {
    const p = b.dataset.page;
    Object.values(PAGES).forEach(x => x.classList.remove('active'));
    if (PAGES[p]) PAGES[p].classList.add('active');
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
    for (let i = 0; i < 40; i++) addr += chars[Math.floor(Math.random() * chars.length)];
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
      telegramUsername.innerText = user.username ? `@${user.username}` : user.first_name || 'User';
      if (user.photo_url) {
        telegramAvatar.src = user.photo_url;
      } else if (user.username) {
        telegramAvatar.src = `https://unavatar.io/telegram/${user.username}`;
      } else {
        const name = user.first_name || 'User';
        telegramAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=8b5cf6&color=fff&size=128`;
      }
      telegramUserDiv.classList.remove('hidden');
    } else {
      // сховати, якщо немає
      telegramUserDiv.classList.add('hidden');
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

      updateNeuralStatus(p);
      updateTelegramUser(p);

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
              <button class="btn-withdraw" data-crypto="${k}">
                Withdraw
              </button>
            </div>
          `;
          profileBalancesList.appendChild(item);
        }

        if (nonZeroCount) nonZeroCount.innerText = nonZero;

        // handlers
        document.querySelectorAll('.btn-withdraw').forEach(btn => {
          btn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const crypto = this.getAttribute('data-crypto');
            handleWithdraw(crypto);
          });
        });
      }
    } catch (e) {
      console.error('Profile refresh error:', e);
      showBoostMessage('⚠️ Failed to load profile. Check server.', 'error');
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

  function handleWithdraw(crypto) {
    console.log('handleWithdraw called for:', crypto);
    const modal = document.getElementById('withdrawModal');
    if (!modal) {
      console.error('Modal not found!');
      return;
    }
    modal.classList.remove('hidden');
    modal.style.display = 'flex'; // явне показування
    modal.setAttribute('aria-hidden', 'false');
    modal.style.zIndex = 9999;
    const primary = modal.querySelector('.modal-footer .gradient-btn.full');
    if (primary) primary.focus();
  }

  window.closeWithdrawModal = function() {
    const modal = document.getElementById('withdrawModal');
    if (modal) {
      modal.classList.add('hidden');
      modal.style.display = 'none';
      modal.setAttribute('aria-hidden', 'true');
    }
  };

  window.goToBoostPage = function() {
    closeWithdrawModal();
    Object.values(PAGES).forEach(x => x.classList.remove('active'));
    PAGES.boost.classList.add('active');
    navBtns.forEach(n => n.classList.toggle('active', n.dataset.page === 'boost'));
  };

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
      }).then(res => res.json()).then(data => refreshProfile()).catch(err => console.error('Failed to store Telegram user:', err));
    }
  } else {
    console.log('Not running in Telegram WebApp');
  }

  async function init() {
    console.log('App initializing...');
    await refreshProfile();
    initTonConnect();

    setInterval(() => {
      if (currentProfile) updateNeuralStatus(currentProfile);
    }, 2000);

    console.log('App initialized');
  }

  init();
})();
