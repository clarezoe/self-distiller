"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { pullDistance, pullReady } from "@/lib/pwa/pull-to-refresh";

type Props = {
  pullLabel: string;
  releaseLabel: string;
  refreshingLabel: string;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return (
    nav.standalone === true ||
    window.matchMedia("(display-mode: standalone)").matches
  );
}

// True if a dialog is open (e.g. the More sheet, whose backdrop sits outside the
// dialog element), or the touch target sits inside a scrollable element that is scrolled down.
function insideScrolledContainer(target: EventTarget | null): boolean {
  if (document.querySelector('[role="dialog"], [aria-modal="true"]')) return true;
  let el = target instanceof Element ? target : null;
  while (el && el !== document.body && el !== document.documentElement) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

export function PullToRefresh({ pullLabel, releaseLabel, refreshingLabel }: Props) {
  const noopSubscribe = () => () => {};
  const enabled = useSyncExternalStore(noopSubscribe, isStandalone, () => false);
  const reducedMotion = useSyncExternalStore(
    noopSubscribe,
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const distRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;
    document.body.style.overscrollBehaviorY = "contain";

    let startX = 0;
    let startY = 0;
    let tracking = false;
    let pulling = false;
    let busy = false;

    const setDist = (d: number) => {
      distRef.current = d;
      setDistance(d);
    };

    const reset = () => {
      tracking = false;
      pulling = false;
      setDragging(false);
      setDist(0);
    };

    const onStart = (e: TouchEvent) => {
      if (busy) return;
      if (e.touches.length !== 1 || window.scrollY > 0) {
        tracking = false;
        return;
      }
      if (insideScrolledContainer(e.target)) {
        tracking = false;
        return;
      }
      tracking = true;
      pulling = false;
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const onMove = (e: TouchEvent) => {
      if (!tracking || busy) return;
      if (e.touches.length !== 1) {
        reset();
        return;
      }
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!pulling) {
        if (dy <= 0 || window.scrollY > 0) {
          if (dy < -4) tracking = false;
          return;
        }
        // Horizontal-dominant gesture: not ours.
        if (Math.abs(dx) > dy) {
          tracking = false;
          return;
        }
        pulling = true;
        setDragging(true);
      }
      if (e.cancelable) e.preventDefault();
      setDist(pullDistance(dy));
    };

    const onEnd = () => {
      if (!tracking) return;
      const ready = pulling && pullReady(distRef.current);
      if (ready) {
        busy = true;
        tracking = false;
        pulling = false;
        setDragging(false);
        setRefreshing(true);
        window.location.reload();
      } else {
        reset();
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", reset, { passive: true });
    return () => {
      document.body.style.overscrollBehaviorY = "";
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", reset);
    };
  }, [enabled]);

  if (!enabled) return null;

  const ready = pullReady(distance);
  const shown = refreshing ? 56 : distance;
  const label = refreshing ? refreshingLabel : ready ? releaseLabel : pullLabel;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-[calc(3rem+env(safe-area-inset-top))] z-20 flex justify-center md:hidden"
      style={{
        transform: `translateY(${shown - 40}px)`,
        opacity: refreshing ? 1 : Math.min(distance / 40, 1),
        transition:
          dragging || reducedMotion ? "none" : "transform 200ms ease, opacity 200ms ease",
      }}
    >
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs text-neutral-700 shadow dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300"
      >
        {refreshing && (
          <span
            aria-hidden="true"
            className={`size-3.5 rounded-full border-2 border-neutral-300 border-t-neutral-700 dark:border-neutral-600 dark:border-t-neutral-200 ${reducedMotion ? "" : "animate-spin"}`}
          />
        )}
        <span>{label}</span>
      </div>
    </div>
  );
}
