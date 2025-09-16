# VPS96 Credit System - Complete Production Deployment Guide

## 🎯 System Overview

**VPS96** is an automated credit system that monitors Telegram channels for bonus codes, automatically claims them via browser scripts, and manages user credits with a 5% fee structure.

### Data Flow Architecture
```
Telegram Channels → FastAPI Backend → Redis Pub/Sub → Socket.IO Server → vps96script.js → Auto-Claim → Credit Deduction → Voucher Recharge
```

**Components:**
1. **FastAPI Backend** (`creditsystem-main/`) - Monitors Telegram, manages database, handles API
2. **Socket.IO Server** (`nodejs-socketio/`) - Real-time code broadcasting to clients  
3. **vps96script.js** - Browser userscript for automatic code claiming
4. **Redis** - Pub/sub messaging between services
5. **PostgreSQL** - User data, credits, transactions, vouchers
6. **Nginx** - Reverse proxy with SSL termination

---

## 🚀 Quick Deployment

### Prerequisites
- Ubuntu/Debian VPS with root access
- Domain pointing to your VPS IP address  
- Basic knowledge of environment variables

### 1. One-Command Setup
```bash
# Run as root on your VPS
sudo bash vps96/system-configs/setup-vps.sh
```

### 2. Configure Environment Variables
```bash
# FastAPI Backend
cp vps96/creditsystem-main/.env.example vps96/creditsystem-main/.env
nano vps96/creditsystem-main/.env  # Fill in your values

# Socket.IO Server  
cp vps96/nodejs-socketio/.env.example vps96/nodejs-socketio/.env
nano vps96/nodejs-socketio/.env  # Fill in your values
```

### 3. Start Services
```bash
systemctl start creditsystem socketio nginx redis-server
systemctl status creditsystem socketio nginx redis-server
```

---

## 🔧 Detailed Configuration

### Critical Environment Variables

**Both services must have identical values for:**
- `WS_SECRET` - WebSocket authentication (generate random 32+ char string)
- `REDIS_CHANNEL_CODES` - Redis pub/sub channel (default: bonus_codes)
- `REDIS_PASSWORD` - Redis authentication password

**FastAPI Backend (`.env`):**
```bash
# Database (REQUIRED - use PostgreSQL for production)
DATABASE_URL=postgresql://username:password@localhost:5432/creditsystem

# Telegram API (REQUIRED - get from https://my.telegram.org/auth)
TG_API_ID=your-api-id
TG_API_HASH=your-api-hash
TG_SESSION=tg_session

# Telegram Bot (REQUIRED - get from @BotFather)
TELEGRAM_BOT_TOKEN=your-bot-token
TELEGRAM_ADMIN_ID=your-telegram-user-id

# Channels to monitor (REQUIRED)
CHANNELS=-1002772030545,-1002932455889,-1001992047801

# Security (REQUIRED)
SECRET_KEY=generate-random-secret-key-32-chars
API_HMAC_SECRET=generate-random-hmac-secret-32-chars
ADMIN_USERNAME=your-admin-username
ADMIN_PASSWORD=your-secure-password

# WebSocket & Redis (REQUIRED - must match Socket.IO)
WS_SECRET=your-websocket-secret-32-chars
REDIS_PASSWORD=your-redis-password
REDIS_CHANNEL_CODES=bonus_codes

# CORS (REQUIRED - include your domain)
ALLOWED_ORIGINS=https://stake.com,https://stake.us,https://bc.game,https://kciade.online
```

**Socket.IO Server (`.env`):**
```bash
# WebSocket Auth (REQUIRED - must match FastAPI)
WS_SECRET=your-websocket-secret-32-chars

# Redis (REQUIRED - must match FastAPI) 
REDIS_PASSWORD=your-redis-password
REDIS_CHANNEL_CODES=bonus_codes

# CORS (REQUIRED - must match FastAPI)
ALLOWED_ORIGINS=https://stake.com,https://stake.us,https://bc.game,https://kciade.online
```

---

## 🔒 Security Configuration

### 1. Generate Secure Secrets
```bash
# Generate random secrets
openssl rand -hex 32  # For SECRET_KEY
openssl rand -hex 32  # For WS_SECRET  
openssl rand -hex 32  # For API_HMAC_SECRET
openssl rand -hex 16  # For REDIS_PASSWORD
```

