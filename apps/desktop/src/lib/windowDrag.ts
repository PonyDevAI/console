import type { MouseEvent as ReactMouseEvent } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

function isInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest(
      'button, a, input, textarea, select, option, summary, [role="button"], [data-no-drag="true"]'
    )
  );
}

export async function startWindowDrag(event: ReactMouseEvent<HTMLElement>) {
  if (event.button !== 0 || isInteractiveTarget(event.target)) {
    return;
  }

  try {
    await getCurrentWindow().startDragging();
  } catch (error) {
    console.error("CloudCode window dragging failed", error);
  }
}
