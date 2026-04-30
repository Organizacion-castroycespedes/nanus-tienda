# 📖 QUICK REFERENCE - All Commands

## 🏃 Quick Build & Deploy (30 seconds)

```bash
# 1. Install dependencies
npm install

# 2. Build binary
npm run build:bin

# 3. Start with PM2
pm2 start ecosystem.config.js

# Done! 🎉
```

---

## 🔨 Development Commands

```bash
# Install dependencies
npm install

# Start development server (watch mode)
npm run start:dev

# Compile TypeScript
npm run build

# Run compiled code with Node
npm start

# Build standalone binary
npm run build:bin
```

---

## 🚀 PM2 Commands

```bash
# Start process from config
pm2 start ecosystem.config.js

# List all processes
pm2 list

# Show process details
pm2 show manus-api

# Monitor in real-time
pm2 monit

# View logs (live)
pm2 logs manus-api

# View last 100 lines
pm2 logs manus-api --lines 100

# View errors only
pm2 logs manus-api --err

# Stop process
pm2 stop manus-api

# Restart process
pm2 restart manus-api

# Delete process
pm2 delete manus-api

# Kill all PM2 processes
pm2 kill

# Save process list
pm2 save

# Restore saved processes
pm2 resurrect

# Enable startup on reboot
pm2 startup

# Disable startup on reboot
pm2 unstartup

# Web dashboard (access on :9615)
pm2 web

# Install log rotation
pm2 install pm2-logrotate

# Save logs before rotating
pm2 save
```

---

## 🧪 Testing Commands

```bash
# Test binary exists
ls -lh dist-bin/api
file dist-bin/api

# Run binary manually
./dist-bin/api

# Test API endpoint
curl http://localhost:4020/api/health

# Test with credentials
curl -H "Authorization: Bearer TOKEN" \
  http://localhost:4020/api/users

# Check port is listening
lsof -i :4020

# Check processes on port
netstat -tlnp | grep 4020

# Monitor process
ps aux | grep api

# Check system resources
free -h
top
```

---

## 🔐 Environment Management

```bash
# Copy template
cp .env.example .env

# Edit environment
nano .env
# or
vi .env
# or
code .env

# Check environment is loaded
cat .env | grep DB_

# Test database connection
psql -h localhost -U postgres -d manus_tienda

# Verify all required vars set
echo $PORT
echo $DB_HOST
echo $JWT_SECRET
```

---

## 🐛 Debugging

```bash
# View full error output
pm2 logs manus-api --err | head -50

# Follow logs in real-time
pm2 logs manus-api --follow

# Check PM2 error log
cat ~/.pm2/pm2.log

# View system logs (Linux)
journalctl -u pm2-$USER --no-pager

# Process info
pm2 describe manus-api

# Environment variables used by process
pm2 env manus-api

# Restart in debug mode
pm2 restart manus-api --debug
```

---

## 📦 Dependency Management

```bash
# Install all dependencies
npm install

# Install specific package
npm install package-name

# Install development package
npm install --save-dev package-name

# Update all packages
npm update

# Check for vulnerabilities
npm audit

# Fix vulnerabilities
npm audit fix

# List installed packages
npm list

# List global packages
npm list -g

# Clean cache
npm cache clean --force
```

---

## 🐳 Build Optimization

```bash
# Build binary (optimized)
npm run build:bin

# Build specific target
pkg . --targets node18-linux-x64

# Build both targets
pkg . --targets node18-linux-x64,node18-win-x64

# Build with compression
pkg . --compress Brotli

# Build without compression
pkg . --compress none

# Output to specific directory
pkg . --output dist-bin/api-prod
```

---

## 🌐 Server Deployment

```bash
# SCP binary to server
scp dist-bin/api user@server:/app/manus-api/

# SCP ecosystem config
scp ecosystem.config.js user@server:/app/manus-api/

# SCP environment file
scp .env user@server:/app/manus-api/

# SSH into server
ssh user@server

# Create app directory
mkdir -p /app/manus-api
cd /app/manus-api

# Make binary executable
chmod +x api

# Make config readable
chmod 600 .env
chmod 644 ecosystem.config.js

# Start PM2 on server
pm2 start ecosystem.config.js

# Save PM2 state
pm2 save
```

---

## 📊 Monitoring & Performance

```bash
# Real-time process monitor
pm2 monit

# Process statistics
pm2 show manus-api

# Log with timestamp
pm2 logs manus-api --timestamp

# Export metrics to JSON
pm2 dump

# Load metrics from dump
pm2 resurrect

# Monitor with custom interval
pm2 monit --update 100

# Check memory usage
ps aux --sort=-%mem | grep api

# Check CPU usage
ps aux --sort=-%cpu | grep api

# Monitor in background
pm2 start ecosystem.config.js --log-date-format "YYYY-MM-DD HH:mm:ss Z"
```

---

## 🔄 Update & Rollback

