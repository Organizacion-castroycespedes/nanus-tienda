# 📦 DEPLOYMENT GUIDE - Linux Production Server

## Prerequisites

- Linux server (Ubuntu 22.04+ recommended)
- 2+ GB RAM
- PostgreSQL accessible
- SSH access to server
- Basic Linux command knowledge

---

## 🔧 Step 1: Server Preparation

### Install PM2 Globally
```bash
sudo npm install -g pm2
pm2 update
```

### Create Application Directory
```bash
sudo mkdir -p /app/manus-api
sudo chown $USER:$USER /app/manus-api
cd /app/manus-api
```

### Create Logs Directory
```bash
mkdir -p logs
```

---

## 📥 Step 2: Transfer Binary & Config

### From Local Machine
```bash
cd /path/to/manus-tienda/api

# Build binary
npm run build:bin

# Transfer to server
scp dist-bin/api user@server:/app/manus-api/
scp ecosystem.config.js user@server:/app/manus-api/
scp .env user@server:/app/manus-api/
```

### Alternative: Clone & Build on Server
```bash
# On server
cd /app/manus-api
git clone https://github.com/yourorg/manus-tienda.git .

# Build locally on server
npm install
npm run build:bin

# This ensures it's built for the exact target platform
```

---

## 🔐 Step 3: Configure Environment

### Secure .env File
```bash
cd /app/manus-api

# Set strict permissions
chmod 600 .env
chmod 755 api

# Edit production values
nano .env
```

### Update .env for Production
```env
# CRITICAL: Update these values
PORT=4020
NODE_ENV=production
CORS_ORIGIN=https://yourdomain.com

DB_HOST=prod-db.internal
DB_DATABASE=manus_tienda_prod
DB_USERNAME=api_user
DB_PASSWORD=<secure-password>
DB_SSL=true

JWT_SECRET=<long-random-string>
JWT_EXPIRES_IN=24h
```

---

## ✅ Step 4: Test Binary Locally

### Run Binary Directly
```bash
cd /app/manus-api

# Start binary
./api

# Expected output:
# 🚀 API running on port 4020
# Press Ctrl+C to stop
```

### Quick Health Check
```bash
# In another terminal
curl http://localhost:4020/api/health
```

---

## 🚀 Step 5: Setup PM2

### Start with PM2
```bash
cd /app/manus-api
pm2 start ecosystem.config.js
```

### Verify Process
```bash
pm2 list
# Should show: manus-api (online with multiple instances)

pm2 show manus-api
# Shows detailed process info
```

### View Logs
```bash
pm2 logs manus-api
pm2 logs manus-api --lines 50
pm2 logs manus-api --err
```

---

## 🔄 Step 6: Startup Script

### Save PM2 Processes
```bash
pm2 save
```

### Enable Startup on Reboot
```bash
# Generate startup script
pm2 startup

# Copy the output command and run it, e.g.:
# sudo env PATH=$PATH:/usr/local/bin /usr/local/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Then verify:
pm2 startup systemd

# Confirm saved:
systemctl status pm2-ubuntu
```

---

## 🧪 Step 7: Testing

### Test API Endpoint
```bash
curl http://localhost:4020/api/health
```

### Test with Authentication
```bash
# Login and get token
curl -X POST http://localhost:4020/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"password"}'
```

### Monitor Process
```bash
# Real-time monitoring
pm2 monit

# Or web dashboard
pm2 web
# Access at http://localhost:9615
```

---

## 🌐 Step 8: Nginx Reverse Proxy (Optional)

### Install Nginx
```bash
sudo apt update
sudo apt install nginx
```

### Configure Nginx
```bash
sudo nano /etc/nginx/sites-available/manus-api
```

### Nginx Config
```nginx
upstream manus_api {
    server localhost:4020;
    server localhost:4021;
    server localhost:4022;
    keepalive 64;
}

server {
    listen 80;
    server_name api.yourdomain.com;

    client_max_body_size 50M;

    location / {
        proxy_pass http://manus_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Site
```bash
sudo ln -s /etc/nginx/sites-available/manus-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🔒 Step 9: SSL/TLS (Let's Encrypt)

### Install Certbot
```bash
sudo apt install certbot python3-certbot-nginx
```

### Generate Certificate
```bash
sudo certbot --nginx -d api.yourdomain.com
```

### Auto-renewal
```bash
sudo systemctl enable certbot.timer
sudo systemctl start certbot.timer
```

---

## 📊 Step 10: Monitoring & Maintenance

### Regular Checks
```bash
# Check process status
pm2 list

# Monitor resources
pm2 monit

# View recent logs
pm2 logs --lines 100
```

### Log Rotation
```bash
# Install log rotation
pm2 install pm2-logrotate

# View status
pm2 show pm2-logrotate
```

### Backup Logs
```bash
# Backup logs weekly
tar -czf logs_backup_$(date +%Y%m%d).tar.gz logs/
```

---

## 🔄 Step 11: Updates & Redeployment

### Update Process
```bash
# 1. Build new binary locally
npm run build:bin

# 2. Transfer to server
scp dist-bin/api user@server:/app/manus-api/api.new

# 3. On server - backup current
cd /app/manus-api
cp api api.backup

# 4. Replace binary
mv api.new api
chmod 755 api

# 5. Reload PM2 (zero-downtime)
pm2 restart manus-api

# 6. Verify
pm2 logs
```

---

## 🆘 Troubleshooting

### Check PM2 Status
```bash
pm2 status
pm2 describe manus-api
```

### View Errors
```bash
pm2 logs manus-api --err
pm2 logs manus-api --lines 200
```

### Restart Everything
```bash
pm2 restart all
```

### Kill & Restart
```bash
pm2 delete manus-api
pm2 start ecosystem.config.js
```

### Check Port
```bash
lsof -i :4020
netstat -tlnp | grep 4020
```

### Test Connectivity
```bash
ping yourdomain.com
curl -v http://localhost:4020/api/health
```

---

## 📋 Checklist

### Pre-Deployment
- [ ] Binary built successfully
- [ ] `.env` configured with production values
- [ ] Database accessible and initialized
- [ ] PM2 installed globally
- [ ] Firewall rules allow port 4020

### Deployment
- [ ] Binary transferred to server
- [ ] Permissions set correctly (755)
- [ ] `.env` has correct credentials
- [ ] PM2 process started
- [ ] Logs checked for errors

### Post-Deployment
- [ ] API responding on port 4020
- [ ] Database queries working
- [ ] PM2 shows process as online
- [ ] Startup script enabled
- [ ] SSL certificate installed (if needed)

---

## 📞 Support

For issues:
1. Check logs: `pm2 logs manus-api`
2. Review `PKG_IMPLEMENTATION_GUIDE.md`
3. Check `RISK_ASSESSMENT.md`
4. See troubleshooting section above

---

**Last Updated:** 2026-04-27  
**Server Environment:** Linux (Ubuntu 22.04+)  
**Binary Platform:** node18-linux-x64
