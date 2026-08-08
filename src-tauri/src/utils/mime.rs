use std::path::Path;

pub fn detect_mime(path: &Path) -> mime::Mime {
    mime_guess::from_path(path)
        .first()
        .unwrap_or(mime::APPLICATION_OCTET_STREAM)
}

pub fn is_video(m: &mime::Mime) -> bool {
    m.type_() == mime::VIDEO
}

pub fn is_audio(m: &mime::Mime) -> bool {
    m.type_() == mime::AUDIO
}

pub fn is_image(m: &mime::Mime) -> bool {
    m.type_() == mime::IMAGE
}

pub fn is_text(m: &mime::Mime) -> bool {
    m.type_() == mime::TEXT
}

pub fn is_media(m: &mime::Mime) -> bool {
    is_video(m) || is_audio(m) || is_image(m)
}
