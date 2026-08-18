use std::net::{IpAddr, Ipv4Addr};

/// 物理网络接口信息。
#[derive(Debug, Clone)]
pub struct PhysicalInterface {
    /// 接口系统名称（Windows 为 GUID，macOS/Linux 为 en0/eth0 等）
    pub name: String,
    /// 接口索引
    pub index: u32,
    /// 接口类型描述（如 "Ethernet"、"Wireless80211"）
    pub if_type: String,
    /// MAC 地址
    pub mac: String,
    /// 接口上的 IPv4 地址列表
    pub ipv4: Vec<Ipv4Addr>,
    /// 网关地址
    pub gateway: Option<String>,
}

/// 获取本机真实物理网卡信息（Wi-Fi / 以太网）。
///
/// 过滤规则：
/// 1. 必须有网关（说明真正连接到路由器）
/// 2. 接口类型是 Ethernet 或 Wireless80211（排除 VPN 隧道、虚拟网卡）
/// 3. 排除 link-local 地址（169.254.x.x = 未真正获得 DHCP）
///
/// 返回所有符合条件的物理接口，通常只有 1-2 个。
pub fn get_physical_interfaces() -> Vec<PhysicalInterface> {
    use default_net::interface::InterfaceType;

    super::logger_next::log("[net] get_physical_interfaces: scanning all interfaces");
    let interfaces = default_net::get_interfaces();

    let result: Vec<PhysicalInterface> = interfaces
        .iter()
        .filter(|iface| {
            // 必须有网关
            iface.gateway.is_some()
            // 接口类型是物理网卡
            && matches!(
                iface.if_type,
                InterfaceType::Ethernet | InterfaceType::Wireless80211
            )
            // 排除全是 link-local 的接口
            && !iface.ipv4.iter().all(|n| n.addr.octets()[0] == 169)
        })
        .map(|iface| PhysicalInterface {
            name: iface.name.clone(),
            index: iface.index,
            if_type: format!("{:?}", iface.if_type),
            mac: iface.mac_addr.map(|m| m.to_string()).unwrap_or_default(),
            ipv4: iface
                .ipv4
                .iter()
                .map(|n| n.addr)
                .filter(|ip| ip.octets()[0] != 169) // 排除 link-local
                .collect(),
            gateway: iface.gateway.as_ref().map(|g| g.ip_addr.to_string()),
        })
        .filter(|iface| !iface.ipv4.is_empty())
        .collect();

    for iface in &result {
        super::logger_next::log(&format!(
            "[net] physical interface found: name={}, index={}, if_type={}, mac={}, ipv4={:?}, gateway={:?}",
            iface.name, iface.index, iface.if_type, iface.mac, iface.ipv4, iface.gateway,
        ));
    }

    if result.is_empty() {
        super::logger_next::log("[net] no physical interface found");
    }

    result
}

/// 获取默认网卡的局域网 IP 地址列表。
///
/// 优先通过 `get_physical_interfaces()` 获取真实物理网卡的 IP，
/// 即使连了 VPN 或有虚拟网卡也能准确展示局域网内其他设备可访问的地址。
///
/// 如果获取失败，回退到 UDP connect 探测。
pub fn local_ips() -> Vec<IpAddr> {
    let physical = get_physical_interfaces();
    if !physical.is_empty() {
        return physical
            .iter()
            .flat_map(|iface| iface.ipv4.iter().map(|ip| IpAddr::V4(*ip)))
            .collect();
    }

    // 回退：UDP connect 探测
    super::logger_next::log("[net] fallback to UDP probe");
    probe_default_route_ip()
}

/// 通过 UDP connect 探测获取默认路由出口 IP。
///
/// 原理：向公网地址发起 UDP "connect"（不实际发包），
/// 操作系统会根据路由表选择出口接口，返回的本地地址即为默认出口 IP。
/// 注意：VPN 环境下可能返回隧道地址而非物理网卡地址。
fn probe_default_route_ip() -> Vec<IpAddr> {
    let mut ips = Vec::new();
    if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
        let _ = sock.connect("8.8.8.8:80");
        if let Ok(local_addr) = sock.local_addr() {
            let ip = local_addr.ip();
            if !ip.is_loopback() {
                ips.push(ip);
            }
        }
    }
    ips
}
