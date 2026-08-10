"use client";

import "./workspace.css";

import { usePathname } from "next/navigation";
import { AuthGate } from "../_components/AuthGate";
import { AuthSessionProvider } from "@/lib/authContext";
import { LearningCompanion } from "@/components/companion";
import { RouteProgress, SideNav } from "@/components/workspace";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <AuthGate>
      {(session) => (
        <AuthSessionProvider session={session}>
          <div className="ws-root min-h-screen">
            <RouteProgress />
            <svg
              aria-hidden="true"
              className="ws-background"
              viewBox="0 0 1280 832"
              preserveAspectRatio="xMidYMid slice"
            >
              <defs>
                <filter
                  id="workspace-glow"
                  x="-727"
                  y="-383"
                  width="2603"
                  height="1976.5"
                  filterUnits="userSpaceOnUse"
                >
                  <feFlood floodOpacity="0" result="background" />
                  <feBlend in="SourceGraphic" in2="background" result="shape" />
                  <feGaussianBlur stdDeviation="250" result="blur" />
                </filter>
              </defs>
              <rect width="1280" height="832" fill="#e3e5e6" />
              <path
                d="M904 404C942.8 189.6 1234.83 123.333 1376 117V1093.5H-227V792.5C-161.5 706.167 0.5 556.6 124.5 649C248.5 741.4 473.833 727.5 571 709C665.833 696.667 865.2 618.4 904 404Z"
                fill="#ffd85f"
                filter="url(#workspace-glow)"
              />
            </svg>

            <div className="relative z-10 mx-auto w-full max-w-[1400px] px-4 sm:px-6">
              <SideNav
                pathname={pathname}
                user={session.auth.user}
                onLogout={session.onLogout}
              />
              <main id="workspace-main" className="min-w-0 pb-8">
                {children}
              </main>
            </div>
            <LearningCompanion />
          </div>
        </AuthSessionProvider>
      )}
    </AuthGate>
  );
}
