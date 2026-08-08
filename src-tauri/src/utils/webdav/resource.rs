use crate::utils::encoding::{XmlWriter, simple_hash};

const SUPPORTED_LOCK_XML: &str = "\
<D:supportedlock>\n\
<D:lockentry>\n\
<D:lockscope><D:exclusive/></D:lockscope>\n\
<D:locktype><D:write/></D:locktype>\n\
</D:lockentry>\n\
</D:supportedlock>\n";

/// 单个 WebDAV 资源的数据载体。
pub(super) struct DavResource {
    pub href: String,
    pub display_name: String,
    pub is_dir: bool,
    pub size: u64,
    pub content_type: String,
    pub creation_date: String,
    pub last_modified: String,
    pub etag: String,
}

impl DavResource {
    pub fn to_xml(&self) -> String {
        let mut w = XmlWriter::new();
        w.open("D:response")
            .tag("D:href", &self.href)
            .open("D:propstat")
            .open("D:prop")
            .tag("D:displayname", &self.display_name);
        if self.is_dir {
            w.raw("<D:resourcetype><D:collection/></D:resourcetype>\n");
        } else {
            w.empty("D:resourcetype")
                .tag("D:getcontentlength", &self.size.to_string());
        }
        w.tag_if("D:getcontenttype", &self.content_type)
            .tag_if("D:creationdate", &self.creation_date)
            .tag_if("D:getlastmodified", &self.last_modified)
            .tag_if("D:getetag", &self.etag)
            .raw(SUPPORTED_LOCK_XML)
            .close("D:prop")
            .tag("D:status", "HTTP/1.1 200 OK")
            .close("D:propstat")
            .close("D:response");
        w.finish()
    }
}

/// 从目录 metadata 构建 DavResource。
pub(super) fn dir_to_resource(
    path: &std::path::Path,
    href: &str,
) -> Result<DavResource, std::io::Error> {
    let meta = std::fs::metadata(path)?;

    let created = meta
        .created()
        .ok()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
        })
        .unwrap_or_default();

    let modified = meta
        .modified()
        .ok()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string()
        })
        .unwrap_or_default();

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "/".to_string());

    let etag = format!("\"dir-{}\"", simple_hash(href));

    Ok(DavResource {
        href: href.to_string(),
        display_name: name,
        is_dir: true,
        size: 0,
        content_type: String::new(),
        creation_date: created,
        last_modified: modified,
        etag,
    })
}

/// 从文件 metadata 构建 DavResource。
pub(super) fn file_to_resource(
    path: &std::path::Path,
    href: &str,
) -> Result<DavResource, std::io::Error> {
    let meta = std::fs::metadata(path)?;

    let created = meta
        .created()
        .ok()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.format("%Y-%m-%dT%H:%M:%SZ").to_string()
        })
        .unwrap_or_default();

    let modified = meta
        .modified()
        .ok()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string()
        })
        .unwrap_or_default();

    let modified_ts = meta
        .modified()
        .ok()
        .map(|t| {
            let dt: chrono::DateTime<chrono::Utc> = t.into();
            dt.timestamp()
        })
        .unwrap_or(0);

    let name = path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();

    let mime = crate::utils::mime::detect_mime(path);
    let etag = format!("\"{:x}-{:x}\"", meta.len(), modified_ts);

    Ok(DavResource {
        href: href.to_string(),
        display_name: name,
        is_dir: false,
        size: meta.len(),
        content_type: mime.to_string(),
        creation_date: created,
        last_modified: modified,
        etag,
    })
}

/// 从 FileEntry 构建 DavResource。
pub(super) fn entry_to_resource(
    entry: &crate::utils::fs::FileEntry,
    href: &str,
) -> DavResource {
    let modified = if entry.modified_ts > 0 {
        chrono::DateTime::from_timestamp(entry.modified_ts, 0)
            .map(|dt| dt.format("%a, %d %b %Y %H:%M:%S GMT").to_string())
            .unwrap_or_default()
    } else {
        String::new()
    };

    let created = if entry.created_ts > 0 {
        chrono::DateTime::from_timestamp(entry.created_ts, 0)
            .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
            .unwrap_or_default()
    } else {
        String::new()
    };

    let content_type = if entry.is_dir {
        String::new()
    } else {
        mime_guess::from_path(&entry.name)
            .first()
            .map(|m| m.to_string())
            .unwrap_or_else(|| "application/octet-stream".to_string())
    };

    let etag = if entry.is_dir {
        format!("\"dir-{}\"", simple_hash(href))
    } else {
        format!("\"{:x}-{:x}\"", entry.size, entry.modified_ts)
    };

    DavResource {
        href: href.to_string(),
        display_name: entry.name.clone(),
        is_dir: entry.is_dir,
        size: entry.size,
        content_type,
        creation_date: created,
        last_modified: modified,
        etag,
    }
}
