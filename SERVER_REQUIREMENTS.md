# Server Requirements & Hardware Specifications

Comprehensive hardware and system requirements for the CCTV Streaming Backend.

## 🖥️ System Requirements

### Minimum Requirements

| Component | Specification | Notes |
|-----------|---------------|-------|
| **CPU** | 2 cores @ 2.0GHz | x86_64 architecture |
| **RAM** | 4GB | 8GB recommended for 4+ cameras |
| **Storage** | 50GB available | Plus retention storage |
| **Network** | 100Mbps | Stable connection to cameras |
| **OS** | Ubuntu 20.04+ / Windows 10+ | Linux preferred for production |

### Recommended Production Specs

| Component | Specification | Purpose |
|-----------|---------------|---------|
| **CPU** | 4+ cores @ 3.0GHz | FFmpeg encoding, multiple streams |
| **RAM** | 16GB | Buffer management, multiple processes |
| **Storage** | 1TB SSD + HDD array | Hot storage + archival |
| **Network** | Gigabit Ethernet | High-bandwidth streaming |
| **GPU** | Hardware encoding capable | Optional: NVENC/QuickSync |

## 📊 Capacity Planning

### Storage Requirements

#### Per Camera Daily Storage (480p @ 12fps)
- **Low Quality**: ~1GB per day
- **High Quality**: ~5-15GB per day (depends on resolution)
- **Total**: ~6-16GB per camera per day

#### Monthly Storage Examples
| Cameras | 30-Day Storage (Low + High) |
|---------|----------------------------|
| 2 cameras | ~360GB - 960GB |
| 4 cameras | ~720GB - 1.9TB |
| 8 cameras | ~1.4TB - 3.8TB |
| 16 cameras | ~2.9TB - 7.7TB |

### Memory Requirements

#### Base Application
- **Node.js Runtime**: ~100-200MB
- **Stream Managers**: ~50MB per camera
- **Buffer Management**: ~100MB per active stream

#### Memory Formula
```
Total RAM = Base (500MB) + (Cameras × 150MB) + OS Overhead (2GB)

Examples:
- 4 cameras: 500MB + 600MB + 2GB = 3.1GB minimum
- 8 cameras: 500MB + 1.2GB + 2GB = 3.7GB minimum
- 16 cameras: 500MB + 2.4GB + 2GB = 4.9GB minimum
```

### CPU Requirements

#### Processing Load per Camera
- **Low Quality Encoding**: ~0.3 CPU cores
- **High Quality (Copy)**: ~0.1 CPU cores
- **Management Overhead**: ~0.1 CPU cores

#### CPU Formula
```
Total Cores = (Cameras × 0.4) + System Overhead (1 core)

Examples:
- 4 cameras: (4 × 0.4) + 1 = 2.6 cores minimum
- 8 cameras: (8 × 0.4) + 1 = 4.2 cores minimum
- 16 cameras: (16 × 0.4) + 1 = 7.4 cores minimum
```

### Network Bandwidth

#### Per Camera Bandwidth (Inbound RTSP)
- **480p @ 12fps**: ~1-2 Mbps
- **1080p @ 25fps**: ~4-8 Mbps
- **4K @ 30fps**: ~15-25 Mbps

#### Per Camera Bandwidth (Outbound HLS)
- **Low Quality**: ~1 Mbps
- **High Quality**: Same as source

#### Total Bandwidth Formula
```
Inbound = Sum of all camera RTSP streams
Outbound = (Concurrent viewers × Stream bitrate)

Example: 4 cameras (1080p) + 10 viewers
Inbound: 4 × 6Mbps = 24Mbps
Outbound: 10 × 1Mbps = 10Mbps (low quality viewers)
Total: ~35Mbps peak
```

## 🏗️ Infrastructure Recommendations

### Small Scale (2-4 Cameras)

#### Development/Home Use
```yaml
CPU: Intel i5 or AMD Ryzen 5 (4 cores)
RAM: 8GB DDR4
Storage: 500GB SSD
Network: 100Mbps
OS: Ubuntu 22.04 LTS
Cost: ~$500-800
```

#### Recommended Hardware
- **Mini PC**: Intel NUC, Beelink SER
- **Single Board**: Raspberry Pi 4 (8GB) for low-end
- **Cloud**: AWS t3.medium, DigitalOcean 4GB

### Medium Scale (5-12 Cameras)

#### Business/Office Use
```yaml
CPU: Intel i7 or AMD Ryzen 7 (8 cores)
RAM: 16GB DDR4
Storage: 1TB NVMe SSD + 4TB HDD
Network: Gigabit Ethernet
GPU: Optional NVIDIA GTX 1650 (hardware encoding)
OS: Ubuntu Server 22.04 LTS
Cost: ~$1,200-2,000
```

#### Recommended Hardware
- **Workstation**: Dell Precision, HP Z-series
- **Server**: Dell PowerEdge T340, HP ProLiant ML30
- **Cloud**: AWS c5.2xlarge, DigitalOcean 16GB

### Large Scale (12+ Cameras)

#### Enterprise/Surveillance Center
```yaml
CPU: Intel Xeon or AMD EPYC (16+ cores)
RAM: 32GB+ DDR4 ECC
Storage: 2TB NVMe SSD + 20TB+ HDD array
Network: 10Gbps or bonded Gigabit
GPU: NVIDIA Quadro/Tesla (hardware encoding)
Redundancy: Dual PSU, RAID storage
OS: Ubuntu Server 22.04 LTS
Cost: ~$3,000-8,000+
```

#### Recommended Hardware
- **Server**: Dell PowerEdge R640, HP ProLiant DL360
- **Storage**: Synology, QNAP NAS for archival
- **Cloud**: AWS c5.4xlarge+, dedicated servers

