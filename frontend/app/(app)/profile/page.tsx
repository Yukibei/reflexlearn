"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MessageSquareText, RotateCcw } from "lucide-react";

import { ProfileEvidence } from "@/components/profile/ProfileEvidence";
import { ProfileOverview } from "@/components/profile/ProfileOverview";
import { PageHeader } from "@/components/workspace";
import { getErrorMessage } from "@/lib/apiClient";
import { useAuthSession } from "@/lib/authContext";
import { getProfileSummary } from "@/lib/profileApi";
import type { ProfileSummary } from "@/lib/types";

export default function ProfilePage() {
  const { auth } = useAuthSession();
  const [profile, setProfile] = useState<ProfileSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    getProfileSummary(auth.access_token)
      .then((data) => {
        if (!cancelled) setProfile(data);
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
  }, [auth.access_token]);

  return (
    <section className="ws-page">
      <PageHeader
        eyebrow="Learner Profile"
        title="学习画像"
        description="系统记住了什么、哪些证据影响推荐、哪里还需要补齐，都应该让学习者看得懂。"
        actions={
          <>
            <Link
              href="/chat"
              className="inline-flex h-10 items-center gap-1.5 rounded-full bg-[#ffd85f] px-4 text-sm font-medium text-[#303030] shadow-[0_2px_12px_rgb(48_48_48/0.1)] transition hover:bg-[#ffe38b]"
            >
              <MessageSquareText size={15} aria-hidden />
              更新画像
            </Link>
            <Link
              href="/today"
              className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#898989]/20 bg-white/65 px-4 text-sm font-medium text-[#303030] transition hover:bg-white"
            >
              <RotateCcw size={15} aria-hidden />
              回到今日学习
            </Link>
          </>
        }
      />

      {error ? (
        <p className="border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          画像暂时无法同步：{error}
        </p>
      ) : null}

      {loading ? <ProfileSkeleton /> : profile ? <ProfileContent profile={profile} /> : null}
    </section>
  );
}

function ProfileContent({ profile }: { profile: ProfileSummary }) {
  return (
    <>
      <ProfileOverview profile={profile} />
      <ProfileEvidence profile={profile} />
    </>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
        <div className="ws-skeleton h-72" />
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="ws-skeleton h-28" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="ws-skeleton h-48" />
        ))}
      </div>
    </div>
  );
}
