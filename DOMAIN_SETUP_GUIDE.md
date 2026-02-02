# Domain Setup Guide for BLDCebu.com

## ✅ Yes, You Can Use Your Domain!

Your domain `BLDCebu.com` can be used with **any** deployment platform. Here's how to set it up with each option:

---

## 🚀 Option 1: Railway (Recommended)

### Setup Steps:

1. **Deploy your app to Railway** (backend + frontend)

2. **Add Custom Domain**:
   - Go to Railway dashboard
   - Select your service (frontend)
   - Go to "Settings" → "Domains"
   - Click "Add Domain"
   - Enter: `BLDCebu.com` and `www.BLDCebu.com`

3. **Configure DNS** (at your domain registrar):
   
   Railway will provide you with DNS records. Typically:
   ```
   Type: CNAME
   Name: @ (or blank for root domain)
   Value: [railway-provided-domain].railway.app
   
   Type: CNAME
   Name: www
   Value: [railway-provided-domain].railway.app
   ```
   
   **Note**: If your registrar doesn't support CNAME for root domain (@), use:
   ```
   Type: A
   Name: @
   Value: [Railway IP address] (they'll provide this)
   ```

4. **SSL Certificate**: Railway automatically provisions free SSL certificates via Let's Encrypt

5. **Wait for DNS propagation** (usually 5-30 minutes)

**Result**: Your app will be live at `https://BLDCebu.com` and `https://www.BLDCebu.com`

---

## 🌐 Option 2: Render

### Setup Steps:

1. **Deploy your app to Render**

2. **Add Custom Domain**:
   - Go to Render dashboard
   - Select your service
   - Go to "Settings" → "Custom Domains"
   - Click "Add"
   - Enter: `BLDCebu.com`

3. **Configure DNS**:
   
   Render will show you DNS records. Typically:
   ```
   Type: CNAME
   Name: @
   Value: [render-provided-domain].onrender.com
   
   Type: CNAME
   Name: www
   Value: [render-provided-domain].onrender.com
   ```

4. **SSL**: Render automatically provisions SSL certificates

**Result**: `https://BLDCebu.com` and `https://www.BLDCebu.com`

---

## ⚡ Option 3: Vercel (Frontend) + Railway (Backend)

### Frontend (Vercel):

1. **Deploy Next.js to Vercel**

2. **Add Domain**:
   - Go to Vercel dashboard
   - Select your project
   - Go to "Settings" → "Domains"
   - Add: `BLDCebu.com` and `www.BLDCebu.com`

3. **Configure DNS**:
   
   Vercel will show you DNS records:
   ```
   Type: A
   Name: @
   Value: 76.76.21.21 (Vercel's IP)
   
   Type: CNAME
   Name: www
   Value: cname.vercel-dns.com
   ```

4. **SSL**: Automatic via Vercel

### Backend (Railway):

- Deploy backend to Railway
- Use Railway's provided URL for API calls
- Configure CORS to allow `BLDCebu.com`

**Result**: Frontend at `https://BLDCebu.com`, backend API at `https://api.BLDCebu.com` (if you set up subdomain)

---

## 🖥️ Option 4: Self-Hosted VPS

### Setup Steps:

1. **Deploy to VPS** (DigitalOcean, Linode, etc.)

2. **Point Domain to VPS**:
   
   Configure DNS at your registrar:
   ```
   Type: A
   Name: @
   Value: [Your VPS IP address]
   
   Type: A
   Name: www
   Value: [Your VPS IP address]
   ```

3. **Configure Nginx** (reverse proxy):
   ```nginx
   server {
       listen 80;
       server_name BLDCebu.com www.BLDCebu.com;
       
       location / {
           proxy_pass http://localhost:3000;  # Frontend
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
       
       location /api {
           proxy_pass http://localhost:4000;  # Backend
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
       }
   }
   ```

4. **Install SSL** (Let's Encrypt):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d BLDCebu.com -d www.BLDCebu.com
   ```

**Result**: `https://BLDCebu.com` with full control

---

## 📋 DNS Configuration Checklist

### Where is your domain registered?
- **GoDaddy**
- **Namecheap**
- **Google Domains**
- **Cloudflare**
- **Other**: _______________

### DNS Records You'll Need:

1. **Root Domain** (`BLDCebu.com`):
   - Type: `A` or `CNAME` (depends on platform)
   - Value: [Platform-provided value]

2. **WWW Subdomain** (`www.BLDCebu.com`):
   - Type: `CNAME`
   - Value: [Platform-provided value]

3. **API Subdomain** (optional, for backend):
   - Type: `CNAME`
   - Name: `api`
   - Value: [Backend URL]

---

## 🎯 Recommended Setup for Your Use Case

### Best Option: **Railway with Custom Domain**

**Why**:
- ✅ Easiest setup
- ✅ Automatic SSL
- ✅ Handles both root and www
- ✅ Good performance
- ✅ ~$15-30/month total

**Steps**:
1. Deploy backend + frontend to Railway
2. Add `BLDCebu.com` domain in Railway dashboard
3. Copy DNS records from Railway
4. Add DNS records at your domain registrar
5. Wait 5-30 minutes for propagation
6. Done! 🎉

---

## 🔧 Quick Setup Script

I can create a script to help you:
1. Deploy to Railway
2. Get the DNS records
3. Guide you through domain setup

Would you like me to create this?

---

## ❓ Common Questions

### Q: Can I use both root and www?
**A**: Yes! Most platforms support both `BLDCebu.com` and `www.BLDCebu.com`

### Q: How long does DNS propagation take?
**A**: Usually 5-30 minutes, but can take up to 48 hours (rare)

### Q: Do I need to pay extra for SSL?
**A**: No! All platforms provide free SSL certificates (Let's Encrypt)

### Q: Can I use a subdomain for the API?
**A**: Yes! You can use `api.BLDCebu.com` for your backend

### Q: What if my registrar doesn't support CNAME for root?
**A**: Use A record instead (platform will provide IP address)

---

## 🚀 Next Steps

1. **Choose a platform** (I recommend Railway)
2. **Deploy your app**
3. **Add custom domain in platform dashboard**
4. **Configure DNS at your registrar**
5. **Wait for propagation**
6. **Test**: Visit `https://BLDCebu.com`

**Your domain is ready to use!** 🎉