## 🔧 Storage Architecture

### Hot Storage (Active Streams)
- **Type**: NVMe SSD or high-performance SSD
- **Purpose**: Current day recordings, live streams
- **Size**: 100GB + (cameras × 20GB)
- **Performance**: High IOPS, low latency

### Warm Storage (Recent History)
- **Type**: SATA SSD or fast HDD
- **Purpose**: Last 7-30 days
- **Size**: Based on retention policy
- **Performance**: Good sequential read/write

### Cold Storage (Archives)
- **Type**: Large capacity HDD, tape, or cloud
- **Purpose**: Long-term archival
- **Size**: Unlimited
- **Performance**: Slower access acceptable

### Storage Hierarchy Example
```
/opt/cctv-streaming/
├── hls/ (Hot - NVMe SSD)
│   └── current day streams
├── archive/ (Warm - SATA SSD/HDD)
│   └── last 30 days
└── backup/ (Cold - Network storage)
    └── older archives
```

## 🌐 Network Requirements

### Camera Network
- **Dedicated VLAN**: Recommended for security
- **Bandwidth**: 1.5× total camera bitrate
- **Latency**: <50ms to cameras
- **Reliability**: UPS protected switches

### Internet Connection
- **Upload**: 2× max concurrent viewer bandwidth
- **Download**: For remote management/updates
- **Backup**: Secondary connection for critical sites

### Network Architecture
```
Internet ←→ Firewall ←→ Main Switch
                           ├── Server VLAN
                           ├── Camera VLAN (isolated)
                           └── Management VLAN
```

## 🔋 Power & Environmental

### Power Requirements
- **Small System**: 50-150W continuous
- **Medium System**: 200-500W continuous
- **Large System**: 500-1500W continuous

### UPS Recommendations
- **Runtime**: 15-30 minutes minimum
- **Capacity**: 2× system power rating
- **Features**: Automatic shutdown integration

### Environmental
- **Temperature**: 10-35°C (50-95°F)
- **Humidity**: 20-80% non-condensing
- **Ventilation**: Adequate airflow
- **Location**: Secure, access-controlled

## 🏗️ Deployment Options

### On-Premises
#### Advantages
- ✅ Full control and privacy
- ✅ No internet dependency
- ✅ Lower latency
- ✅ One-time cost

#### Considerations
- ⚠️ Hardware maintenance
- ⚠️ Power/cooling costs
- ⚠️ Physical security

### Cloud Deployment
#### Advantages
- ✅ Scalability
- ✅ Managed infrastructure
- ✅ Geographic distribution
- ✅ Professional support

#### Considerations
- ⚠️ Ongoing costs
- ⚠️ Internet dependency
- ⚠️ Data transfer costs

### Hybrid Setup
- **Local recording** for reliability
- **Cloud streaming** for remote access
- **Edge processing** for real-time analysis

## 📊 Cost Analysis

### On-Premises Total Cost of Ownership (3 Years)

#### Small Scale (4 Cameras)
```
Hardware: $1,500
Power (3 years): $400
Maintenance: $300
Total: ~$2,200
```

#### Medium Scale (8 Cameras)
```
Hardware: $3,000
Power (3 years): $800
Maintenance: $600
Storage expansion: $500
Total: ~$4,900
```

#### Large Scale (16 Cameras)
```
Hardware: $8,000
Power (3 years): $2,000
Maintenance: $1,500
Storage/Network: $2,000
Total: ~$13,500
```

### Cloud Costs (Monthly)

#### AWS/Azure Estimates
- **t3.medium (4 cameras)**: ~$30-50/month
- **c5.large (8 cameras)**: ~$60-100/month
- **c5.xlarge (16 cameras)**: ~$150-250/month

*Plus storage, bandwidth, and management costs*

## 🔍 Performance Optimization

### Hardware Acceleration
- **Intel QuickSync**: Built-in H.264 encoding
- **NVIDIA NVENC**: Dedicated encoding hardware
- **AMD VCE**: AMD's hardware encoding

### SSD Optimization
```bash
# Enable TRIM
sudo systemctl enable fstrim.timer

# Optimize mount options
/dev/sda1 /opt/cctv-streaming ext4 noatime,discard 0 2
```

### Network Optimization
```bash
# Increase network buffers
echo 'net.core.rmem_max = 26214400' >> /etc/sysctl.conf
echo 'net.core.rmem_default = 26214400' >> /etc/sysctl.conf
```

## 📈 Scaling Guidelines

### Vertical Scaling (Scale Up)
1. **Add RAM** - Cheapest improvement
2. **Upgrade CPU** - For more cameras
3. **Add SSD storage** - For performance
4. **GPU acceleration** - For encoding efficiency

### Horizontal Scaling (Scale Out)
1. **Multiple servers** - Geographic distribution
2. **Load balancing** - Distribute camera load
3. **Shared storage** - Central file system
4. **Database clustering** - If using databases

## 🔧 Monitoring Requirements

### System Monitoring
- **CPU/RAM usage** - Resource utilization
- **Disk I/O** - Storage performance
- **Network throughput** - Bandwidth usage
- **Temperature** - Hardware health

### Application Monitoring
- **Stream health** - All cameras streaming
- **Storage usage** - Cleanup effectiveness
- **Error rates** - System reliability
- **Response times** - API performance

### Recommended Tools
- **System**: htop, iotop, netstat, sensors
- **Application**: Built-in status endpoints
- **Remote**: Prometheus + Grafana, Zabbix

---

**Next Steps**: See [DEPLOYMENT.md](DEPLOYMENT.md) for production deployment guide 