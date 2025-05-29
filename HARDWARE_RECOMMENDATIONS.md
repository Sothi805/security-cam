# 🖥️ Ubuntu Server Hardware Recommendations for 24/7 CCTV Streaming

## 📋 System Requirements Overview

**Workload:** 14+ cameras × 2 quality streams = 28+ simultaneous FFmpeg processes
- **High Quality:** Native resolution stream copy (minimal CPU load)
- **Low Quality:** 480p@12fps H.264 encoding (moderate CPU load per stream)
- **Storage:** HLS segments with configurable retention (30 min - 30 days)
- **Network:** Multiple RTSP inputs + HTTP streaming outputs
- **Uptime:** 24/7 operation with auto-restart capabilities

---

## 💰 Build Recommendations (4 Tiers)

### 🥉 Tier 1: Budget Build (~$500)
**Target:** Small-scale deployment, basic reliability

| Component | Model | Price | Notes |
|-----------|-------|-------|-------|
| **CPU** | AMD Ryzen 5 5600 (6C/12T) | $107 | Zen 3, solid for moderate encoding |
| **Motherboard** | MSI B450M PRO-VDH MAX | $65 | Budget AM4, sufficient I/O |
| **RAM** | Corsair Vengeance LPX 32GB DDR4-3200 | $85 | 32GB for stream buffering |
| **Storage (Boot)** | Kingston NV2 500GB NVMe | $28 | Budget NVMe for OS/apps |
| **Storage (Streams)** | Seagate BarraCuda 4TB HDD | $85 | 4TB for video storage |
| **PSU** | EVGA BR 600W 80+ Bronze | $65 | Reliable, sufficient power |
| **Case** | Fractal Design Core 1000 | $45 | Compact, good airflow |
| **Cooling** | Stock AMD Wraith Stealth | $0 | Included with CPU |
| **Network** | Realtek PCIe Gigabit NIC | $15 | Additional network port |
| **Total** | | **~$495** | |

**Performance:** Handles 8-12 cameras comfortably, basic redundancy

---

### 🥈 Tier 2: Balanced Build (~$700)
**Target:** Production deployment, good performance/reliability balance

| Component | Model | Price | Notes |
|-----------|-------|-------|-------|
| **CPU** | AMD Ryzen 7 5700X (8C/16T) | $140 | More cores for encoding |
| **Motherboard** | MSI B550M PRO-B | $85 | PCIe 4.0, better VRMs |
| **RAM** | G.Skill Ripjaws V 32GB DDR4-3600 | $95 | Faster memory, same capacity |
| **Storage (Boot)** | Samsung 980 1TB NVMe | $70 | Faster NVMe with DRAM cache |
| **Storage (Streams)** | WD Purple Pro 8TB HDD | $180 | Surveillance-optimized drive |
| **PSU** | Seasonic Focus GX-650 80+ Gold | $90 | Modular, higher efficiency |
| **Case** | Fractal Design Define Mini C | $85 | Better cooling, noise dampening |
| **Cooling** | be quiet! Pure Rock 2 | $40 | Quieter, better cooling |
| **Network** | Intel I225-V PCIe Gigabit | $30 | Intel NIC for reliability |
| **Total** | | **~$715** | |

**Performance:** Handles 14+ cameras easily, good for production use

---

### 🥇 Tier 3: Strong Mid-High Build (~$900)
**Target:** High-performance deployment, excellent reliability

| Component | Model | Price | Notes |
|-----------|-------|-------|-------|
| **CPU** | AMD Ryzen 9 5900X (12C/24T) | $230 | High core count for heavy loads |
| **Motherboard** | ASUS TUF Gaming B550M-Plus | $130 | Robust VRMs, multiple M.2 slots |
| **RAM** | Corsair Vengeance LPX 64GB DDR4-3600 | $180 | 64GB for large stream buffers |
| **Storage (Boot)** | Samsung 980 Pro 1TB NVMe | $90 | High-performance NVMe |
| **Storage (Cache)** | WD Red SN700 2TB NVMe | $150 | NVMe for hot segment storage |
| **Storage (Archive)** | WD Purple Pro 12TB HDD | $250 | Large capacity surveillance drive |
| **PSU** | Seasonic Focus PX-750 80+ Platinum | $120 | Premium efficiency, fully modular |
| **Case** | Fractal Design Define R6 | $140 | Excellent cooling and expansion |
| **Cooling** | Noctua NH-U12S Redux | $50 | Premium air cooling |
| **Network** | Intel X550-T2 Dual 10GbE PCIe | $180 | Future-proof networking |
| **Total** | | **~$1,520** | Over budget but excellent |