### 2. Redis Authentication
Redis authentication is automatically configured by the setup script when `REDIS_PASSWORD` is set.

**Verify Redis auth:**
```bash
redis-cli -a your-password ping
# Should return: PONG
```

### 3. SSL/HTTPS Setup
SSL certificates are automatically generated during setup using Let's Encrypt.

**Manual SSL renewal:**
```bash
certbot renew --nginx
```

### 4. Firewall Configuration
```bash
# Allow only necessary ports
ufw allow 22/tcp      # SSH
ufw allow 80/tcp      # HTTP (redirect to HTTPS)
ufw allow 443/tcp     # HTTPS
ufw enable
```

---

## 📡 Service Management

### System Status
```bash
# Check all services
systemctl status creditsystem socketio nginx redis-server

# Quick health check
curl https://your-domain.com/health
curl http://localhost:3001/health
```

### Logs and Monitoring
```bash
# Real-time logs
journalctl -f -u creditsystem
journalctl -f -u socketio

# PM2 logs
pm2 logs fastapi-service
pm2 logs socketio-main

# Service stats
curl http://localhost:3001/stats
```

### Service Control
```bash
# Restart services
systemctl restart creditsystem socketio

# Stop/start individual services
systemctl stop creditsystem
systemctl start creditsystem

# PM2 process management
pm2 restart all
pm2 stop all
pm2 status
```

---

## 🎮 vps96script.js Usage

### Browser Installation
1. Install Tampermonkey browser extension
2. Create new userscript and paste `vps96script.js` content
3. Configure domain: Set `API_BASE_URL` to `https://your-domain.com`
4. Save and enable the script

### Script Features
- **Real-time code reception** via WebSocket
- **Auto-claiming** with Turnstile solving
- **Currency conversion** to USD with 5% fee
- **Credit tracking** and balance display
- **Comprehensive logging** and error handling

### Credit System Flow
1. User browses to supported gambling sites (Stake, BC.Game)
2. Script connects to WebSocket server
3. New bonus codes broadcast in real-time  
4. Script automatically claims codes
5. Value converted to USD, 5% fee deducted from credits
6. Credits recharged via Telegram bot voucher system

---

## 🤖 Telegram Bot Commands

### Admin Commands (Telegram)
```
/voucher ABC123 100    # Create $100 voucher with code ABC123
/balance username      # Check user credit balance  
/revoke ABC123         # Revoke/disable voucher code
```

### User Experience
1. Users receive voucher codes from admin
2. Users redeem via Telegram bot
3. Credits added to account
4. Credits consumed during auto-claiming (5% per claim)

---

## 🛠️ Advanced Configuration

### Custom Domain Setup
1. **Update deployment script:**
   ```bash
   export DOMAIN=your-domain.com
   export EMAIL=admin@your-domain.com
   bash vps96/system-configs/setup-vps.sh
   ```

2. **Update environment files:**
   - Change `BASE_DOMAIN` and `ALLOWED_ORIGINS` in both .env files
   - Update `API_BASE_URL` in vps96script.js

### Database Migration to PostgreSQL
```bash
# Install PostgreSQL
apt install postgresql postgresql-contrib

# Create database
sudo -u postgres createdb creditsystem
sudo -u postgres createuser --interactive

# Update DATABASE_URL in .env
DATABASE_URL=postgresql://username:password@localhost:5432/creditsystem
```

### High Availability Setup
- **Multi-instance Socket.IO:** Enable Redis adapter for horizontal scaling
- **Database clustering:** Use PostgreSQL master-slave replication  
- **Load balancing:** Configure multiple app instances behind nginx
- **Monitoring:** Add Prometheus/Grafana for metrics

---

## 🚨 Troubleshooting

### Common Issues

**1. Services not starting:**
```bash
# Check logs for specific errors
journalctl -u creditsystem --no-pager -n 20
journalctl -u socketio --no-pager -n 20

# Verify .env files exist and have correct values
ls -la /var/www/creditsystem-main/.env
ls -la /var/www/nodejs-socketio/.env
```

**2. WebSocket connection failures:**
```bash
# Check WS_SECRET matches in both .env files
grep WS_SECRET /var/www/creditsystem-main/.env
grep WS_SECRET /var/www/nodejs-socketio/.env

# Verify Socket.IO service is running
curl http://localhost:3001/health
```

