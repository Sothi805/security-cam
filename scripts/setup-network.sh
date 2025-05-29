#!/bin/bash

echo
echo "========================================"
echo "   CCTV Development Network Setup"
echo "========================================"
echo

# Get the current IP address
echo "Detecting your PC's IP address..."

# Try to get IP address (Linux/macOS)
if command -v ip &> /dev/null; then
    CURRENT_IP=$(ip route get 1.1.1.1 | grep -oP 'src \K\S+')
elif command -v ifconfig &> /dev/null; then
    CURRENT_IP=$(ifconfig | grep -Eo 'inet (addr:)?([0-9]*\.){3}[0-9]*' | grep -Eo '([0-9]*\.){3}[0-9]*' | grep -v '127.0.0.1' | head -n1)
else
    echo "ERROR: Could not detect IP address automatically"
    echo "Please run 'ifconfig' or 'ip addr' and find your IP address manually"
    exit 1
fi

if [ -z "$CURRENT_IP" ]; then
    echo "ERROR: Could not detect IP address automatically"
    echo "Please run 'ifconfig' or 'ip addr' and find your IP address manually"
    exit 1
fi

echo
echo "✓ Detected IP Address: $CURRENT_IP"
echo

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file from example..."
    if [ -f example.env ]; then
        cp example.env .env
        echo "✓ .env file created from example.env"
    else
        echo "ERROR: example.env file not found!"
        echo "Please ensure you're in the security-cam directory"
        exit 1
    fi
else
    echo "✓ .env file already exists"
fi

echo
echo "========================================"
echo "        Network Configuration"
echo "========================================"
echo
echo "Your development server will be accessible at:"
echo
echo "📍 From this PC:"
echo "   Dashboard: http://localhost:3000"
echo "   API:       http://localhost:3000/api"
echo
echo "📱 From mobile devices (same WiFi):"
echo "   Dashboard: http://$CURRENT_IP:3000"
echo "   API:       http://$CURRENT_IP:3000/api"
echo

# Check if Flutter API service file exists
if [ -f "../app_live/lib/services/api_service.dart" ]; then
    echo "========================================"
    echo "     Mobile App Configuration"
    echo "========================================"
    echo
    echo "To connect your mobile app, update this line in:"
    echo "app_live/lib/services/api_service.dart"
    echo
    echo "Change:"
    echo "  static const String _devBaseUrl = 'http://localhost:3000';"
    echo "To:"
    echo "  static const String _devBaseUrl = 'http://$CURRENT_IP:3000';"
    echo
fi

echo "========================================"
echo "       Firewall Configuration"
echo "========================================"
echo
echo "If you can't access from other devices, you may need to:"
echo "1. Configure your firewall to allow port 3000"
echo "2. On Ubuntu/Debian: sudo ufw allow 3000"
echo "3. On CentOS/RHEL: sudo firewall-cmd --add-port=3000/tcp --permanent"
echo

read -p "Configure firewall now? (y/n): " ADD_FIREWALL_RULE
if [[ $ADD_FIREWALL_RULE =~ ^[Yy]$ ]]; then
    echo
    echo "Configuring firewall..."
    
    # Try different firewall commands
    if command -v ufw &> /dev/null; then
        sudo ufw allow 3000/tcp
        echo "✓ UFW rule added for port 3000"
    elif command -v firewall-cmd &> /dev/null; then
        sudo firewall-cmd --add-port=3000/tcp --permanent
        sudo firewall-cmd --reload
        echo "✓ Firewalld rule added for port 3000"
    else
        echo "⚠ Could not detect firewall. You may need to configure manually."
    fi
fi

echo
echo "========================================"
echo "          Quick Test"
echo "========================================"
echo
read -p "Start development server now? (y/n): " START_SERVER
if [[ $START_SERVER =~ ^[Yy]$ ]]; then
    echo
    echo "Starting development server..."
    echo "Server will be available at http://$CURRENT_IP:3000"
    echo "Press Ctrl+C to stop the server"
    echo
    npm run dev
else
    echo
    echo "To start the server manually, run:"
    echo "  npm run dev"
    echo
    echo "Then access the dashboard at:"
    echo "  http://$CURRENT_IP:3000"
    echo
fi

echo
echo "========================================"
echo "       Setup Complete!"
echo "========================================"
echo
echo "📝 Next steps:"
echo "1. Start the server: npm run dev"
echo "2. Access dashboard: http://$CURRENT_IP:3000"
echo "3. Update mobile app API URL (if using)"
echo "4. Test from other devices on same WiFi"
echo 