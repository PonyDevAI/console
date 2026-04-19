use crate::models::{AgentSource, AgentSourceType};
use anyhow::Result;
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::time::Instant;
use tokio_tungstenite::{connect_async, tungstenite::Message};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawTestResult {
    pub ok: bool,
    pub version: Option<String>,
    pub default_agent_id: Option<String>,
    pub latency_ms: Option<u128>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawAgentInfo {
    pub id: String,
    pub source_id: String,
    pub name: String,
    pub display_name: String,
    pub status: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawModelInfo {
    pub id: String,
    pub name: String,
    pub provider: Option<String>,
    pub context_window: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawAgentsResponse {
    pub agents: Vec<OpenClawAgentInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OpenClawModelsResponse {
    pub models: Vec<OpenClawModelInfo>,
}

#[derive(Debug, Deserialize)]
struct WsMessage {
    #[serde(rename = "type")]
    msg_type: String,
    event: Option<String>,
    id: Option<String>,
    ok: Option<bool>,
    payload: Option<serde_json::Value>,
    error: Option<serde_json::Value>,
}

#[derive(Debug, Serialize)]
struct WsRequest {
    #[serde(rename = "type")]
    msg_type: String,
    id: String,
    method: Option<String>,
    params: Option<serde_json::Value>,
    min_protocol: Option<u32>,
    max_protocol: Option<u32>,
    #[serde(rename = "client")]
    client_info: Option<serde_json::Value>,
    role: Option<String>,
    scopes: Option<Vec<String>>,
    caps: Option<Vec<String>>,
    auth: Option<serde_json::Value>,
    #[serde(rename = "userAgent")]
    user_agent: Option<String>,
    locale: Option<String>,
}

fn to_ws_url(endpoint: &str) -> Result<String> {
    let trimmed = endpoint.trim_end_matches('/');
    let ws_url = if trimmed.starts_with("http://") {
        trimmed.replacen("http://", "ws://", 1)
    } else if trimmed.starts_with("https://") {
        trimmed.replacen("https://", "wss://", 1)
    } else if trimmed.starts_with("ws://") || trimmed.starts_with("wss://") {
        trimmed.to_string()
    } else {
        format!("ws://{}", trimmed)
    };
    Ok(ws_url)
}

fn generate_websocket_key() -> String {
    use base64::Engine;
    let mut key_bytes = [0u8; 16];
    rand::RngCore::fill_bytes(&mut rand::thread_rng(), &mut key_bytes);
    base64::engine::general_purpose::STANDARD.encode(&key_bytes)
}

fn build_auth(source: &AgentSource) -> Result<(String, String)> {
    let token = source
        .api_key
        .as_ref()
        .ok_or_else(|| anyhow::anyhow!("API key is required for OpenClaw source"))?
        .clone();
    
    let origin = source
        .origin
        .as_ref()
        .or(source.endpoint.as_ref())
        .ok_or_else(|| anyhow::anyhow!("Origin or endpoint is required for OpenClaw source"))?
        .clone();
    
    Ok((token, origin))
}

async fn connect_and_handshake(source: &AgentSource) -> Result<(tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, serde_json::Value)> {
    let ws_url = to_ws_url(
        source
            .endpoint
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("Endpoint is required"))?,
    )?;
    
    let (token, origin) = build_auth(source)?;
    
    let url = url::Url::parse(&ws_url)?;
    let host = url.host_str().unwrap_or("localhost");
    let port = url.port().unwrap_or(80);
    let path = url.path();
    
    let ws_key = generate_websocket_key();
    
    let request = tokio_tungstenite::tungstenite::http::Request::builder()
        .method("GET")
        .uri(format!("{}{}", path, url.query().map(|q| format!("?{}", q)).unwrap_or_default().as_str()))
        .header("Host", format!("{}:{}", host, port))
        .header("Authorization", format!("Bearer {}", token))
        .header("Origin", &origin)
        .header("Sec-WebSocket-Key", &ws_key)
        .header("Sec-WebSocket-Version", "13")
        .body(())?;
    
    let (ws_stream, _) = connect_async(request)
        .await
        .map_err(|e| anyhow::anyhow!("Failed to connect to OpenClaw: {}", e))?;
    
    let mut ws = ws_stream;
    
    let msg = ws.next()
        .await
        .ok_or_else(|| anyhow::anyhow!("No message received"))?
        .map_err(|e| anyhow::anyhow!("Failed to receive message: {}", e))?;
    
    let response: WsMessage = serde_json::from_str(&msg.into_text()?)?;
    
    if response.msg_type != "event" || response.event.as_deref() != Some("connect.challenge") {
        return Err(anyhow::anyhow!("Expected connect.challenge event, got: {:?}", response));
    }
    
    let connect_payload = serde_json::json!({
        "type": "req",
        "id": "1",
        "minProtocol": 3,
        "maxProtocol": 3,
        "client": {
            "id": "console",
            "version": "dev",
            "platform": "console",
            "mode": "webchat",
            "instanceId": "console"
        },
        "role": "operator",
        "scopes": ["operator.admin", "operator.approvals", "operator.pairing"],
        "caps": [],
        "auth": { "token": token },
        "userAgent": "console",
        "locale": "zh-CN"
    });
    
    ws.send(Message::Text(serde_json::to_string(&connect_payload)?))
        .await
        .map_err(|e| anyhow::anyhow!("Failed to send connect: {}", e))?;
    
    let msg = ws.next()
        .await
        .ok_or_else(|| anyhow::anyhow!("No response received"))?
        .map_err(|e| anyhow::anyhow!("Failed to receive response: {}", e))?;
    
    let response: WsMessage = serde_json::from_str(&msg.into_text()?)?;
    
    if response.id.as_deref() != Some("1") {
        return Err(anyhow::anyhow!("Expected response id=1, got: {:?}", response));
    }
    
    if response.ok == Some(false) {
        let error_msg = if let Some(err_obj) = &response.error {
            err_obj.get("message")
                .and_then(|m| m.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| "Unknown error".to_string())
        } else {
            "Unknown error".to_string()
        };
        return Err(anyhow::anyhow!("Connect failed: {}", error_msg));
    }
    
    let hello_payload = response.payload
        .ok_or_else(|| anyhow::anyhow!("No payload in connect response"))?;
    
    Ok((ws, hello_payload))
}

async fn rpc_call(
    ws: &mut tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    method: &str,
    params: serde_json::Value,
) -> Result<serde_json::Value> {
    let id = uuid::Uuid::new_v4().to_string();
    
    let request = WsRequest {
        msg_type: "req".to_string(),
        id: id.clone(),
        method: Some(method.to_string()),
        params: Some(params),
        min_protocol: None,
        max_protocol: None,
        client_info: None,
        role: None,
        scopes: None,
        caps: None,
        auth: None,
        user_agent: None,
        locale: None,
    };
    
    ws.send(Message::Text(serde_json::to_string(&request)?))
        .await
        .map_err(|e| anyhow::anyhow!("Failed to send request: {}", e))?;
    
    while let Some(msg) = ws.next().await {
        let msg = msg.map_err(|e| anyhow::anyhow!("Failed to receive message: {}", e))?;
        let text = msg.into_text()?;
        
        if text.starts_with('{') {
            let response: WsMessage = serde_json::from_str(&text)?;
            
            if response.id.as_deref() == Some(&id) {
                if response.ok == Some(false) {
                    let error_msg = if let Some(err_obj) = &response.error {
                        err_obj.get("message")
                            .and_then(|m| m.as_str())
                            .map(|s| s.to_string())
                            .unwrap_or_else(|| "Unknown error".to_string())
                    } else {
                        "Unknown error".to_string()
                    };
                    return Err(anyhow::anyhow!("RPC error: {}", error_msg));
                }
                
                return response.payload
                    .ok_or_else(|| anyhow::anyhow!("No payload in response"));
            }
        }
    }
    
    Err(anyhow::anyhow!("Connection closed"))
}

pub async fn test_source(source: &AgentSource) -> OpenClawTestResult {
    let start = Instant::now();
    
    if source.source_type != AgentSourceType::RemoteOpenClawWs {
        return OpenClawTestResult {
            ok: false,
            version: None,
            default_agent_id: None,
            latency_ms: None,
            error: Some("Not an OpenClaw source".to_string()),
        };
    }
    
    match &source.endpoint {
        Some(_) => {}
        None => {
            return OpenClawTestResult {
                ok: false,
                version: None,
                default_agent_id: None,
                latency_ms: None,
                error: Some("Endpoint is required".to_string()),
            };
        }
    }
    
    if source.api_key.is_none() {
        return OpenClawTestResult {
            ok: false,
            version: None,
            default_agent_id: None,
            latency_ms: None,
            error: Some("API key (token) is required".to_string()),
        };
    }
    
    let connect_result = connect_and_handshake(source).await;
    
    let latency_ms = start.elapsed().as_millis();
    
    match connect_result {
        Ok((mut ws, hello)) => {
            let version = hello
                .get("server")
                .and_then(|s| s.get("version"))
                .and_then(|v| v.as_str())
                .map(String::from);
            
            let default_agent_id = hello
                .get("snapshot")
                .and_then(|s| s.get("defaultAgentId"))
                .and_then(|d| d.as_str())
                .map(String::from)
                .or_else(|| {
                    hello
                        .get("sessionDefaults")
                        .and_then(|s| s.get("defaultAgentId"))
                        .and_then(|d| d.as_str())
                        .map(String::from)
                });
            
            let health_result = rpc_call(&mut ws, "health", serde_json::json!({})).await;
            
            let _ = ws.close(None).await;
            
            match health_result {
                Ok(_) => OpenClawTestResult {
                    ok: true,
                    version,
                    default_agent_id,
                    latency_ms: Some(latency_ms),
                    error: None,
                },
                Err(e) => OpenClawTestResult {
                    ok: false,
                    version,
                    default_agent_id,
                    latency_ms: Some(latency_ms),
                    error: Some(format!("Health check failed: {}", e)),
                },
            }
        }
        Err(e) => OpenClawTestResult {
            ok: false,
            version: None,
            default_agent_id: None,
            latency_ms: Some(latency_ms),
            error: Some(format!("Connection failed: {}", e)),
        },
    }
}

pub async fn list_agents(source: &AgentSource) -> Result<OpenClawAgentsResponse> {
    if source.source_type != AgentSourceType::RemoteOpenClawWs {
        return Err(anyhow::anyhow!("Not an OpenClaw source"));
    }
    
    let source_id = source.id.clone();
    
    let (mut ws, hello) = connect_and_handshake(source).await?;
    
    let default_agent_id = hello
        .get("sessionDefaults")
        .and_then(|s| s.get("defaultAgentId"))
        .and_then(|d| d.as_str())
        .map(String::from)
        .or_else(|| {
            hello
                .get("snapshot")
                .and_then(|s| s.get("defaultAgentId"))
                .and_then(|d| d.as_str())
                .map(String::from)
        });
    
    let payload = rpc_call(&mut ws, "agents.list", serde_json::json!({})).await?;
    
    let agents_list = payload
        .get("agents")
        .and_then(|a| a.as_array())
        .cloned()
        .unwrap_or_default();
    
    let mut agents = Vec::new();
    
    for agent in agents_list {
        let id = agent.get("id").and_then(|v| v.as_str()).unwrap_or("main");
        let name = id.to_string();
        let display_name = agent.get("name").and_then(|v| v.as_str()).unwrap_or(id);
        
        agents.push(OpenClawAgentInfo {
            id: format!("{}/{}", source_id, id),
            source_id: source_id.clone(),
            name: name.clone(),
            display_name: display_name.to_string(),
            status: "online".to_string(),
        });
    }
    
    if agents.is_empty() {
        if let Some(default_id) = default_agent_id {
            agents.push(OpenClawAgentInfo {
                id: format!("{}/{}", source_id, default_id),
                source_id: source_id.clone(),
                name: default_id.clone(),
                display_name: default_id,
                status: "online".to_string(),
            });
        }
    }
    
    ws.close(None).await.ok();
    
    Ok(OpenClawAgentsResponse { agents })
}

pub async fn list_models(source: &AgentSource) -> Result<OpenClawModelsResponse> {
    if source.source_type != AgentSourceType::RemoteOpenClawWs {
        return Err(anyhow::anyhow!("Not an OpenClaw source"));
    }
    
    let (mut ws, _hello) = connect_and_handshake(source).await?;
    
    let payload = rpc_call(&mut ws, "models.list", serde_json::json!({})).await?;
    
    let models_list = payload
        .get("models")
        .and_then(|m| m.as_array())
        .cloned()
        .unwrap_or_default();
    
    let models: Vec<OpenClawModelInfo> = models_list
        .into_iter()
        .map(|m| {
            OpenClawModelInfo {
                id: m.get("id").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                name: m.get("name").and_then(|v| v.as_str()).unwrap_or("").to_string(),
                provider: m.get("provider").and_then(|v| v.as_str()).map(String::from),
                context_window: m.get("contextWindow").and_then(|v| v.as_u64()),
            }
        })
        .filter(|m| !m.id.is_empty())
        .collect();
    
    ws.close(None).await.ok();
    
    Ok(OpenClawModelsResponse { models })
}
