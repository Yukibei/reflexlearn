"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, FolderOpen } from "lucide-react";

import { SpaceHero } from "@/components/spaces/SpaceHero";
import { SpaceNextAction } from "@/components/spaces/SpaceNextAction";
import { SpacePath } from "@/components/spaces/SpacePath";
import { SpaceResources } from "@/components/spaces/SpaceResources";
import { EmptyState } from "@/components/workspace";
import { getErrorMessage } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import { deleteSpace, getSpaceDetail, updateSpace } from "@/lib/spacesApi";
import type { SpaceDetail } from "@/lib/types";

export default function SpaceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { auth } = useAuthSession();
  const router = useRouter();
  const [detail, setDetail] = useState<SpaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getSpaceDetail(auth.access_token, id)
      .then((data) => {
        if (!cancelled) setDetail(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(getErrorMessage(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, auth.access_token]);

  if (loading) {
    return (
      <section className="ws-page">
        <div className="ws-skeleton h-40" />
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="ws-skeleton h-96" />
          <div className="ws-skeleton h-72" />
        </div>
      </section>
    );
  }

  if (error || !detail) {
    return (
      <section className="ws-page">
        <Link
          href="/today"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-[var(--ws-ink)]"
        >
          <ArrowLeft size={14} aria-hidden /> 返回今日学习
        </Link>
        <EmptyState
          icon={FolderOpen}
          title="无法打开这个学习目标"
          description={error || "这个学习目标暂时不可访问。"}
        />
      </section>
    );
  }

  const renameGoal = async (title: string) => {
    const updated = await updateSpace(auth.access_token, id, { title, course: detail.course });
    setDetail(updated);
  };

  const removeGoal = async () => {
    await deleteSpace(auth.access_token, id);
    router.push("/spaces");
    router.refresh();
  };

  return (
    <section className="ws-page">
      <SpaceHero detail={detail} onRename={renameGoal} onDelete={removeGoal} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <SpacePath steps={detail.steps} />
        <SpaceNextAction detail={detail} />
      </div>

      <SpaceResources resources={detail.resources} />
    </section>
  );
}
