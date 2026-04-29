# 🏗️ PKG PACKAGING ARCHITECTURE

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                   │
└─────────────────────────────────────────────────────────────┘

LOCAL DEVELOPMENT                    PRODUCTION SERVER
═══════════════════════════════════════════════════════════════

git clone                            Binary Transfer (scp)
    ↓                                       ↓
npm install                          /app/manus-api/
    ↓                                    ├── api (executable) ⭐
src/*.ts                             ├── .env
    ↓                                ├── ecosystem.config.js
npm run build:bin                    └── logs/
    ↓                                       ↓
dist-bin/api (120MB)            PM2 Process Management
    ↓                                       ↓
npm run build:bin        ┌─────────────────────────────┐
dist/ + node_modules → pkg → dist-bin/api (snapshot)
                                 ↓
                            PORT 4020 (HTTP)
                                 ↓
                            [PostgreSQL]
```

---

## 🔄 Compilation & Build Pipeline

### Phase 1: TypeScript Compilation
```
src/main.ts
  ↓ (tsc)
dist/main.js
src/modules/auth.module.ts
  ↓ (tsc)
dist/modules/auth.module.js
...all TypeScript → JavaScript
  ↓
dist/ (complete)
```

### Phase 2: Dependency Resolution
```
package.json
  ↓ (npm install)
node_modules/
  ├── @nestjs/
  ├── pg/
  ├── bcryptjs/
  ├── jsonwebtoken/
  └── ... (all dependencies)
```

### Phase 3: Binary Creation with pkg
```
dist/ (compiled code)
node_modules/ (dependencies)
package.json (config)
  ↓
pkg (creates snapshot)
  ├── Scans all requires
  ├── Bundles dependencies
  ├── Includes assets (.env*)
  ├── Compresses with Brotli
  └── Generates executable
  ↓
dist-bin/api (~130MB standalone binary)
```

### Phase 4: Runtime Execution
```
./dist-bin/api
  ↓
[Snapshot unpacking in memory]
  ↓
process.loadEnvFile() → reads .env
  ↓
PostgreSQL connection pool
  ↓
Express server on PORT 4020
  ↓
Listen for requests
```

---

## 📦 Package Contents

### What's Inside the Binary
```
dist-bin/api
├── [pkg-header]              # pkg executable header
├── [node-core]               # Node.js runtime (~60MB)
├── [npm-packages]            # All dependencies bundled
│   ├── @nestjs/*             # NestJS framework
│   ├── express/*             # Web framework
│   ├── pg/*                  # PostgreSQL driver
│   ├── bcryptjs/*            # Password hashing
│   ├── jsonwebtoken/*        # JWT tokens
│   └── ...
├── [application-code]        # Compiled JavaScript
│   ├── main.js
│   ├── modules/**/*.js
│   └── common/**/*.js
└── [assets-snapshot]         # Static files location

Total: ~130 MB (compressed)
```

### What's NOT Included
```
❌ node_modules/ folder       (bundled into binary)
❌ TypeScript source (.ts)    (only compiled .js)
❌ package-lock.json          (not needed at runtime)
❌ Development files (.gitignore, etc.)
```

---

## 🔐 Runtime Process Flow

### Startup Sequence
```
1. Binary execution
   ./dist-bin/api
   ↓
2. pkg snapshot extraction
   [Decompresses Brotli snapshot]
   ↓
3. Environment loading
   process.loadEnvFile()
   ↓
4. Module initialization
   require('reflect-metadata')
   NestFactory.create(AppModule)
   ↓
5. Database connection
   Pool instantiation with env vars
   ↓
6. HTTP server startup
   app.listen(PORT)
   ↓
7. Ready for requests
   🚀 API running on port 4020
```

### Request Flow
```
HTTP Request
    ↓
Nginx (optional reverse proxy)
    ↓
PORT 4020 (Node process)
    ↓
[CORS Middleware]
    ↓
[Route Handler]
    ↓
[Service Layer]
    ↓
[Database Query]
    ↓
PostgreSQL
    ↓
