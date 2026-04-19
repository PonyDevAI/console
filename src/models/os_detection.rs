use serde::{Deserialize, Serialize};

use super::server::OsType;

/// Source of the OS probe data.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum OsProbeSource {
    /// Detected via `uname -s`
    Uname,
    /// Detected via `sw_vers` (macOS)
    SwVers,
    /// Detected via `/etc/os-release`
    OsRelease,
    /// Detected via `/etc/issue` fallback
    EtcIssue,
}

/// Result of an OS probe operation.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OsProbeResult {
    /// The detected OS type.
    pub os_type: OsType,
    /// Raw output that led to the detection.
    pub raw_output: String,
    /// Which probe source produced this result.
    pub source: OsProbeSource,
}

/// Maps raw probe output to an OsType.
///
/// Detection order:
/// 1. `uname -s`
/// 2. `sw_vers` for Darwin targets
/// 3. `/etc/os-release`
/// 4. `cat /etc/issue` fallback
pub fn map_probe_output_to_os_type(raw: &str) -> OsType {
    let lower = raw.to_lowercase();

    // Check for Darwin / macOS first
    if lower.contains("darwin") || lower.contains("mac os") || lower.contains("macos") {
        return OsType::Apple;
    }

    // Check /etc/os-release style strings
    if lower.contains("ubuntu") {
        return OsType::Ubuntu;
    }
    if lower.contains("debian") {
        return OsType::Debian;
    }
    if lower.contains("alpine") {
        return OsType::Alpine;
    }
    if lower.contains("centos") {
        return OsType::Centos;
    }
    if lower.contains("red hat") || lower.contains("rhel") {
        return OsType::Redhat;
    }

    // Generic Linux indicators
    if lower.contains("linux") {
        return OsType::LinuxUnknown;
    }

    // Windows indicators
    if lower.contains("windows") || lower.contains("microsoft") || lower.contains("nt") {
        return OsType::Windows;
    }

    OsType::Unknown
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_darwin_from_uname() {
        assert_eq!(
            map_probe_output_to_os_type("Darwin"),
            OsType::Apple
        );
    }

    #[test]
    fn test_ubuntu_from_os_release() {
        let output = r#"NAME="Ubuntu"
VERSION="22.04.3 LTS (Jammy Jellyfish)"
ID=ubuntu
ID_LIKE=debian"#;
        assert_eq!(map_probe_output_to_os_type(output), OsType::Ubuntu);
    }

    #[test]
    fn test_debian_from_os_release() {
        assert_eq!(
            map_probe_output_to_os_type("PRETTY_NAME=\"Debian GNU/Linux 12\""),
            OsType::Debian
        );
    }

    #[test]
    fn test_centos_from_os_release() {
        assert_eq!(
            map_probe_output_to_os_type("CentOS Linux 8"),
            OsType::Centos
        );
    }

    #[test]
    fn test_redhat_from_os_release() {
        assert_eq!(
            map_probe_output_to_os_type("Red Hat Enterprise Linux 9"),
            OsType::Redhat
        );
    }

    #[test]
    fn test_alpine_from_os_release() {
        assert_eq!(
            map_probe_output_to_os_type("Alpine Linux v3.18"),
            OsType::Alpine
        );
    }

    #[test]
    fn test_generic_linux() {
        assert_eq!(
            map_probe_output_to_os_type("Linux"),
            OsType::LinuxUnknown
        );
    }

    #[test]
    fn test_windows() {
        assert_eq!(
            map_probe_output_to_os_type("Windows_NT"),
            OsType::Windows
        );
    }

    #[test]
    fn test_unknown_fallback() {
        assert_eq!(
            map_probe_output_to_os_type(""),
            OsType::Unknown
        );
        assert_eq!(
            map_probe_output_to_os_type("FreeBSD"),
            OsType::Unknown
        );
    }

    #[test]
    fn test_os_probe_result_serialization() {
        let result = OsProbeResult {
            os_type: OsType::Ubuntu,
            raw_output: "Ubuntu 22.04".to_string(),
            source: OsProbeSource::OsRelease,
        };
        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("ubuntu"));
        assert!(json.contains("os_release"));
    }
}
