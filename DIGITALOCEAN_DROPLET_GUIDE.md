# DigitalOcean Droplet Deployment Guide

## 💰 DigitalOcean Droplet Pricing

### Droplet Options:

| Plan | RAM | vCPU | Storage | Price/Month | Best For |
|------|-----|------|---------|-------------|----------|
| **Basic** | 1GB | 1 | 25GB | $6/month | Small apps, testing |
| **Basic** | 2GB | 1 | 50GB | $12/month | ⭐ **Recommended** |
| **Basic** | 4GB | 2 | 80GB | $24/month | Medium traffic |
| **Basic** | 8GB | 4 | 160GB | $48/month | High traffic |

### Additional Costs:

- **PostgreSQL Database**: $15/month (1GB) to $60/month (4GB)
- **Backups**: $1.20/month (20% of Droplet cost)
- **Monitoring**: FREE
- **Firewall**: FREE
- **Load Balancer**: $12/month (optional)

### Total Cost Estimate:

**Minimum Setup** (1 Droplet + Database):
- Droplet (2GB): $12/month
- PostgreSQL: $15/month
- Backups: $1.20/month
- **Total: ~$28/month**

**Recommended Setup** (1 Droplet + Database):
- Droplet (4GB): $24/month
- PostgreSQL: $15/month
- Backups: $2.40/month
- **Total: ~$41/month**

---

## 📊 Cost Comparison

| Platform | Monthly Cost | Setup Complexity | Best For |
|----------|-------------|------------------|----------|
| **Vercel + Railway** | $5-20 | ⭐ Easy | ⭐ **Most cost-effective** |
| **DigitalOcean Droplet** | $28-41 | ⭐⭐⭐ Hard | Full control |
| **Railway (all)** | $10-15 | ⭐ Easy | Simple setup |
| **Render** | $21-70 | ⭐⭐ Medium | Free tier available |
| **Fly.io** | $6-20 | ⭐⭐ Medium | Global edge |

---

## ✅ Pros of DigitalOcean Droplet

1. **Full Control**: Complete server access
2. **Predictable Pricing**: Fixed monthly cost
3. **Scalable**: Easy to upgrade/downgrade
4. **No Platform Lock-in**: Your server, your rules
5. **Good Documentation**: Excellent guides
6. **SSD Storage**: Fast performance
7. **Multiple Regions**: Choose data center location
8. **Backups**: Automated daily backups available

---

## ⚠️ Cons of DigitalOcean Droplet

1. **Setup Complexity**: You manage everything
   - Server configuration
   - Security updates
   - SSL certificates
   - Reverse proxy (Nginx)
   - Database setup
   - Process management (PM2)
   - Monitoring

2. **More Expensive**: $28-41/month vs $5-20/month
3. **Manual Maintenance**: You handle updates, security
4. **No Auto-scaling**: Manual scaling required
5. **Technical Knowledge**: Need Linux/server skills

---

## 🚀 Setup Overview

### What You'll Need to Set Up:

1. **Server Setup**:
   - Ubuntu/Debian installation
   - User accounts and SSH keys
   - Firewall configuration (UFW)
   - System updates

2. **Application Stack**:
   - Node.js installation
   - PM2 (process manager)
   - Nginx (reverse proxy)
   - PostgreSQL installation

3. **Application Deployment**:
   - Git repository clone
   - Environment variables
   - Build and run backend
   - Build and run frontend
   - Database migrations

