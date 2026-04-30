# 🚀 QUICK START GUIDE

## 5-Minute Setup

### Step 1: Build Binary
```bash
cd api
npm install
npm run build:bin
```

**Output:** `dist-bin/api` (Linux) or `dist-bin/api.exe` (Windows)

---

### Step 2: Configure Environment
```bash
# Copy template
cp .env.example .env

# Edit with your values
nano .env
```

**Required variables:**
```env
PORT=4020
DB_HOST=your_db_host
DB_DATABASE=manus_tienda
DB_USERNAME=postgres
DB_PASSWORD=your_password
JWT_SECRET=your_secret
```

---

### Step 3: Test Binary
```bash
./dist-bin/api
# Should print: 🚀 API running on port 4020
# Press Ctrl+C to stop
```

---

### Step 4: Setup PM2
```bash
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

### Step 5: Verify
```bash
pm2 list              # Should show "manus-api" running
pm2 logs             # Check for errors
curl http://localhost:4020/api/health  # Test API
```

---

## 📂 Files Created/Modified

### New Files
- ✅ `ecosystem.config.js` - PM2 configuration
- ✅ `.env.example` - Environment template
- ✅ `PKG_IMPLEMENTATION_GUIDE.md` - Full documentation
- ✅ `RISK_ASSESSMENT.md` - Technical analysis

### Modified Files
- ✅ `package.json` - Added pkg config & dependencies

---

## ✅ Commands Summary

```bash
# Development
npm run start:dev

# Production Build
npm run build:bin

# Start with PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit
pm2 logs

# Stop
pm2 stop manus-api

# Restart
pm2 restart manus-api

# Remove
pm2 delete manus-api
```

---

## 📊 Folder Structure After Build

```
api/
├── dist/                    ← TypeScript compiled
├── dist-bin/                ← PKG binary (NEW)
│   ├── api
│   └── api.exe
├── ecosystem.config.js      ← PM2 config (NEW)
├── .env.example             ← Template (NEW)
├── .env                     ← Production config (DO NOT COMMIT)
├── logs/                    ← PM2 logs (created by PM2)
├── package.json             ← Updated with pkg config
└── PKG_IMPLEMENTATION_GUIDE.md ← Full docs (NEW)
```

---

## 🐛 Common Issues

| Issue | Solution |
|-------|----------|
| "pkg not found" | Run `npm install` first |
| Binary won't start | Check `.env` in same directory |
| Port already in use | Change `PORT` in `.env` |
| DB connection error | Verify DB credentials & connection |
| PM2 not found | Run `npm install -g pm2` |

---

## 🎯 Next Steps

1. **Development:** Continue using `npm run start:dev`
2. **Staging:** Build binary with `npm run build:bin` and test
3. **Production:** Deploy binary + `.env` to server

---

For detailed documentation, see `PKG_IMPLEMENTATION_GUIDE.md`
