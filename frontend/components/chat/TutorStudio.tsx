"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Workspace } from "@/app/_components/Workspace";
import { TutorActionBar, type TutorAction } from "@/components/chat/TutorActionBar";
import { TutorEmptyState } from "@/components/chat/TutorEmptyState";
import {
  TutorSearchPanel,
  type TutorSearchState,
} from "@/components/agent-ui/TutorSearchPanel";
import { fallbackToday } from "@/lib/todayFallback";
import { getProfileSummary } from "@/lib/profileApi";
import { discoverResources } from "@/lib/resourceDiscoveryApi";
import { getTodaySummary } from "@/lib/todayApi";
import type { CurrentUser, ProfileSummary, TodaySummaryView } from "@/lib/types";
import { TutorMentorPanel } from "./TutorMentorPanel";
import { EMPTY_TUTOR_RUNTIME, type WorkspaceRuntimeState } from "./tutorRuntime";

export interface InitialTutorRequest {
  message: string;
  displayMessage: string;
}

interface TutorStudioProps {
  token: string;
  user: CurrentUser;
  onLogout: () => void;
  initialRequest: InitialTutorRequest | null;
}

export function TutorStudio({ token, user, onLogout, initialRequest }: TutorStudioProps) {
  const [today, setToday] = useState<TodaySummaryView>(fallbackToday);
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [runtime, setRuntime] = useState<WorkspaceRuntimeState>(EMPTY_TUTOR_RUNTIME);
  const [searchState, setSearchState] = useState<TutorSearchState>({ status: "idle" });
  const searchRequestRef = useRef(0);
  const updateRuntime = useCallback((state: WorkspaceRuntimeState) => setRuntime(state), []);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([getTodaySummary(token), getProfileSummary(token)]).then(
      ([todayResult, profileResult]) => {
        if (cancelled) return;
        if (todayResult.status === "fulfilled") setToday(todayResult.value);
        if (profileResult.status === "fulfilled") setProfile(profileResult.value);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  const weakPoint =
    profile?.weak_points[0] ||
    today.profileSignals.find((signal) => signal.label.includes("薄弱"))?.value ||
    today.mainTask.pathNode;

  const handleTutorAction = useCallback(
    (action: TutorAction) => {
      const requestId = searchRequestRef.current + 1;
      searchRequestRef.current = requestId;
      setSearchState({ status: "idle" });
      if (action.id !== "resources") return;
      const query = `${today.currentGoal} ${weakPoint}`.trim();
      setSearchState({ status: "loading", query });
      void discoverResources(token, {
        goal: today.currentGoal,
        weak_points: weakPoint ? [weakPoint] : [],
        providers: ["bilibili", "official_doc", "oer"],
        limit: 6,
      })
        .then((result) => {
          if (searchRequestRef.current === requestId) {
            setSearchState({ status: "success", query, result });
          }
        })
        .catch((error: unknown) => {
          if (searchRequestRef.current !== requestId) return;
          const message = error instanceof Error ? error.message : "资源检索失败";
          setSearchState({ status: "error", query, message });
        });
    },
    [today.currentGoal, token, weakPoint],
  );

  const resetTutorTools = useCallback(() => {
    searchRequestRef.current += 1;
    setSearchState({ status: "idle" });
  }, []);

  return (
    <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_310px]">
      <Workspace
        embedded
        token={token}
        user={user}
        onLogout={onLogout}
        showTools={false}
        initialMessage={initialRequest?.message}
        initialDisplayMessage={initialRequest?.displayMessage}
        onStateChange={updateRuntime}
        onReset={resetTutorTools}
        conversationAddon={<TutorSearchPanel state={searchState} />}
        className="min-h-[520px] xl:h-[calc(100dvh-176px)] xl:max-h-[680px] xl:min-h-[520px]"
        emptyState={({ disabled, onSelect }) => (
          <TutorEmptyState
            disabled={disabled}
            goal={today.currentGoal}
            weakPoint={weakPoint}
            onSelect={onSelect}
          />
        )}
        actionBar={({ disabled, onSelect }) => (
          <TutorActionBar
            disabled={disabled}
            onSelect={onSelect}
            onAction={handleTutorAction}
          />
        )}
      />
      <TutorMentorPanel today={today} profile={profile} runtime={runtime} />
    </div>
  );
}
