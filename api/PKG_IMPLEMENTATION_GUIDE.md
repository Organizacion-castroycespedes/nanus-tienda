# 🚀 PKG IMPLEMENTATION GUIDE - Manus Tienda API

## 📋 Overview
Este documento describe cómo compilar el backend NestJS en `/api` a un binario ejecutable usando `pkg`, configurarlo con PM2, y desplegarlo en producción.

---

## 🔧 PHASE 2: PREPARE BACKEND FOR COMPILATION

### Step 1: Install Dependencies
```bash
cd api
npm install
```

### Step 2: Verify Build Configuration
El proyecto usa TypeScript compilado a CommonJS:
- **Input**: `src/main.ts`
- **Output**: `dist/main.js` (via `npm run build`)
- **Entry Point**: `dist/main.js`

Confirmar en `tsconfig.json`:
```json
{
  "compilerOptions": {
    "module": "CommonJS",
    "outDir": "dist"
  }
}
```

### Step 3: Verify Environment Configuration
El archivo `.env` se carga en `src/main.ts` con:
```typescript
process.loadEnvFile(); // Carga .env en el directorio actual
```

✅ Este mecanismo funciona correctamente con pkg.

---

## 📦 PHASE 3: BUILD & PACKAGE

### Step 1: Compile TypeScript
```bash
npm run build
```

Output:
```
dist/
├── main.js
├── modules/
│   └── ...
└── common/
    └── ...
```

### Step 2: Install pkg as DevDependency (Already in package.json)
```bash
npm install --save-dev pkg@^5.11.4
```

### Step 3: Build Binary with pkg
```bash
npm run build:bin
```

This command:
1. Compiles TypeScript (`npm run build`)
2. Creates binary(ies) in `dist-bin/`
   - Linux: `dist-bin/api`
   - Windows: `dist-bin/api.exe`

Output structure:
```
dist-bin/
├── api                    (Linux executable)
├── api.exe               (Windows executable)
└── api-win.exe           (Windows x64)
```

**Size:** ~120-150 MB (compressed with Brotli)

---

## 🚀 PHASE 4: PM2 SETUP

### Step 1: Install PM2 Globally
```bash
npm install -g pm2
```

### Step 2: Verify ecosystem.config.js
El archivo `ecosystem.config.js` está configurado para:
- Ejecutar el binario compilado (NO node)
- Cluster mode con max instances
- Restart automático
- Logging a `logs/` directory
- Max memory 500MB

### Step 3: Start with PM2
```bash
cd api
pm2 start ecosystem.config.js
```

### Step 4: Save PM2 Configuration
```bash
pm2 save
```

### Step 5: Enable Startup on Reboot
```bash
# Linux
pm2 startup

# Then copy-paste the command output that looks like:
# sudo env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u <user> --hp <homepath>
```

### Step 6: Verify Processes
```bash
pm2 list
pm2 logs
pm2 monit
```

---

## ✅ PHASE 5: VALIDATION

### Test 1: Binary Exists & Is Executable
```bash
ls -lh dist-bin/api
./dist-bin/api --version  # Should show version info if available
```

### Test 2: Environment Variables
Before starting, set `.env`:
```bash
# api/.env
PORT=4020
DB_HOST=localhost
DB_DATABASE=manus_tienda
DB_USERNAME=postgres
DB_PASSWORD=root
JWT_SECRET=your-secret
```

### Test 3: Database Connection
Run the binary manually to test:
```bash
./dist-bin/api
# Should output: 🚀 API running on port 4020
```

### Test 4: API Endpoint
```bash
curl http://localhost:4020/api/health
# or any existing endpoint
```

### Test 5: PM2 Process Management
```bash
pm2 stop manus-api
pm2 restart manus-api
pm2 delete manus-api
```

---

## 📊 PHASE 6: DEPLOYMENT CHECKLIST

### Pre-Deployment
- [ ] Database exists and is accessible
- [ ] `.env` is configured with production values
- [ ] Binary built successfully (`dist-bin/api`)
- [ ] PM2 is installed globally
- [ ] No firewall rules blocking the API port

