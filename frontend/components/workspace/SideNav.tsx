"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, LogOut, Menu, Settings2, X } from "lucide-react";

import { workspaceNavItems } from "@/lib/nav";
import type { CurrentUser } from "@/lib/types";

const PRIMARY_ITEMS = workspaceNavItems.filter((item) => item.id !== "profile");
const SHORT_LABELS: Record<string, string> = {
  today: "今日",
  spaces: "目标",
  chat: "导师",
  plan: "路径",
  resources: "资源",
  knowledge: "知识",
  mistakes: "错题",
  growth: "成长",
};

interface SideNavProps {
  pathname: string;
  user: CurrentUser;
  onLogout: () => void;
}

function isActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ pathname, user, onLogout }: SideNavProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="sticky top-0 z-40 mb-4 pt-4">
      <nav className="flex items-center gap-2" aria-label="工作台导航">
        <Link
          href="/today"
          className="ws-nav-surface inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-medium text-[#303030] transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/40"
        >
          ReflexLearn
        </Link>

        <div className="ws-nav-surface hidden items-center rounded-full p-1 lg:flex">
          {PRIMARY_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                title={item.description}
                className={`rounded-full px-3 py-2 text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35 xl:px-4 ${
                  active
                    ? "bg-[#303030] text-white shadow-sm"
                    : "text-[#747474] hover:bg-white/50 hover:text-[#303030]"
                }`}
              >
                {SHORT_LABELS[item.id] ?? item.label}
              </Link>
            );
          })}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/profile"
            className="ws-nav-surface hidden h-10 items-center gap-2 rounded-full px-4 text-sm text-[#303030] transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35 sm:flex"
          >
            <Settings2 size={15} aria-hidden />
            学习画像
          </Link>
          <Link
            href="/growth"
            aria-label="查看学习动态"
            title="学习动态"
            className="ws-nav-surface relative inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303030] transition-colors hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35"
          >
            <Bell size={16} aria-hidden />
          </Link>
          <Link
            href="/profile"
            aria-label={`打开 ${user.user_id} 的学习画像`}
            title={user.user_id}
            className="ws-nav-surface h-10 w-10 overflow-hidden rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35"
          >
            <img
              src="https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=80"
              alt="学习者头像"
              className="h-full w-full rounded-full object-cover"
            />
          </Link>
          <button
            onClick={onLogout}
            aria-label="退出登录"
            title="退出登录"
            className="ws-nav-surface hidden h-10 w-10 items-center justify-center rounded-full text-[#747474] transition-colors hover:bg-white/80 hover:text-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35 xl:inline-flex"
          >
            <LogOut size={16} aria-hidden />
          </button>
          <button
            onClick={() => setOpen((value) => !value)}
            aria-label={open ? "收起导航" : "展开导航"}
            aria-expanded={open}
            className="ws-nav-surface inline-flex h-10 w-10 items-center justify-center rounded-full text-[#303030] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#303030]/35 lg:hidden"
          >
            {open ? <X size={17} aria-hidden /> : <Menu size={17} aria-hidden />}
          </button>
        </div>
      </nav>

      {open ? (
        <div className="ws-nav-surface mt-2 grid grid-cols-2 gap-1 rounded-3xl p-2 sm:grid-cols-3 lg:hidden">
          {workspaceNavItems.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.id}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-2xl px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-[#303030] text-white"
                    : "text-[#747474] hover:bg-white/60 hover:text-[#303030]"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-2xl px-3 py-2.5 text-left text-sm text-[#747474] transition-colors hover:bg-white/60 hover:text-[#303030]"
          >
            <LogOut size={15} aria-hidden />
            退出登录
          </button>
        </div>
      ) : null}
    </header>
  );
}
