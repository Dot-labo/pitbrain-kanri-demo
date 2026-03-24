"use client";

import { useEffect, useState } from "react";
import { workers as workersApi, licenses as licensesApi } from "@/lib/api";
import type { LicenseRequest, License } from "@/types";
import Link from "next/link";

export default function DashboardPage() {
  const [pending, setPending] = useState<LicenseRequest[]>([]);
  const [licenseList, setLicenseList] = useState<License[]>([]);

  useEffect(() => {
    workersApi.pendingRequests().then(setPending).catch(() => {});
    licensesApi.list().then(setLicenseList).catch(() => {});
  }, []);

  const activeCount = licenseList.filter((l) => l.status === "in_use").length;
  const unassignedCount = licenseList.filter((l) => l.status === "unassigned").length;
  const cancelScheduledCount = licenseList.filter(
    (l) => l.status === "cancellation_scheduled"
  ).length;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      {/* サマリーカード */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <SummaryCard label="利用中ライセンス" value={activeCount} color="text-green-600" />
        <SummaryCard label="未割当ライセンス" value={unassignedCount} color="text-gray-500" />
        <SummaryCard label="解約予定" value={cancelScheduledCount} color="text-orange-500" />
        <SummaryCard label="承認待ち申請" value={pending.length} color="text-yellow-600" />
      </div>

      {/* 承認待ち */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">承認待ち申請</h2>
          {pending.length > 0 && (
            <Link href="/dashboard/workers" className="text-xs text-brand hover:underline">
              作業員管理へ →
            </Link>
          )}
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-gray-500">承認待ちの申請はありません</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">氏名</th>
                <th className="pb-2">申請日時</th>
                <th className="pb-2">ステータス</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {pending.map((r) => (
                <tr key={r.id}>
                  <td className="py-2">{r.worker_name}</td>
                  <td className="py-2">{new Date(r.requested_at).toLocaleString("ja-JP")}</td>
                  <td className="py-2">
                    <span className="bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded text-xs">
                      承認待ち
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 未割当ライセンス */}
      {unassignedCount > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">未割当ライセンス</h2>
            <Link href="/dashboard/licenses" className="text-xs text-brand hover:underline">
              ライセンス管理へ →
            </Link>
          </div>
          <p className="text-sm text-gray-500">
            {unassignedCount} 件のライセンスが作業員に割り当てられていません。
          </p>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