Response
    ↓
Client
```

---

## 💾 Process Management with PM2

### PM2 Cluster Mode
```
PM2 Master Process
├── Worker 1 (dist-bin/api) → PORT 4020
├── Worker 2 (dist-bin/api) → PORT 4021
├── Worker 3 (dist-bin/api) → PORT 4022
└── Worker N (dist-bin/api) → PORT 402N

Load Balancer (PM2 Internal)
    ↓
Distributes requests to workers
    ↓
Max CPU utilization
```

### Memory Management
```
PM2 Monitoring
├── Idle Memory:     ~30-50 MB per process
├── Under Load:      ~200-300 MB
└── Max Restart:     500 MB (configurable)

If process exceeds 500MB:
    ↓
PM2 graceful restart
    ↓
New worker spawned
    ↓
Old worker drains connections
    ↓
Old worker exits
```

---

## 🛡️ Security Architecture

### Binary Security
```
Source Code (TypeScript)
    ↓
Compiled & minified
    ↓
Bundled into binary
    ↓
Compressed
    ↓
NOT reverse-engineerable
    ✅ Code protected at rest
    ✅ Dependencies hidden
    ✅ Only runtime visible
```

### Environment Variables
```
.env (production)
├── Database credentials
├── JWT secrets
├── API keys
└── Sensitive config

at Runtime:
    ↓
process.env (loaded)
    ↓
Never exposed in code/binary
    ✅ Secrets not compiled in
    ✅ Runtime-only access
    ✅ No .env in git
```

### PostgreSQL Connection
```
.env → DB_HOST, DB_USERNAME, DB_PASSWORD
    ↓
DatabaseService creates Pool
    ↓
SSL optional (DB_SSL=true)
    ↓
Connection pooling (reuse)
    ↓
Query execution
    ✅ Connection strings not in code
    ✅ Credentials external
    ✅ SSL support available
```

---

## 📊 Deployment Topologies

### Topology 1: Single Binary (Development)
```
┌────────────────────┐
│  Linux Server      │
│  ┌──────────────┐  │
│  │ dist-bin/api │  │
│  │  (PORT 4020) │  │
│  └──────────────┘  │
│   PM2 (1 instance) │
└────────────────────┘
```

### Topology 2: Clustered (Production)
```
┌──────────────────────────────┐
│      Linux Server            │
│  PM2 Master Process          │
│  ├─ Worker 1 (PORT 4020)     │
│  ├─ Worker 2 (PORT 4021)     │
│  ├─ Worker 3 (PORT 4022)     │
│  └─ Worker 4 (PORT 4023)     │
│                               │
│  (Load balanced internally)   │
└──────────────────────────────┘
       ↑
   Nginx (Port 80/443)
       ↑
   Clients
```

### Topology 3: Highly Available (Enterprise)
```
┌─────────────────────────────┐
│   Load Balancer             │
│   (Nginx/HAProxy)           │
└────────────┬────────────────┘
             ↓
   ┌─────────┴─────────┐
   ↓                   ↓
┌─────────┐       ┌─────────┐
│ Server1 │       │ Server2 │
│ (PM2)   │       │ (PM2)   │
│ x4 jobs │       │ x4 jobs │
└────┬────┘       └────┬────┘
     ↓                 ↓
┌─────────────────────────────┐
│   PostgreSQL Cluster        │
│   (Primary + Replicas)      │
└─────────────────────────────┘
```

---

## 🔄 CI/CD Integration

### GitHub Actions Example
```yaml
name: Build & Package API

