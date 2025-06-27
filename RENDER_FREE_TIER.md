# Render Free Tier - Optimizare și Soluții

## Problema: Serverul se oprește automat

Render Free Tier are următoarele limitări:
- **Serverul se oprește automat** după 15 minute de inactivitate
- **Timp de pornire** de 50+ secunde când primește primul request
- **Lipsa de persistență** - toate datele se pierd la restart

## Soluțiile implementate

### 1. Keep-Alive Mechanism
```javascript
// Ping la fiecare 14 minute pentru a menține serverul activ
setInterval(keepAlive, 14 * 60 * 1000);
```

### 2. Health Check Endpoints
- `/` - Health check principal
- `/keep-alive` - Endpoint special pentru keep-alive

### 3. Script Extern de Keep-Alive
```bash
npm run keep-alive
```

## Cum să rulezi keep-alive

### Opțiunea 1: Pe calculatorul tău
```bash
# În terminal separat
npm run keep-alive
```

### Opțiunea 2: Pe un serviciu extern
Poți folosi servicii precum:
- **UptimeRobot** - monitorizare gratuită
- **Cron-job.org** - cron job gratuit
- **Heroku Scheduler** - dacă ai cont Heroku

### Opțiunea 3: Pe Render cu Background Worker
Creează un Background Worker separat pe Render care rulează keep-alive.

## Configurare UptimeRobot

1. Mergi la [uptimerobot.com](https://uptimerobot.com)
2. Creează un cont gratuit
3. Adaugă un monitor:
   - **URL**: `https://joker-duel-games-bot.onrender.com/keep-alive`
   - **Type**: HTTP(s)
   - **Interval**: 5 minutes
   - **Alert**: Doar când e down

## Configurare Cron-job.org

1. Mergi la [cron-job.org](https://cron-job.org)
2. Creează un cont gratuit
3. Adaugă un job:
   - **URL**: `https://joker-duel-games-bot.onrender.com/keep-alive`
   - **Schedule**: Every 14 minutes
   - **Method**: GET

## Limitări Free Tier

- **750 ore/lună** (31 zile)
- **512 MB RAM**
- **Shared CPU**
- **No persistent storage** (SQLite se pierde la restart)

## Recomandări

1. **Pentru producție**: Upgrade la paid plan ($7/lună)
2. **Pentru testare**: Folosește keep-alive script
3. **Pentru backup**: Exportă datele periodic

## Monitorizare

Verifică statusul serverului:
```bash
curl https://joker-duel-games-bot.onrender.com/
```

Răspuns așteptat:
```json
{
  "status": "Bot server is running!",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600
}
``` 