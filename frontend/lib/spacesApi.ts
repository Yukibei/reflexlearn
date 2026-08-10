import { apiJson } from "@/lib/apiClient";
import type { SpaceDetail } from "@/lib/types";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "/api";

export function getSpaceDetail(token: string, spaceId: string): Promise<SpaceDetail> {
  return apiJson<SpaceDetail>(`${API_BASE}/spaces/${spaceId}/detail`, token);
}

export function updateSpace(
  token: string,
  spaceId: string,
  input: { title: string; course?: string },
): Promise<SpaceDetail> {
  return apiJson<SpaceDetail>(`${API_BASE}/spaces/${spaceId}`, token, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteSpace(token: string, spaceId: string): Promise<void> {
  return apiJson(`${API_BASE}/spaces/${spaceId}`, token, { method: "DELETE" }).then(
    () => undefined,
  );
}