```bash
# Build new version locally
npm run build:bin

# Backup current binary
cp dist-bin/api dist-bin/api.backup

# Transfer new binary
scp dist-bin/api user@server:/app/manus-api/api.new

# On server: swap binary
ssh user@server 'cd /app/manus-api && \
  cp api api.old && \
  cp api.new api && \
  chmod +x api && \
  pm2 restart manus-api'

# Verify new version
pm2 logs manus-api

# If needed: rollback
ssh user@server 'cd /app/manus-api && \
  cp api.old api && \
  pm2 restart manus-api'
```

---

## 🔧 Nginx (Reverse Proxy)

```bash
# Install Nginx
sudo apt install nginx

# Create config
sudo nano /etc/nginx/sites-available/manus-api

# Enable config
sudo ln -s /etc/nginx/sites-available/manus-api \
  /etc/nginx/sites-enabled/

# Test config
sudo nginx -t

# Start Nginx
sudo systemctl start nginx

# Restart Nginx
sudo systemctl restart nginx

# View status
sudo systemctl status nginx

# View logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

---

## 🔐 SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal check
sudo certbot renew --dry-run

# View certificates
sudo certbot certificates

# List expiry dates
sudo certbot certificates | grep "expiry date"
```

---

## 🛠️ System Commands

```bash
# Check disk space
df -h

# Check available memory
free -h

# List running processes
ps aux

# Kill process by PID
kill -9 <PID>

# Find process using port
lsof -i :4020

# Check system uptime
uptime

# View system info
uname -a
lsb_release -a

# Reboot server
sudo reboot

# Check service status
sudo systemctl status pm2-$USER

# View systemd logs
sudo journalctl -u pm2-$USER -n 50 --no-pager
```

---

## 📁 File Management

```bash
# List files (verbose)
ls -lah

# Create directory
mkdir -p logs

# Change permissions
chmod 755 api
chmod 600 .env

# Change owner
chown $USER:$USER /app/manus-api

# Archive files
tar -czf backup.tar.gz dist-bin/ logs/

# Extract archive
tar -xzf backup.tar.gz

# Find files
find . -name "*.js" -type f

# Count files
find . -type f | wc -l

# Remove files
rm -f file.txt
rm -rf directory/

# Copy files
cp file.txt file.backup
cp -r directory/ backup/

# Move files
mv file.txt new/location/

# View file content
cat .env
less large-file.log
```

---

## 🐱 Git Commands

```bash
# Initialize repo
git init

# Clone repo
git clone <url>

# Check status
git status

# Add files
git add .
git add file.ts

# Commit
git commit -m "message"

# Push
git push origin main

# Pull
git pull origin main

# View log
git log --oneline

# Create branch
git checkout -b feature-name

# Switch branch
git checkout main

# Merge branch
git merge feature-name

# Delete branch
git branch -d feature-name
```

---

## 📋 Checklist Commands

```bash
# Pre-deployment check
npm run build && npm run build:bin && \
  ls -lh dist-bin/api && \
  ./dist-bin/api --version

# Health check
curl -I http://localhost:4020/api/health

# Database connectivity
psql -h $DB_HOST -U $DB_USERNAME -d $DB_DATABASE -c "SELECT 1"

# Port listening
lsof -i :4020

# Process running
ps aux | grep api

# PM2 status
pm2 list && pm2 describe manus-api

# Full system check
npm run build:bin && \
  pm2 start ecosystem.config.js && \
  pm2 logs && \
  curl http://localhost:4020/api/health
```

---

## 💾 Backup & Restore

```bash
# Backup database
pg_dump -h localhost -U postgres -d manus_tienda > backup.sql

# Restore database
psql -h localhost -U postgres -d manus_tienda < backup.sql

# Backup entire app directory
tar -czf manus-api-backup.tar.gz /app/manus-api

# Restore from backup
tar -xzf manus-api-backup.tar.gz -C /

# Backup PM2 config
pm2 save

# Backup logs
tar -czf logs-backup.tar.gz /app/manus-api/logs
```

---

## 🆘 Emergency Commands

```bash
# Emergency stop
pm2 kill

# Kill all node processes
killall node

# Clear PM2 cache
pm2 flush

# Reset PM2
pm2 reset all

# Emergency restart
sudo systemctl restart pm2-$USER

# Check system health
free -h && df -h && top -b -n 1 | head -20
```

---

## 🎯 Complete Deployment Flow

```bash
# 1. Build
npm install
npm run build:bin
echo "✓ Binary built"

# 2. Transfer
scp dist-bin/api user@server:/app/manus-api/
echo "✓ Binary transferred"

# 3. Deploy
ssh user@server 'cd /app/manus-api && \
  pm2 start ecosystem.config.js && \
  pm2 save && \
  pm2 startup'
echo "✓ Deployed and started"

# 4. Verify
sleep 3
ssh user@server 'pm2 logs manus-api --lines 5'
echo "✓ Verified running"

# 5. Test
curl http://server-ip:4020/api/health
echo "✓ API responding"
```

---

**Last Updated:** 2026-04-27  
**Version:** 1.0