### Deployment Steps (Production Server)
```bash
# 1. Copy binary and config files
scp -r dist-bin/ ecosystem.config.js .env user@server:/app/api/

# 2. SSH into server
ssh user@server

# 3. Navigate to API directory
cd /app/api

# 4. Start with PM2
pm2 start ecosystem.config.js

# 5. Save and startup
pm2 save
pm2 startup

# 6. Verify
pm2 list
pm2 logs
```

### Post-Deployment Validation
```bash
# Check if API is responding
curl http://localhost:4020/api/health

# Monitor performance
pm2 monit

# View logs
pm2 logs manus-api
pm2 logs manus-api --lines 100
```

---

## 🐛 TROUBLESHOOTING

### Issue: Binary fails to start
**Solution:**
```bash
# Run manually to see errors
./dist-bin/api

# Check logs
pm2 logs manus-api
```

### Issue: "Cannot find module" errors
**Cause:** Missing asset in pkg config
**Solution:** Add to `package.json`:
```json
"pkg": {
  "assets": [
    "dist/**/*",
    ".env*"
  ]
}
```

### Issue: Port already in use
**Solution:**
```bash
# Change PORT in .env
PORT=4021

# Or kill process using port
lsof -i :4020
kill -9 <PID>
```

### Issue: Database connection fails
**Solution:**
- Verify DB credentials in `.env`
- Check DB is running and accessible
- Test connection manually: `psql -h localhost -U postgres -d manus_tienda`

### Issue: PM2 not recognized
**Solution:**
```bash
npm install -g pm2
pm2 update
```

---

## 📁 FINAL FOLDER STRUCTURE

After implementation:
```
api/
├── dist/                    # TypeScript compiled output
│   ├── main.js
│   ├── modules/
│   └── common/
├── dist-bin/                # PKG compiled binaries
│   ├── api                  (Linux)
│   ├── api.exe              (Windows)
│   └── api-win.exe
├── src/                     # Source code
│   ├── main.ts
│   └── modules/
├── node_modules/
├── package.json             # Updated with pkg config
├── package-lock.json
├── tsconfig.json
├── ecosystem.config.js      # NEW - PM2 config
├── .env                     # Production config (NOT in git)
├── .env.example             # NEW - Template for .env
├── logs/                    # NEW - PM2 logs directory
│   ├── err.log
│   └── out.log
└── database/                # Database migrations
    └── *.sql
```

---

## 📈 PERFORMANCE EXPECTATIONS

| Metric | Value |
|--------|-------|
| Startup time | ~2-3 seconds |
| Binary size | ~120-150 MB |
| Memory (idle) | ~30-50 MB |
| Memory (max) | ~500 MB (PM2 limit) |
| CPU (idle) | <1% |

---

## ⚠️ IMPORTANT NOTES

1. **Node.js NOT required** on target server
2. Binary is **Linux x64 specific** (if built on Linux)
3. `.env` must be in **same directory** as binary
4. PM2 logs are in `logs/` directory
5. Graceful shutdown timeout is **5 seconds**
6. Cluster mode spreads load across all CPU cores

---

## 🔐 SECURITY RECOMMENDATIONS

1. **Never commit `.env`** to git
2. Use `.env.example` as template
3. Set restrictive permissions:
   ```bash
   chmod 600 .env
   chmod 755 dist-bin/api
   ```
4. Use strong `JWT_SECRET`
5. Enable SSL for database if possible (`DB_SSL=true`)
6. Use environment-specific configs

---

## 📞 QUICK COMMANDS REFERENCE

```bash
# Build & package
npm run build:bin

# Start
pm2 start ecosystem.config.js

# Monitor
pm2 monit
pm2 logs

# Manage
pm2 stop manus-api
pm2 restart manus-api
pm2 delete manus-api

# Info
pm2 show manus-api
pm2 env
```

---

**Created:** 2026-04-27  
**Target Environment:** Linux x64 / Windows x64  
**Node Version:** 18.x  
**Database:** PostgreSQL
