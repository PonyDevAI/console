use axum::response::sse::{Event, Sse, KeepAlive};
use std::convert::Infallible;
use std::sync::Arc;
use crate::services::task_queue::TaskQueue;

pub async fn task_stream(
    axum::extract::State(queue): axum::extract::State<Arc<TaskQueue>>,
) -> Sse<impl futures::stream::Stream<Item = Result<Event, Infallible>>> {
    let mut rx = queue.subscribe();
    let stream = async_stream::stream! {
        while let Ok(event) = rx.recv().await {
            let data = serde_json::to_string(&event.task).unwrap_or_default();
            yield Ok(Event::default().data(data));
        }
    };
    Sse::new(stream).keep_alive(KeepAlive::new().interval(std::time::Duration::from_secs(15)))
}
