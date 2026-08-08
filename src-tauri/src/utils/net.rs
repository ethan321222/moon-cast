use std::net::IpAddr;

/// 枚举机器的非回环 IP 地址。
/// 使用 UDP "connect" 探测来发现默认路由的源 IP（不会实际发送流量）。
pub fn local_ips() -> Vec<IpAddr> {
    let mut ips = Vec::new();

    // 探测技巧：连接到公共地址以找到默认路由 IP。
    if let Ok(sock) = std::net::UdpSocket::bind("0.0.0.0:0") {
        let _ = sock.connect("8.8.8.8:80");
        if let Ok(local_addr) = sock.local_addr() {
            let ip = local_addr.ip();
            if !ip.is_loopback() && !ips.contains(&ip) {
                ips.push(ip);
            }
        }
    }

    // 在 Unix 上通过 getifaddrs 枚举所有接口
    #[cfg(unix)]
    {
        use std::ffi::CStr;
        use std::net::{Ipv4Addr, Ipv6Addr};

        unsafe extern "C" {
            fn getifaddrs(ifap: *mut *mut libc::ifaddrs) -> libc::c_int;
            fn freeifaddrs(ifa: *mut libc::ifaddrs);
        }

        unsafe {
            let mut ifap: *mut libc::ifaddrs = std::ptr::null_mut();
            if getifaddrs(&mut ifap) == 0 {
                let mut cursor = ifap;
                while !cursor.is_null() {
                    let ifa = &*cursor;
                    if !ifa.ifa_addr.is_null() {
                        let family = (*ifa.ifa_addr).sa_family as libc::c_int;
                        let name = CStr::from_ptr(ifa.ifa_name).to_string_lossy();
                        if name != "lo" && name != "lo0" {
                            if family == libc::AF_INET {
                                let addr = &*(ifa.ifa_addr as *const libc::sockaddr_in);
                                let ip = Ipv4Addr::from(u32::from_be(addr.sin_addr.s_addr));
                                let ip = IpAddr::V4(ip);
                                if !ip.is_loopback() && !ips.contains(&ip) {
                                    ips.push(ip);
                                }
                            } else if family == libc::AF_INET6 {
                                let addr = &*(ifa.ifa_addr as *const libc::sockaddr_in6);
                                let ip = Ipv6Addr::from(addr.sin6_addr.s6_addr);
                                let ip = IpAddr::V6(ip);
                                if !ip.is_loopback() && !ips.contains(&ip) {
                                    ips.push(ip);
                                }
                            }
                        }
                    }
                    cursor = ifa.ifa_next;
                }
                freeifaddrs(ifap);
            }
        }
    }

    ips
}
