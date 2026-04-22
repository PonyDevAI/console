use crate::models::{map_probe_output_to_os_type as model_map, OsType};

/// Maps raw probe output to an OsType.
///
/// Delegates to the model-level mapper and adds service-layer
/// handling for edge cases (empty input, whitespace-only).
pub fn map_probe_output_to_os_type(raw: &str) -> OsType {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return OsType::Unknown;
    }
    model_map(trimmed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_empty_string_returns_unknown() {
        assert_eq!(map_probe_output_to_os_type(""), OsType::Unknown);
        assert_eq!(map_probe_output_to_os_type("   "), OsType::Unknown);
        assert_eq!(map_probe_output_to_os_type("\n\t"), OsType::Unknown);
    }

    #[test]
    fn test_darwin_maps_to_apple() {
        assert_eq!(map_probe_output_to_os_type("Darwin"), OsType::Apple);
    }

    #[test]
    fn test_ubuntu_maps_correctly() {
        let output = r#"NAME="Ubuntu"
ID=ubuntu"#;
        assert_eq!(map_probe_output_to_os_type(output), OsType::Ubuntu);
    }

    #[test]
    fn test_debian_maps_correctly() {
        assert_eq!(
            map_probe_output_to_os_type("Debian GNU/Linux 12"),
            OsType::Debian
        );
    }

    #[test]
    fn test_centos_maps_correctly() {
        assert_eq!(
            map_probe_output_to_os_type("CentOS Linux 8"),
            OsType::Centos
        );
    }

    #[test]
    fn test_redhat_maps_correctly() {
        assert_eq!(
            map_probe_output_to_os_type("Red Hat Enterprise Linux 9"),
            OsType::Redhat
        );
    }

    #[test]
    fn test_alpine_maps_correctly() {
        assert_eq!(
            map_probe_output_to_os_type("Alpine Linux v3.18"),
            OsType::Alpine
        );
    }

    #[test]
    fn test_generic_linux() {
        assert_eq!(map_probe_output_to_os_type("Linux"), OsType::LinuxUnknown);
    }

    #[test]
    fn test_windows() {
        assert_eq!(map_probe_output_to_os_type("Windows_NT"), OsType::Windows);
    }

    #[test]
    fn test_unknown_fallback() {
        assert_eq!(map_probe_output_to_os_type("FreeBSD"), OsType::Unknown);
    }

    #[test]
    fn test_whitespace_stripped_before_mapping() {
        assert_eq!(map_probe_output_to_os_type("  Darwin  "), OsType::Apple);
    }
}
