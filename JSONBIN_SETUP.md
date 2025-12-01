# JSON Bin Setup Інструкція

## Конфігурація для JSON Bin

**Collection ID:** `692dd5ef43b1c97be9d100f1`

## Потрібні Bins

Потрібно створити **3 bins** у вашій JSONBin Collection для зберігання даних:

### 1. **Scanner - Users**
**Використання:** Зберігання користувачів, їхніх балансів та boost статусу

**Структура JSON:**
```json
{
  "users": [
    {
      "id": 123456789,
      "username": "john_doe",
      "first_name": "John",
      "photo_url": null,
      "balances": {
        "BTC": 0.005,
        "ETH": 0.1,
        "TON": 100,
        "SOL": 0,
        "LTC": 0,
        "BNB": 0,
        "USDT": 0,
        "USDC": 0,
        "TRX": 0
      },
      "boost": {
        "purchased": true,
        "amount": 10,
        "multiplier": 10,
        "findRate": 0.1,
        "purchasedAt": "2025-12-01T10:30:00Z"
      },
      "speedMultiplier": 10,
      "findRate": 0.1,
      "scannedWallets": 150,
      "createdAt": "2025-11-01T00:00:00Z"
    }
  ]
}
```

**Де збирати:**
- `id` - Telegram user ID
- `username` - Telegram username
- `balances` - Крипто баланси користувача
- `boost` - Статус та деталі активного boost

---

### 2. **Scanner - Transactions**
**Використання:** Історія всіх транзакцій (покупок boost та зняття)

**Структура JSON:**
```json
{
  "transactions": [
    {
      "id": "tx_1",
      "userId": 123456789,
      "type": "boost_purchase",
      "amount": 10,
      "currency": "TON",
      "boostPackage": "Basic",
      "status": "completed",
      "timestamp": "2025-12-01T10:30:00Z"
    },
    {
      "id": "tx_2",
      "userId": 123456789,
      "type": "withdrawal",
      "crypto": "BTC",
      "amount": 0.001,
      "status": "pending",
      "timestamp": "2025-12-01T11:00:00Z"
    }
  ]
}
```

**Поля:**
- `type` - `"boost_purchase"` або `"withdrawal"`
- `status` - `"completed"`, `"pending"`, `"failed"`
- Для boost: `boostPackage` (Basic, Pro, Ultra, Extreme)
- Для withdrawal: `crypto` та `amount`

---

### 3. **Scanner - Admin Stats**
**Використання:** Загальна статистика для адміна (читання та оновлення)

**Структура JSON:**
```json
{
  "stats": {
    "totalUsers": 150,
    "totalActiveBoosts": 45,
    "totalBoosts": {
      "10": 10,
      "30": 15,
      "100": 15,
      "130": 5
    },
    "totalRevenue": 2450,
    "withdrawalsPending": 5,
    "lastUpdated": "2025-12-01T11:30:00Z"
  }
}
```

**Поля:**
- `totalUsers` - Кількість користувачів
- `totalActiveBoosts` - Кількість користувачів з активним boost
- `totalBoosts` - Розподіл за пакетами (10, 30, 100, 130 TON)
- `totalRevenue` - Загальна сума у TON від продажу boost
- `withdrawalsPending` - Кількість очікуючих зняття

---

## Інструкція для створення Bins на JSONBin.io

1. Перейдіть на https://jsonbin.io
2. Залогініться зі своїм акаунтом
3. На панелі вибрати вашу Collection ID: `692dd5ef43b1c97be9d100f1`
4. Натисніть "+ Create New Bin" **3 рази** для кожного bin

### Для кожного Bin:

1. **Назва:** один з трьох назв вище (Scanner - Users, Scanner - Transactions, Scanner - Admin Stats)
2. **Приватність:** Можете залишити приватним або встановити як приватний
3. **JSON контент:** скопіюйте структуру JSON вище
4. **Збережіть** - вам буде показана **Bin ID**

---

## Оновлення .env

Після створення bins заповніть `.env` файл:

```env
JSONBIN_API_KEY=your_api_key_here

# Bin IDs які ви отримали при створенні
JSONBIN_BIN_USERS=692dd82943b1c97be9d105d4
JSONBIN_BIN_TRANSACTIONS=692dd85dae596e708f7cc686
JSONBIN_BIN_ADMIN_STATS=692dd896d0ea881f400c0ff4

# Змінити на jsonbin коли готово
DB_MODE=jsonbin
```

---

## API Key для JSONBin

1. Перейдіть на https://jsonbin.io
2. Розділ **"Account"** → **"API Keys"**
3. Створіть новий API Key для проекту
4. Скопіюйте та вставте у `.env` як `JSONBIN_API_KEY`

---

## Тестування

Після заповнення `.env` та запуску сервера, він автоматично синхронізуватиме дані з JSON Bin.
