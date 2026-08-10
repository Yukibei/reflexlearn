export type TutorRuntimeStatus = "idle" | "thinking" | "running" | "success" | "failed";

export interface WorkspaceRuntimeState {
  status: TutorRuntimeStatus;
  streaming: boolean;
  turnCount: number;
  resourceCount: number;
  pathCount: number;
}

export const EMPTY_TUTOR_RUNTIME: WorkspaceRuntimeState = {
  status: "idle",
  streaming: false,
  turnCount: 0,
  resourceCount: 0,
  pathCount: 0,
};
