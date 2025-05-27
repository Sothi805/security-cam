#!/bin/bash

# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y ffmpeg nodejs npm build-essential thermald cpufrequtils lm-sensors fancontrol

# Configure CPU governor for better thermal management
sudo systemctl enable thermald
sudo cpufreq-set -g conservative

# Install PM2 globally
sudo npm install -g pm2

# Create necessary directories
sudo mkdir -p /var/log/cctv-api
sudo mkdir -p /var/www/cctv-streaming
sudo chown -R $USER:$USER /var/log/cctv-api
sudo chown -R $USER:$USER /var/www/cctv-streaming

# Install project dependencies
npm install

# Setup PM2 startup script
sudo pm2 startup systemd
pm2 start ecosystem.config.js
pm2 save

# Setup monitoring tools
sudo apt install -y htop iotop sysstat

# Configure sensors
sudo sensors-detect --auto

# Create enhanced monitoring script for mini desktop
cat > /var/www/cctv-streaming/monitor.sh << 'EOL'
#!/bin/bash

# Get CPU temperature and fan speeds
TEMP=$(sensors | grep 'Core 0' | awk '{print $3}')
FANS=$(sensors | grep fan | awk '{print $2 " RPM"}')
MEM=$(free -m | awk 'NR==2{printf "%.2f%%", $3*100/$2 }')
DISK=$(df -h / | awk 'NR==2{printf "%s", $5}')
CPU=$(top -bn1 | grep "Cpu(s)" | awk '{print $2 + $4}')
DISK_TEMP=$(sudo hddtemp /dev/sda 2>/dev/null | awk '{print $NF}')

# Log all metrics
echo "$(date) - System Status" >> /var/log/cctv-api/monitor.log
echo "CPU Usage: $CPU%" >> /var/log/cctv-api/monitor.log
echo "CPU Temperature: $TEMP" >> /var/log/cctv-api/monitor.log
echo "Fan Speeds: $FANS" >> /var/log/cctv-api/monitor.log
echo "Memory Usage: $MEM" >> /var/log/cctv-api/monitor.log
echo "Disk Usage: $DISK" >> /var/log/cctv-api/monitor.log
echo "Disk Temperature: $DISK_TEMP°C" >> /var/log/cctv-api/monitor.log
echo "-------------------" >> /var/log/cctv-api/monitor.log

# Temperature-based alerts
TEMP_VALUE=$(echo $TEMP | sed 's/[^0-9.]//g')
if (( $(echo "$TEMP_VALUE > 70" | bc -l) )); then
    echo "WARNING: High CPU temperature: $TEMP" >> /var/log/cctv-api/alerts.log
    # Reduce system load if temperature is too high
    pm2 restart all --parallel
fi

# Resource alerts
if [[ ${CPU%.*} -gt 85 ]]; then
    echo "High CPU usage: $CPU%" >> /var/log/cctv-api/alerts.log
fi

if [[ ${MEM%.*} -gt 85 ]]; then
    echo "High memory usage: $MEM" >> /var/log/cctv-api/alerts.log
fi

if [[ ${DISK%?} -gt 85 ]]; then
    echo "High disk usage: $DISK" >> /var/log/cctv-api/alerts.log
fi
EOL

chmod +x /var/www/cctv-streaming/monitor.sh

# Add monitoring script to crontab (runs every 3 minutes)
(crontab -l 2>/dev/null; echo "*/3 * * * * /var/www/cctv-streaming/monitor.sh") | crontab -

# Create automatic cleanup script for temperature management
cat > /var/www/cctv-streaming/thermal-management.sh << 'EOL'
#!/bin/bash

# If CPU temperature is too high, restart FFmpeg processes one by one
TEMP_VALUE=$(sensors | grep 'Core 0' | awk '{print $3}' | sed 's/[^0-9.]//g')
if (( $(echo "$TEMP_VALUE > 75" | bc -l) )); then
    echo "$(date) - High temperature detected, performing thermal management" >> /var/log/cctv-api/thermal.log
    pm2 restart all --parallel
    sleep 300  # Wait 5 minutes for system to cool down
fi
EOL

chmod +x /var/www/cctv-streaming/thermal-management.sh

# Add thermal management to crontab (runs every 5 minutes)
(crontab -l 2>/dev/null; echo "*/5 * * * * /var/www/cctv-streaming/thermal-management.sh") | crontab -

# Create maintenance reminder script
cat > /var/www/cctv-streaming/maintenance-reminder.sh << 'EOL'
#!/bin/bash

echo "Monthly Maintenance Checklist:" > /var/log/cctv-api/maintenance.log
echo "1. Clean dust from mini desktop (IMPORTANT for cooling)" >> /var/log/cctv-api/maintenance.log
echo "2. Check all fan operations" >> /var/log/cctv-api/maintenance.log
echo "3. Verify temperature readings" >> /var/log/cctv-api/maintenance.log
echo "4. Check disk health: $(sudo smartctl -H /dev/sda)" >> /var/log/cctv-api/maintenance.log
echo "5. Backup configuration files" >> /var/log/cctv-api/maintenance.log
EOL

chmod +x /var/www/cctv-streaming/maintenance-reminder.sh

# Add monthly maintenance reminder
(crontab -l 2>/dev/null; echo "0 0 1 * * /var/www/cctv-streaming/maintenance-reminder.sh") | crontab -

echo "Mini Desktop Server Setup completed! Important notes:"
echo "1. Keep the system in a well-ventilated area"
echo "2. Monitor temperatures regularly: sensors"
echo "3. Check maintenance log monthly: cat /var/log/cctv-api/maintenance.log"
echo "4. Clean dust regularly"
echo "5. Monitor resource usage: htop" 