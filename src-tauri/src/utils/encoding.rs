/// 轻量级 XML 构建器，用于拼接 WebDAV 协议所需的 XML 响应体
/// （如 PROPFIND 的 multistatus、LOCK 的 lockdiscovery 等）。
///
/// 相比引入完整的 XML 序列化库，此构建器通过链式调用逐步拼出合法 XML，
/// 并自动对文本内容进行 `xml_escape` 转义，避免手动 format! 拼接的出错风险。
///
/// # 示例
/// ```ignore
/// let mut w = XmlWriter::new();
/// w.declaration()
///  .open_attr("D:multistatus", "xmlns:D=\"DAV:\"")
///  .open("D:response")
///  .tag("D:href", "/some/path")
///  .close("D:response")
///  .close("D:multistatus");
/// let xml_body = w.finish();
/// ```
pub struct XmlWriter(String);

impl XmlWriter {
    pub fn new() -> Self {
        Self(String::with_capacity(512))
    }

    pub fn declaration(&mut self) -> &mut Self {
        self.0
            .push_str("<?xml version=\"1.0\" encoding=\"utf-8\"?>\n");
        self
    }

    pub fn open(&mut self, tag: &str) -> &mut Self {
        self.0.push('<');
        self.0.push_str(tag);
        self.0.push_str(">\n");
        self
    }

    pub fn open_attr(&mut self, tag: &str, attrs: &str) -> &mut Self {
        self.0.push('<');
        self.0.push_str(tag);
        self.0.push(' ');
        self.0.push_str(attrs);
        self.0.push_str(">\n");
        self
    }

    pub fn close(&mut self, tag: &str) -> &mut Self {
        self.0.push_str("</");
        self.0.push_str(tag);
        self.0.push_str(">\n");
        self
    }

    pub fn tag(&mut self, tag: &str, text: &str) -> &mut Self {
        self.0.push('<');
        self.0.push_str(tag);
        self.0.push('>');
        self.0.push_str(&xml_escape(text));
        self.0.push_str("</");
        self.0.push_str(tag);
        self.0.push_str(">\n");
        self
    }

    pub fn tag_if(&mut self, tag: &str, text: &str) -> &mut Self {
        if !text.is_empty() {
            self.tag(tag, text);
        }
        self
    }

    pub fn empty(&mut self, tag: &str) -> &mut Self {
        self.0.push('<');
        self.0.push_str(tag);
        self.0.push_str("/>\n");
        self
    }

    pub fn raw(&mut self, s: &str) -> &mut Self {
        self.0.push_str(s);
        self
    }

    pub fn finish(self) -> String {
        self.0
    }
}

/// Base64 解码（不依赖外部 crate）。
pub fn base64_decode(input: &str) -> Option<String> {
    const TABLE: &[u8; 64] =
        b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut buf: u32 = 0;
    let mut bits: u32 = 0;
    let mut out = Vec::new();

    for &b in input.trim().as_bytes() {
        if b == b'=' {
            break;
        }
        let val = TABLE.iter().position(|&c| c == b)? as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }

    String::from_utf8(out).ok()
}

/// DJB2 哈希算法。
pub fn simple_hash(s: &str) -> u64 {
    let mut hash: u64 = 5381;
    for b in s.bytes() {
        hash = hash.wrapping_mul(33).wrapping_add(b as u64);
    }
    hash
}

/// XML 特殊字符转义。
pub fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
