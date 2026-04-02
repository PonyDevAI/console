use crate::runtime::ThreadEvent;
use axum::body::Bytes;
use axum::http::StatusCode;
use axum::response::Response;
use futures::stream::Stream;
use futures::StreamExt;
use http_body_util::StreamBody;
use hyper::body::Frame;
use std::pin::Pin;
use std::task::{Context, Poll};
use tokio::sync::broadcast;

/// Format a ThreadEvent as SSE data
pub fn format_thread_sse_event(event: &ThreadEvent) -> String {
    let event_type = match event {
        ThreadEvent::MessageCreated { .. } => "message.created",
        ThreadEvent::MessageDelta { .. } => "message.delta",
        ThreadEvent::MessageDone { .. } => "message.done",
        ThreadEvent::MessageError { .. } => "message.error",
        ThreadEvent::RunStarted { .. } => "run.started",
        ThreadEvent::RunCompleted { .. } => "run.completed",
        ThreadEvent::RunFailed { .. } => "run.failed",
        ThreadEvent::RunCancelled { .. } => "run.cancelled",
    };

    let data = serde_json::to_string(event).unwrap_or_default();
    format!("event: {}\ndata: {}\n\n", event_type, data)
}

/// SSE stream for thread events
pub struct ThreadSseStream {
    rx: broadcast::Receiver<ThreadEvent>,
}

impl ThreadSseStream {
    pub fn new(rx: broadcast::Receiver<ThreadEvent>) -> Self {
        Self { rx }
    }
}

impl Stream for ThreadSseStream {
    type Item = Result<Bytes, std::io::Error>;

    fn poll_next(mut self: Pin<&mut Self>, cx: &mut Context<'_>) -> Poll<Option<Self::Item>> {
        loop {
            match self.rx.try_recv() {
                Ok(event) => {
                    let data = format_thread_sse_event(&event);
                    return Poll::Ready(Some(Ok(Bytes::from(data))));
                }
                Err(broadcast::error::TryRecvError::Empty) => {
                    // Register waker and return pending
                    cx.waker().wake_by_ref();
                    return Poll::Pending;
                }
                Err(broadcast::error::TryRecvError::Closed) => {
                    return Poll::Ready(None);
                }
                Err(broadcast::error::TryRecvError::Lagged(_)) => {
                    // Skip lagged messages and try again
                    continue;
                }
            }
        }
    }
}

/// Convert SSE stream into Axum response
pub fn sse_response(
    stream: impl Stream<Item = Result<Bytes, std::io::Error>> + Send + 'static,
) -> Response {
    use axum::body::Body;
    use axum::http::header;

    let body = StreamBody::new(stream.map(|item| match item {
        Ok(bytes) => Ok(Frame::data(bytes)),
        Err(e) => Err(e),
    }));

    Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "text/event-stream")
        .header(header::CACHE_CONTROL, "no-cache")
        .header(header::CONNECTION, "keep-alive")
        .body(Body::new(body))
        .unwrap()
}