**Adjusted Version (~$900):**
- CPU: Ryzen 7 5800X ($160) instead of 5900X
- RAM: 32GB ($95) instead of 64GB  
- Network: Single Intel Gigabit NIC ($30)
- Storage: Single 8TB HDD ($180)
- **Adjusted Total: ~$895**

**Performance:** Handles 20+ cameras with room to grow

---

### 💎 Tier 4: High-End Build ($1000+)
**Target:** Enterprise-grade deployment, maximum performance

| Component | Model | Price | Notes |
|-----------|-------|-------|-------|
| **CPU** | AMD Ryzen 9 5950X (16C/32T) | $300 | Maximum AM4 performance |
| **Motherboard** | ASUS ROG Strix X570-E Gaming | $200 | Premium features, PCIe 4.0 |
| **RAM** | G.Skill Trident Z Neo 64GB DDR4-3600 | $220 | High-speed, large capacity |
| **Storage (Boot)** | Samsung 980 Pro 2TB NVMe | $150 | Premium NVMe with extra space |
| **Storage (Cache)** | Samsung 980 Pro 4TB NVMe | $300 | Large NVMe for segment caching |
| **Storage (Archive)** | 2x WD Purple Pro 16TB RAID1 | $600 | Redundant storage (32TB usable) |
| **PSU** | Seasonic Prime TX-850 80+ Titanium | $200 | Top-tier efficiency and reliability |
| **Case** | Fractal Design Define 7XL | $180 | Maximum expandability |
| **Cooling** | Noctua NH-D15 chromax.black | $110 | Best air cooling available |
| **Network** | Intel X710-DA2 Dual 10GbE SFP+ | $300 | Professional networking |
| **RAID Card** | LSI MegaRAID SAS 9361-8i | $250 | Hardware RAID controller |
| **UPS** | APC Smart-UPS 1500VA | $200 | Battery backup for power outages |
| **Total** | | **~$3,010** | Enterprise setup |

**Practical $1000 Version:**
- CPU: Ryzen 9 5900X ($230)
- Motherboard: MSI MAG X570 Tomahawk ($160)  
- RAM: 32GB DDR4-3600 ($95)
- Storage: 1TB NVMe + 8TB HDD ($250)
- PSU: 750W 80+ Gold ($120)
- Case: Define R6 ($140)
- **Practical Total: ~$995**

---

## 🔧 Detailed Component Rationale

### 💻 CPU Selection (AMD Focus)

**Why AMD for 24/7 Streaming:**
- **Better Price/Performance:** More cores per dollar
- **Lower Power Consumption:** Better efficiency under sustained loads
- **Platform Longevity:** AM4 had 5+ year support
- **Multi-threading Excellence:** Superior for parallel FFmpeg processes

**Recommended Models by Tier:**
1. **Ryzen 5 5600:** 6C/12T - handles ~12 streams efficiently
2. **Ryzen 7 5700X/5800X:** 8C/16T - sweet spot for 14-20 streams  
3. **Ryzen 9 5900X:** 12C/24T - excellent for 20+ streams
4. **Ryzen 9 5950X:** 16C/32T - maximum performance, future-proof

### 🧠 Memory Configuration

**32GB Minimum Recommended:**
- **FFmpeg Processes:** ~1-2GB per simultaneous stream
- **HLS Segments:** Memory caching for recent segments
- **OS + Services:** ~4-8GB for Ubuntu + monitoring
- **Buffer for Growth:** Room for additional cameras

**64GB for High-End:**
- Larger stream buffers for smoother playback
- More aggressive caching strategies
- Future expansion capability

### 💾 Storage Strategy

**Three-Tier Storage Approach:**

1. **Boot Drive (NVMe SSD):** 
   - OS, applications, logs
   - 500GB minimum, 1TB preferred
   - Samsung 980/980 Pro for reliability

2. **Hot Storage (NVMe or Fast SSD):**
   - Recent segments (last few hours)
   - Live stream caching
   - 1-4TB depending on retention settings

3. **Cold Storage (Surveillance HDD):**
   - Long-term video archive
   - 4-16TB+ capacity
   - WD Purple Pro or Seagate SkyHawk AI

**RAID Considerations:**
- **RAID 1:** Mirror boot drives for reliability
- **RAID 5/6:** For large archive storage (Tier 4)
- **No RAID for budget builds:** Focus on backup strategies

### ⚡ Power Supply Sizing