on: [push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - run: cd api && npm install
      - run: cd api && npm run build:bin
      
      - uses: actions/upload-artifact@v3
        with:
          name: api-binary
          path: api/dist-bin/api

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/download-artifact@v3
      - run: scp api ubuntu@prod-server:/app/manus-api/
      - run: ssh ubuntu@prod-server 'pm2 restart manus-api'
```

---

## 📈 Monitoring Stack

### PM2 Monitoring
```
pm2 monit
├── Real-time CPU usage
├── Real-time Memory usage
├── Process status
└── Restart count

pm2 logs
├── Stdout logs
├── Stderr logs
└── JSON logging available

pm2 web
├── Dashboard on :9615
├── Process metrics
└── Historical data
```

### External Monitoring (Recommended)
```
Application Monitoring:
├── DataDog / New Relic / Scout
├── Tracks: response time, errors, throughput
└── Alerts on anomalies

Infrastructure Monitoring:
├── Prometheus / Grafana
├── Tracks: CPU, Memory, Disk, Network
└── Custom dashboards

Logging Stack:
├── ELK (Elasticsearch, Logstash, Kibana)
├── Splunk / CloudWatch
└── Centralized log aggregation
```

---

## 🚀 Scaling Strategies

### Vertical Scaling
```
1. Increase PM2 max_memory_restart
2. Run more worker instances
3. Bigger server (more CPU/RAM)

Limitations:
├── Single machine failure = downtime
├── Cost increases significantly
└── Limited by server specs
```

### Horizontal Scaling
```
Load Balancer
├── Server 1 (PM2 + API binary)
├── Server 2 (PM2 + API binary)
├── Server 3 (PM2 + API binary)
└── Server N (...)

Benefits:
├── Better reliability
├── Automatic failover
├── Cost-effective
└── Better resource utilization
```

### Auto-Scaling (Kubernetes)
```
If scaling beyond 5+ servers:
    ↓
Consider containerization:
    ↓
Dockerfile
    ↓
Docker image
    ↓
Kubernetes / Docker Swarm
    ↓
Auto-scaling based on load
```

---

## 🔧 Maintenance & Updates

### Zero-Downtime Updates
```
1. Build new binary locally
   npm run build:bin

2. Transfer to server
   scp dist-bin/api server:/app/manus-api/api.new

3. Swap binary
   mv /app/manus-api/api /app/manus-api/api.old
   mv /app/manus-api/api.new /app/manus-api/api

4. Reload PM2 gracefully
   pm2 restart manus-api --update-env

5. Verify
   pm2 logs | grep "API running"

6. Keep backup
   (old binary in api.old)
```

---

## 📋 Decision Matrix: pkg vs Alternatives

| Factor | pkg | Docker | Node.js |
|--------|-----|--------|---------|
| **Setup Complexity** | ⭐ 1/5 | ⭐⭐⭐ 3/5 | ⭐⭐ 2/5 |
| **Binary Size** | ⭐⭐⭐ 3/5 | ⭐⭐ 2/5 | ⭐⭐⭐⭐⭐ 5/5 |
| **Startup Speed** | ⭐⭐⭐ 3/5 | ⭐ 1/5 | ⭐⭐⭐⭐ 4/5 |
| **Node.js Required** | ❌ No | ❌ No | ✅ Yes |
| **Production Ready** | ✅ Yes | ✅ Yes | ✅ Yes |
| **Learning Curve** | ⭐ Low | ⭐⭐⭐ High | ⭐⭐ Medium |
| **Scalability** | ⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐⭐⭐ Very Good |

**Recommendation:** pkg for:
- ✅ Simple deployments (1-3 servers)
- ✅ No Docker infrastructure
- ✅ Minimal dependencies
- ✅ Self-contained distribution

**Consider Docker if:**
- ❌ Need multi-container orchestration
- ❌ Already have Docker infrastructure
- ❌ Planning Kubernetes deployment

---

## 🎯 Conclusion

This architecture provides:
1. **Simple** - Single binary deployment
2. **Fast** - No Node.js installation needed
3. **Secure** - Code not exposed at runtime
4. **Reliable** - PM2 process management
5. **Scalable** - Horizontal scaling available

**Next Steps:**
1. Review [PKG_IMPLEMENTATION_GUIDE.md](./PKG_IMPLEMENTATION_GUIDE.md)
2. Build binary: `npm run build:bin`
3. Test locally with PM2
4. Deploy to production server

---

**Architecture Version:** 1.0  
**Last Updated:** 2026-04-27  
**Status:** ✅ Production Ready