4. **Domain Configuration**:
   - DNS records
   - SSL certificate (Let's Encrypt)
   - Nginx virtual hosts

5. **Monitoring & Maintenance**:
   - Log management
   - Backup strategy
   - Security updates
   - Performance monitoring

---

## 📋 Step-by-Step Setup

### Step 1: Create Droplet

1. **Go to DigitalOcean**: https://cloud.digitalocean.com
2. **Create Droplet**:
   - Choose: Ubuntu 22.04 LTS
   - Plan: Basic, 2GB RAM ($12/month) or 4GB ($24/month)
   - Region: Choose closest to users
   - Authentication: SSH keys (recommended)
   - Hostname: `bld-portal-server`
3. **Create Droplet**

### Step 2: Initial Server Setup

```bash
# SSH into your server
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Create non-root user
adduser deploy
usermod -aG sudo deploy

# Setup SSH for new user
mkdir -p /home/deploy/.ssh
cp ~/.ssh/authorized_keys /home/deploy/.ssh/
chown -R deploy:deploy /home/deploy/.ssh
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
```

### Step 3: Install Node.js

```bash
# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Verify
node --version
npm --version
```

### Step 4: Install PostgreSQL

```bash
# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Create database and user
sudo -u postgres psql
CREATE DATABASE bld_portal_prod;
CREATE USER bld_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE bld_portal_prod TO bld_user;
\q
```

### Step 5: Install Nginx

```bash
# Install Nginx
apt install -y nginx

# Start and enable
systemctl start nginx
systemctl enable nginx
```

### Step 6: Install PM2

```bash
# Install PM2 globally
npm install -g pm2

# Setup PM2 startup
pm2 startup systemd
# Follow the command it outputs
```

### Step 7: Deploy Backend

```bash
# Clone repository
cd /home/deploy
git clone YOUR_REPO_URL BLDCebu-Online-Portal
cd BLDCebu-Online-Portal/backend

# Install dependencies
npm install

# Build
npm run build

# Create .env file
nano .env
# Add your environment variables

# Run migrations
npx prisma migrate deploy

# Start with PM2
pm2 start dist/main.js --name "bld-backend"
pm2 save
```

### Step 8: Deploy Frontend

```bash
# Build frontend
cd /home/deploy/BLDCebu-Online-Portal/frontend
npm install
npm run build

# Start with PM2
pm2 start npm --name "bld-frontend" -- start
pm2 save
```

### Step 9: Configure Nginx

```bash
# Create Nginx config
nano /etc/nginx/sites-available/bld-portal

# Add configuration:
server {
    listen 80;
    server_name app.BLDCebu.com;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable site
ln -s /etc/nginx/sites-available/bld-portal /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

### Step 10: Install SSL Certificate

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate
certbot --nginx -d app.BLDCebu.com

# Auto-renewal is automatic
```

### Step 11: Configure Firewall

```bash
# Configure UFW
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw enable
```

---

## 🔄 Deployment Workflow

### For Updates:

```bash
# SSH into server
ssh deploy@YOUR_DROPLET_IP

# Pull latest code
cd BLDCebu-Online-Portal
git pull

# Backend update
cd backend
npm install
npm run build
pm2 restart bld-backend

# Frontend update
cd ../frontend
npm install
npm run build
pm2 restart bld-frontend
```

---

## 🛡️ Security Checklist

- [ ] SSH key authentication (disable password)
- [ ] Firewall configured (UFW)
- [ ] Non-root user for deployment
- [ ] SSL certificate installed
- [ ] Database password is strong
- [ ] Environment variables secured
- [ ] Regular system updates
- [ ] Fail2ban installed (optional)
- [ ] Backups configured

---

## 💾 Backup Strategy

### Option 1: DigitalOcean Backups
- Enable in Droplet settings
- Cost: 20% of Droplet price
- Automatic daily backups
- Easy restore

### Option 2: Manual Backups
```bash
# Database backup
pg_dump -U bld_user bld_portal_prod > backup.sql

# Application backup
tar -czf app-backup.tar.gz /home/deploy/BLDCebu-Online-Portal
```

---

## 📊 When to Choose DigitalOcean

### Choose DigitalOcean If:
- ✅ You want full control
- ✅ You have Linux/server experience
- ✅ You want predictable costs
- ✅ You need custom configurations
- ✅ You want to avoid platform lock-in
- ✅ Budget allows $28-41/month

### Choose Vercel + Railway If:
- ✅ You want easiest setup
- ✅ You want lowest cost ($5-20/month)
- ✅ You prefer managed services
- ✅ You want automatic scaling
- ✅ You want minimal maintenance

---

## 💡 Recommendation

### For Your Use Case:

**If you have server experience**: DigitalOcean is good
- Full control
- Predictable $28-41/month
- No platform limitations

**If you want easiest/cheapest**: Vercel + Railway
- $5-20/month (cheaper)
- Much easier setup
- Less maintenance

**Best of Both Worlds**: Start with Vercel + Railway
- Get it running quickly
- Lower cost
- Migrate to DigitalOcean later if needed

---

## 📝 Quick Cost Summary

| Setup | Monthly Cost | Complexity |
|------|-------------|------------|
| **Vercel + Railway** | $5-20 | ⭐ Easy |
| **DigitalOcean Droplet** | $28-41 | ⭐⭐⭐ Hard |
| **Railway (all)** | $10-15 | ⭐ Easy |

**My Recommendation**: Start with **Vercel + Railway** ($5-20/month), then migrate to DigitalOcean later if you need more control.

---

## 🚀 Next Steps

If you choose DigitalOcean:
1. Create Droplet (2GB or 4GB)
2. Follow setup steps above
3. Configure domain DNS
4. Deploy applications
5. Set up SSL and monitoring

I can create detailed setup scripts for DigitalOcean if you want to go this route!