**Power Consumption Estimates:**
- **CPU:** 65-105W (under full load)
- **Motherboard + RAM:** 50-80W
- **Storage:** 15-25W per drive
- **Network:** 10-20W
- **Efficiency Buffer:** 20% headroom

**Recommended PSU Tiers:**
1. **Budget:** 600W 80+ Bronze (sufficient, basic)
2. **Balanced:** 650W 80+ Gold (efficient, reliable)
3. **High-End:** 750W+ 80+ Platinum (premium, modular)

### 🌐 Network Requirements

**Bandwidth Calculations:**
- **High Quality Streams:** 5-15 Mbps per camera (variable)
- **Low Quality Streams:** ~800 Kbps per camera (encoded)
- **14 Cameras Total:** ~70-210 Mbps + overhead
- **Recommendation:** Gigabit Ethernet minimum

**Network Upgrades:**
- **Dual NICs:** Separate management/storage traffic
- **10GbE:** Future-proofing for high camera counts
- **Managed Switches:** QoS for stream prioritization

---

## 🏗️ System Assembly Tips

### 📦 Pre-Assembly Checklist
1. **BIOS Updates:** Flash latest BIOS for CPU compatibility
2. **Memory Compatibility:** Check motherboard QVL for RAM
3. **Power Connections:** Ensure adequate PCIe/SATA power
4. **Cable Management:** Plan for good airflow

### 🔧 Ubuntu Installation Notes
1. **LTS Version:** Use Ubuntu 22.04 LTS for stability
2. **Minimal Install:** Server edition without desktop environment
3. **Partition Scheme:** 
   - Root: 100GB ext4
   - Swap: 8-16GB (match RAM for hibernation)
   - /var/lib/cctv: Remaining space for video storage
4. **SSH Access:** Enable for remote management

### 📊 Performance Optimization
1. **CPU Governor:** Set to 'performance' for consistent clocks
2. **Memory Settings:** Enable XMP/DOCP in BIOS
3. **Storage:** Use deadline/mq-deadline I/O scheduler for HDDs
4. **Network:** Tune TCP buffers for streaming workloads

---

## 🔍 Monitoring & Maintenance

### 📈 Key Metrics to Monitor
- **CPU Utilization:** Should average 50-70% under full load
- **Memory Usage:** Keep under 80% for buffer space
- **Storage I/O:** Monitor disk queue depth and response times
- **Network Throughput:** Track bandwidth utilization
- **Temperature:** CPU should stay under 75°C, drives under 50°C

### 🛠️ Maintenance Schedule
- **Daily:** Check stream health, storage usage
- **Weekly:** Review logs, clean temporary files
- **Monthly:** Update system packages, check hardware health
- **Quarterly:** Clean dust filters, verify backup integrity

---

## 💡 Optional Upgrades

### 🔌 Hardware Additions
- **UPS (Battery Backup):** APC Smart-UPS 1000-1500VA
- **Dedicated GPU:** For hardware encoding (NVENC/VCE)
- **Network Storage:** NAS for centralized archive storage
- **Redundant NICs:** Bonding for network failover

### 📺 Graphics Acceleration
**NVIDIA GPUs for Hardware Encoding:**
- **GTX 1650 Super:** Budget hardware encoding
- **RTX 3060:** Excellent NVENC quality and multiple streams
- **RTX 4060:** Latest generation, power efficient

**Benefits:**
- Reduces CPU load significantly
- Better quality/bitrate ratios
- More consistent performance

---

## 🎯 Final Recommendations

### 🥇 **Best Overall Value: Tier 2 ($700)**
**Perfect balance of performance, reliability, and cost for most deployments**

### 🏆 **Best for Growth: Tier 3 ($900)**  
**Future-proof performance with room for expansion**

### 💰 **Best Budget Option: Tier 1 ($500)**
**Solid foundation that can be upgraded incrementally**

### 🚀 **Best Performance: Tier 4 ($1000+)**
**Enterprise-grade reliability for mission-critical deployments**

---

## 📞 Support & Warranty

### 🛡️ Component Warranties
- **CPU:** 3 years (AMD)
- **Motherboard:** 3 years
- **RAM:** Lifetime (most brands)
- **Storage:** 3-5 years
- **PSU:** 5-10 years (premium brands)

### 🔧 Recommended Brands
- **AMD CPUs:** Excellent price/performance
- **ASUS/MSI Motherboards:** Good reliability and support
- **Samsung/WD Storage:** Proven reliability for 24/7 operation
- **Seasonic/EVGA PSUs:** Long warranty and stable power

---

**🎬 Ready to build your rock-solid CCTV streaming server!** 