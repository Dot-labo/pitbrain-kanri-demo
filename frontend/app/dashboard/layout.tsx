"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clearToken } from "@/lib/auth";
import { auth, type CurrentUser } from "@/lib/api";
import clsx from "clsx";

const NAV_BASE = [
  { href: "/dashboard/licenses", label: "🔑 ライセンス", minLevel: 1, maxLevel: 99 },
  { href: "/dashboard/billing",  label: "💴 請求",       minLevel: 1, maxLevel: 4 },
  { href: "/dashboard/payments", label: "💳 支払",       minLevel: 1, maxLevel: 99 },
  { href: "/dashboard/companies", label: "🏢 企業管理",  minLevel: 1, maxLevel: 99 },
  { href: "/dashboard/workers",  label: "👷 従業員管理", minLevel: 1, maxLevel: 99 },
];

const LEVEL_LABELS: Record<number, string> = {
  1: "オーナー",
  2: "一次代理店",
  3: "二次代理店",
  4: "三次代理店",
  5: "整備会社",
  6: "支店",
};

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<CurrentUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    auth.me().catch(() => router.push("/login")).then((u) => u && setMe(u));
  }, [router]);

  // ページ遷移時にサイドバーを閉じる
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  const navItems = NAV_BASE.filter((item) => !me || (me.level >= item.minLevel && me.level <= item.maxLevel));

  const sidebarContent = (
    <>
      <div className="p-4 border-b flex items-center justify-between">
        <span className="font-bold text-lg text-brand">PITBRAIN</span>
        {/* モバイル：閉じるボタン */}
        <button
          className="md:hidden text-gray-400 hover:text-gray-700 text-xl leading-none"
          onClick={() => setSidebarOpen(false)}
        >
          ×
        </button>
      </div>

      <div className="px-4 py-3 border-b bg-gray-50 min-h-[72px]">
        <p className="text-xs text-gray-500">{me ? (LEVEL_LABELS[me.level] ?? `Level ${me.level}`) : "\u00A0"}</p>
        <p className="text-sm font-semibold text-gray-800 truncate">{me?.company_name ?? "\u00A0"}</p>
        <p className="text-sm text-gray-600 truncate">{me?.name ?? "\u00A0"}</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={clsx(
              "block px-3 py-2 rounded-lg text-sm font-medium transition-colors",
              pathname === item.href
                ? "bg-brand text-white"
                : "text-gray-700 hover:bg-gray-100"
            )}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="p-3 border-t">
        <button
          onClick={handleLogout}
          className="w-full text-left px-3 py-2 text-sm text-gray-500 hover:text-gray-900"
        >
          ログアウト
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen">
      {/* デスクトップ：固定サイドバー */}
      <aside className="hidden md:flex w-56 bg-white border-r flex-col shrink-0">
        {sidebarContent}
      </aside>

      {/* モバイル：オーバーレイサイドバー */}
      {sidebarOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-white border-r flex flex-col shadow-xl">
            {sidebarContent}
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* モバイル：トップバー */}
        <header className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="text-gray-600 hover:text-gray-900 p-1"
            aria-label="メニューを開く"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
              <rect y="3" width="20" height="2" rx="1" />
              <rect y="9" width="20" height="2" rx="1" />
              <rect y="15" width="20" height="2" rx="1" />
            </svg>
          </button>
          <span className="font-bold text-brand">PITBRAIN</span>
        </header>

        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