**3. SSL certificate issues:**
```bash
# Check certificate status
certbot certificates

# Manually renew if needed
certbot renew --nginx --dry-run
```

**4. Redis connection errors:**
```bash
# Test Redis connectivity
redis-cli ping
redis-cli -a your-password ping

# Check Redis service
systemctl status redis-server
```

**5. Database connection issues:**
```bash
# Test PostgreSQL connection
psql postgresql://username:password@localhost:5432/creditsystem

# Check PostgreSQL service  
systemctl status postgresql
```

### Error Codes Reference

| Error | Cause | Solution |
|-------|-------|----------|
| `AUTH_FAILED` | WS_SECRET mismatch | Sync WS_SECRET in both .env files |
| `REDIS_CONNECTION_ERROR` | Redis auth/connection issue | Check Redis password and service |
| `DATABASE_CONNECTION_ERROR` | PostgreSQL issue | Verify DATABASE_URL and service |
| `SSL_CERTIFICATE_ERROR` | Let's Encrypt failure | Check domain DNS and try manual renewal |
| `CORS_ERROR` | Origin not allowed | Add domain to ALLOWED_ORIGINS |

---

## 📊 Performance Optimization

### Resource Monitoring
```bash
# System resources
htop
iotop
df -h

# Service-specific monitoring  
pm2 monit
systemctl show creditsystem --property=MemoryCurrent
systemctl show socketio --property=MemoryCurrent
```

### Optimization Tips
1. **Memory:** Increase PM2 `max_memory_restart` if needed
2. **CPU:** Monitor load during peak code claiming periods
3. **Disk:** Regular log rotation and cleanup
4. **Network:** Monitor Redis pub/sub throughput
5. **Database:** Add indexes on frequently queried columns

---

## 🔄 Backup and Recovery

### Database Backup
```bash
# Create backup
pg_dump creditsystem > backup_$(date +%Y%m%d_%H%M%S).sql

# Restore backup
psql creditsystem < backup_file.sql
```

### Configuration Backup
```bash
# Backup environment files
cp /var/www/creditsystem-main/.env ~/backup/
cp /var/www/nodejs-socketio/.env ~/backup/

# Backup nginx config
cp /etc/nginx/sites-available/your-domain.com ~/backup/
```

### System Recovery
1. **Fresh deployment:** Use setup script with backed-up .env files
2. **Database restore:** Import SQL backup after new setup
3. **SSL restoration:** Let's Encrypt will regenerate certificates
4. **Service recovery:** systemctl enable/start all services

---

## 📞 Support and Maintenance

### Regular Maintenance Tasks
1. **Weekly:** Check logs for errors, monitor disk usage
2. **Monthly:** Update system packages, restart services
3. **Quarterly:** Review and rotate secrets, backup database
4. **Annually:** Review security settings, update dependencies

### Monitoring Checklist
- [ ] All services running (`systemctl status`)
- [ ] SSL certificates valid (`certbot certificates`)
- [ ] Database accessible and backed up
- [ ] Redis authentication working
- [ ] WebSocket connections successful
- [ ] Credit system processing correctly
- [ ] No errors in logs

---

## 🔐 Security Best Practices

1. **Secrets Management:**
   - Never commit .env files to git
   - Rotate secrets quarterly
   - Use strong, unique passwords

2. **Access Control:**
   - Disable root SSH login
   - Use SSH keys instead of passwords
   - Implement fail2ban for brute force protection

3. **Network Security:**
   - Configure UFW firewall
   - Use VPN for admin access
   - Monitor access logs

4. **Application Security:**
   - Keep dependencies updated
   - Monitor for vulnerabilities
   - Regular security audits

---

## ✅ Deployment Verification

After successful deployment, verify these endpoints:

1. **HTTPS Website:** `https://your-domain.com/health`
2. **Socket.IO Health:** `http://localhost:3001/health`  
3. **WebSocket Connection:** Browser console should show successful connection
4. **Telegram Bot:** Send test voucher command
5. **Auto-claiming:** Visit supported site and verify script activation

**Success Indicators:**
- All systemctl services show "active (running)"
- Browser script connects and shows "Connected" status
- Telegram bot responds to commands
- Credit deductions work on test claims
- No errors in service logs

---

*This deployment guide covers the complete VPS96 credit system setup with security hardening, proper configuration, and production-ready practices. Follow all steps carefully and test thoroughly before production use.*