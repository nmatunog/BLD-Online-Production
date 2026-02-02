# Getting Your Local IP Address for Phone QR Code Scanning

When testing QR code scanning with your phone, the QR code needs to use your computer's local IP address instead of `localhost`, because `localhost` on your phone refers to the phone itself, not your computer.

## Quick Method (macOS/Linux)

Run this command in your terminal to find your local IP:

```bash
# macOS/Linux
ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1

# Or simpler (macOS)
ipconfig getifaddr en0

# Or check network settings
# System Settings > Network > Wi-Fi > Details > IP Address
```

## Set Environment Variable

Once you have your IP (e.g., `192.168.1.100`), set it in your backend `.env` file:

```bash
# In backend/.env
LOCAL_IP=192.168.1.100
FRONTEND_URL=http://192.168.1.100:3000
```

Then restart your backend server.

## Alternative: Use ngrok (for external testing)

If you want to test from outside your local network:

1. Install ngrok: `brew install ngrok` (macOS) or download from ngrok.com
2. Run: `ngrok http 3000`
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Set in backend `.env`: `FRONTEND_URL=https://abc123.ngrok.io`

## Testing

1. Generate a new QR code for an event (the old one will have localhost)
2. Scan with your phone camera
3. It should open the check-in page on your phone
