use anyhow::{anyhow, Result};

use crate::models::{OsProbeResult, OsProbeSource};

use super::os_mapper::map_probe_output_to_os_type;

/// Detect OS from raw probe output.
///
/// Determines the probe source based on content patterns,
/// then maps the output to an OsType.
pub fn detect_server_os(probe_output: &str) -> Result<OsProbeResult> {
    if probe_output.trim().is_empty() {
        return Err(anyhow!("empty probe output"));
    }

    let source = infer_probe_source(probe_output);
    let os_type = map_probe_output_to_os_type(probe_output);

    if os_type == crate::models::OsType::Unknown {
        return Err(anyhow!("unable to detect operating system"));
    }

    Ok(OsProbeResult {
        os_type,
        raw_output: probe_output.to_string(),
        source,
    })
}

/// Infer which probe source produced the output based on content patterns.
fn infer_probe_source(raw: &str) -> OsProbeSource {
    let lower = raw.to_lowercase();

    // sw_vers output contains ProductName / ProductVersion / ProductUserVersion
    if lower.contains("productname") || lower.contains("productversion") {
        return OsProbeSource::SwVers;
    }

    // /etc/os-release contains KEY=VALUE pairs like NAME=, ID=, PRETTY_NAME=
    if lower.contains("name=") || lower.contains("id=") || lower.contains("pretty_name=") {
        return OsProbeSource::OsRelease;
    }

    // /etc/issue typically contains distribution name + version + \n or \l
    if lower.contains(r"\n") || lower.contains(r"\l") || lower.contains(r"\s") {
        return OsProbeSource::EtcIssue;
    }

    // Default: single word like "Darwin" or "Linux" → uname
    OsProbeSource::Uname
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_detect_darwin_from_uname() {
        let result = detect_server_os("Darwin").unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Apple);
        assert!(matches!(result.source, OsProbeSource::Uname));
    }

    #[test]
    fn test_detect_macos_from_sw_vers() {
        let output = r#"ProductName:		macOS
ProductVersion:		14.0
BuildVersion:		23A344"#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Apple);
        assert!(matches!(result.source, OsProbeSource::SwVers));
    }

    #[test]
    fn test_detect_ubuntu_from_os_release() {
        let output = r#"NAME="Ubuntu"
VERSION="22.04.3 LTS"
ID=ubuntu
ID_LIKE=debian
PRETTY_NAME="Ubuntu 22.04.3 LTS""#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Ubuntu);
        assert!(matches!(result.source, OsProbeSource::OsRelease));
    }

    #[test]
    fn test_detect_debian_from_os_release() {
        let output = r#"PRETTY_NAME="Debian GNU/Linux 12 (bookworm)"
NAME="Debian GNU/Linux"
VERSION="12 (bookworm)"
ID=debian"#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Debian);
        assert!(matches!(result.source, OsProbeSource::OsRelease));
    }

    #[test]
    fn test_detect_centos_from_os_release() {
        let output = r#"NAME="CentOS Linux"
VERSION="8"
ID="centos""#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Centos);
        assert!(matches!(result.source, OsProbeSource::OsRelease));
    }

    #[test]
    fn test_detect_redhat_from_os_release() {
        let output = r#"NAME="Red Hat Enterprise Linux"
VERSION="9.2 (Plow)"
ID="rhel""#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Redhat);
        assert!(matches!(result.source, OsProbeSource::OsRelease));
    }

    #[test]
    fn test_detect_alpine_from_os_release() {
        let output = r#"NAME="Alpine Linux"
ID=alpine
VERSION_ID=3.18.4"#;
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Alpine);
        assert!(matches!(result.source, OsProbeSource::OsRelease));
    }

    #[test]
    fn test_detect_generic_linux_from_uname() {
        let result = detect_server_os("Linux").unwrap();
        assert_eq!(result.os_type, crate::models::OsType::LinuxUnknown);
        assert!(matches!(result.source, OsProbeSource::Uname));
    }

    #[test]
    fn test_detect_windows_from_uname() {
        let result = detect_server_os("Windows_NT").unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Windows);
        assert!(matches!(result.source, OsProbeSource::Uname));
    }

    #[test]
    fn test_detect_etc_issue_fallback() {
        let output = "Ubuntu 22.04.3 LTS \\n \\l";
        let result = detect_server_os(output).unwrap();
        assert_eq!(result.os_type, crate::models::OsType::Ubuntu);
        assert!(matches!(result.source, OsProbeSource::EtcIssue));
    }

    #[test]
    fn test_detect_empty_output() {
        let result = detect_server_os("");
        assert!(result.is_err());
    }

    #[test]
    fn test_probe_result_stores_raw_output() {
        let raw = "Darwin";
        let result = detect_server_os(raw).unwrap();
        assert_eq!(result.raw_output, raw);
    }
}
