# JSONBin Persistence Setup

## Status: ✅ ACTIVE

### Configuration
- **DB_MODE**: `jsonbin` (enabled in .env)
- **Bin ID**: `692dd82943b1c97be9d105d4` (Users)
- **API Key**: Configured in .env
- **Auto-save interval**: Every 30 seconds

### How It Works

1. **On Server Start**
   - Loads all users from JSONBin
   - Restores telegram users to global cache
   - Logs: `✓ Loaded X users from JSONBin`

2. **On User Actions**
   - Storing Telegram user → saves to JSONBin
   - Scanning wallet → saves immediately + 30s auto-save
   - Confirming boost → saves to JSONBin
   - Storing TON address → saves to JSONBin

3. **Data Persistence**
   - All user data is encrypted in JSONBin
   - Balances, boosts, and settings persist across restarts
   - Admin settings are preserved

### Data Structure
```json
{
  "users": [
    {
      "key": "tg_5076024106",
      "balances": { "BTC": 0, "ETH": 0, ... },
      "telegramUser": { "id": 5076024106, "username": "admin" },
      "boost": null,
      "speedMultiplier": 1,
      "findRate": 0.1,
      "scannedWallets": 0,
      "tonAddress": null,
      "wallet": { "address": "...", "network": "..." }
    }
  ]
}
```

### Troubleshooting

If data is not being saved:
1. Check that `DB_MODE=jsonbin` in .env
2. Verify `JSONBIN_API_KEY` is correct
3. Check server logs for `❌` error messages
4. Run `node test-jsonbin.js` to test connection

If you need to reset JSONBin:
```bash
node reset-jsonbin.js
```
