#!/bin/bash
# Quick script to get your local IP address for QR code scanning

echo "🔍 Finding your local IP address..."
echo ""

# Try different methods to get IP
if command -v ipconfig &> /dev/null; then
  # macOS
  IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)
  if [ -n "$IP" ]; then
    echo "✅ Your local IP address is: $IP"
    echo ""
    echo "📝 Add this to your backend/.env file:"
    echo "   LOCAL_IP=$IP"
    echo "   FRONTEND_URL=http://$IP:3000"
    echo ""
    echo "Then restart your backend server and regenerate the QR code."
    exit 0
  fi
fi

# Fallback to ifconfig
if command -v ifconfig &> /dev/null; then
  IP=$(ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1)
  if [ -n "$IP" ]; then
    echo "✅ Your local IP address is: $IP"
    echo ""
    echo "📝 Add this to your backend/.env file:"
    echo "   LOCAL_IP=$IP"
    echo "   FRONTEND_URL=http://$IP:3000"
    echo ""
    echo "Then restart your backend server and regenerate the QR code."
    exit 0
  fi
fi

echo "❌ Could not automatically detect your IP address."
echo ""
echo "Please find it manually:"
echo "   macOS: System Settings > Network > Wi-Fi > Details > IP Address"
echo "   Or run: ifconfig | grep 'inet ' | grep -v 127.0.0.1"
