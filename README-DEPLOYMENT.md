# VPS96 Credit System - Deployment Guide

## Quick Deployment

1. **Prepare your VPS** (Ubuntu/Debian):
   ```bash
   # Run as root
   sudo bash vps96/system-configs/setup-vps.sh
   ```

2. **Configure environment variables**:
   ```bash
   # FastAPI Backend
   cp vps96/creditsystem-main/.env.example vps96/creditsystem-main/.env
   nano vps96/creditsystem-main/.env  # Fill in your values
   
   # Socket.IO Server  
   cp vps96/nodejs-socketio/.env.example vps96/nodejs-socketio/.env
   nano vps96/nodejs-socketio/.env  # Fill in your values
   ```

3. **Start services**:
   ```bash
   systemctl start creditsystem socketio nginx
   systemctl status creditsystem socketio nginx
   ```

## System Architecture

**Flow**: Telegram Channels → FastAPI Backend → Redis → Socket.IO → vps96script.js → Credit Deduction

1. **Telegram Monitoring**: FastAPI backend monitors specified channels for bonus codes
2. **Code Broadcasting**: When codes are found, they're published to Redis
3. **Real-time Distribution**: Socket.IO server broadcasts codes to connected clients
4. **Auto-claiming**: vps96script.js receives codes and automatically claims them
5. **Credit System**: Successful claims convert currency to USD and deduct 5% fee
6. **Voucher Recharge**: Users recharge credits via Telegram bot voucher system

## Required Configuration

### Critical Environment Variables:
- `WS_SECRET`: Must be identical in both .env files
- `REDIS_PASSWORD`: Set up Redis authentication (will be auto-configured in Redis)
- `REDIS_CHANNEL_CODES`: Must be identical in both .env files (default: bonus_codes)
- `TG_API_ID` & `TG_API_HASH`: Get from https://my.telegram.org/auth
- `TELEGRAM_BOT_TOKEN`: Get from @BotFather
- `DATABASE_URL`: PostgreSQL connection string
- `ALLOWED_ORIGINS`: Must include your domain in both services

### Domain Configuration:
- Update `DOMAIN` variable in setup-vps.sh if not using kciade.online
- Ensure DNS points to your VPS IP address
- SSL certificates will be automatically generated

## Service Management

```bash
# Check status
systemctl status creditsystem socketio nginx redis-server

# View logs
journalctl -f -u creditsystem
journalctl -f -u socketio

# Restart services
systemctl restart creditsystem socketio

# Monitor Socket.IO connections
curl http://localhost:3001/stats
```

## Security Notes

- Change all default secrets in .env files
- Set Redis password authentication (REDIS_PASSWORD will be auto-configured)
- Restrict ALLOWED_ORIGINS to your specific domains only
- Keep WS_SECRET and REDIS_CHANNEL_* synchronized between services
- Ensure BASE_DOMAIN matches your actual domain
- Monitor logs for any authentication failures
- Test Redis auth: `redis-cli -a your-password ping`

## Troubleshooting

1. **Services not starting**: Check journalctl logs for specific errors
2. **SSL issues**: Ensure domain DNS is properly configured before running setup
3. **Redis connection errors**: Verify Redis is running and password matches
4. **WebSocket auth failures**: Ensure WS_SECRET matches in both .env files