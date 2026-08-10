"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface CompanionRoamOptions {
  active: boolean;
  goHome: boolean;
  dragging: boolean;
  petWidth: number;
  petHeight: number;
}

export interface CompanionRoamState {
  x: number;
  y: number;
  facing: 1 | -1;
  walking: boolean;
}

export interface CompanionRoamApi extends CompanionRoamState {
  place: (x: number, y: number) => void;
}

interface Point {
  x: number;
  y: number;
}

const EDGE = 16;
const TOP_EDGE = 96;
const SPEED_PX_S = 76;
const TICK_MS = 32;
const REST_MIN_MS = 1400;
const REST_MAX_MS = 3600;
const ROAM_MIN_VIEWPORT = 768;

function bounds(petWidth: number, petHeight: number): { max: Point; home: Point } {
  if (typeof window === "undefined") {
    return { max: { x: 0, y: 0 }, home: { x: 0, y: 0 } };
  }
  const max = {
    x: Math.max(EDGE, window.innerWidth - petWidth - EDGE),
    y: Math.max(TOP_EDGE, window.innerHeight - petHeight - EDGE),
  };
  return { max, home: { x: max.x, y: max.y } };
}

function clampPoint(point: Point, max: Point): Point {
  return {
    x: Math.min(Math.max(point.x, EDGE), max.x),
    y: Math.min(Math.max(point.y, TOP_EDGE), max.y),
  };
}

export function useCompanionRoam({
  active,
  goHome,
  dragging,
  petWidth,
  petHeight,
}: CompanionRoamOptions): CompanionRoamApi {
  const [state, setState] = useState<CompanionRoamState>(() => {
    const { home } = bounds(petWidth, petHeight);
    return { x: home.x, y: home.y, facing: 1, walking: false };
  });
  const target = useRef<Point>(bounds(petWidth, petHeight).home);
  const nextDecisionAt = useRef(0);
  const reducedMotion = useRef(false);

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const onResize = () => {
      const { max } = bounds(petWidth, petHeight);
      target.current = clampPoint(target.current, max);
      setState((current) => ({ ...current, ...clampPoint(current, max) }));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [petWidth, petHeight]);

  const place = useCallback(
    (x: number, y: number) => {
      const { max } = bounds(petWidth, petHeight);
      const spot = clampPoint({ x, y }, max);
      target.current = spot;
      nextDecisionAt.current = Date.now() + REST_MIN_MS;
      setState((current) => ({ ...current, ...spot, walking: false }));
    },
    [petWidth, petHeight],
  );

  useEffect(() => {
    if (!active || dragging || reducedMotion.current) return;
    const timer = window.setInterval(() => {
      const now = Date.now();
      const { max, home } = bounds(petWidth, petHeight);
      const roamAllowed = window.innerWidth >= ROAM_MIN_VIEWPORT;
      if (goHome) target.current = home;
      setState((current) => {
        const dx = target.current.x - current.x;
        const dy = target.current.y - current.y;
        const distance = Math.hypot(dx, dy);
        if (distance > 4) {
          const step = (SPEED_PX_S * TICK_MS) / 1000;
          const ratio = Math.min(1, step / distance);
          const next = clampPoint(
            { x: current.x + dx * ratio, y: current.y + dy * ratio },
            max,
          );
          return {
            ...next,
            facing: Math.abs(dx) > 1 ? (dx < 0 ? 1 : -1) : current.facing,
            walking: true,
          };
        }
        if (!goHome && roamAllowed && now >= nextDecisionAt.current) {
          nextDecisionAt.current =
            now + REST_MIN_MS + Math.random() * (REST_MAX_MS - REST_MIN_MS);
          target.current = {
            x: EDGE + Math.random() * (max.x - EDGE),
            y: TOP_EDGE + Math.random() * (max.y - TOP_EDGE),
          };
        }
        return current.walking ? { ...current, walking: false } : current;
      });
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [active, dragging, goHome, petHeight, petWidth]);

  return { ...state, place };
}
