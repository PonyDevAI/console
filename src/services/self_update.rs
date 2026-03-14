use anyhow::Result;
use reqwest::header::USER_AGENT;

const DEFAULT_REPO: &str = "OWNER/console";

#[derive(serde::Deserialize)]
struct GitHubRelease {
    tag_name: String,
}

pub fn current_version() -> &'static str {
    env!("CARGO_PKG_VERSION")
}

pub fn github_repo() -> String {
    std::env::var("CONSOLE_GITHUB_REPO").unwrap_or_else(|_| DEFAULT_REPO.to_string())
}

pub async fn check_latest() -> Result<String> {
    let repo = github_repo();
    let url = format!("https://api.github.com/repos/{repo}/releases/latest");
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;
    let release: GitHubRelease = client
        .get(&url)
        .header(USER_AGENT, "console-self-update")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    Ok(release.tag_name)
}

pub fn update_available(current: &str, latest: &str) -> bool {
    let cur = normalize_version(current);
    let lat = normalize_version(latest);
    if cur == lat {
        return false;
    }
    // Semantic version comparison: returns true only if latest > current
    let cur_parts = parse_semver(&cur);
    let lat_parts = parse_semver(&lat);
    lat_parts > cur_parts
}

pub fn normalize_version(version: &str) -> String {
    version.trim().trim_start_matches('v').to_string()
}

/// Parse "major.minor.patch" into a comparable tuple.
/// Falls back to (0,0,0) for unparseable versions.
fn parse_semver(version: &str) -> (u64, u64, u64) {
    let parts: Vec<&str> = version.split('.').collect();
    let major = parts.first().and_then(|s| s.parse().ok()).unwrap_or(0);
    let minor = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
    let patch = parts.get(2).and_then(|s| {
        // Handle pre-release suffixes like "1-beta" by taking only digits
        let digits: String = s.chars().take_while(|c| c.is_ascii_digit()).collect();
        digits.parse().ok()
    }).unwrap_or(0);
    (major, minor, patch)
}
