"use client";

import { useState } from "react";
import { useDesignStore } from "@/store/useDesignStore";
import { Server, Eye, EyeOff, Loader2 } from "lucide-react";

const NAS_URL = "https://bom-nal.synology.me";
const DEFAULT_ACCOUNT = "구태식";
const DEFAULT_PASSWORD = "Bomnal2040";
const ADMIN_ACCOUNTS = ["구태식"];
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export default function LoginModal() {
  const { setConnection } = useDesignStore();
  const [account, setAccount] = useState(DEFAULT_ACCOUNT);
  const [password, setPassword] = useState(DEFAULT_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${BASE}/api/synology/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: NAS_URL, account, password }),
      });

      const data = await res.json();

      if (data.success) {
        setConnection({ url: data.url, sid: data.sid, currentPath: "/", account });
        useDesignStore.setState({ isAdmin: ADMIN_ACCOUNTS.includes(account) });

        fetch(`${BASE}/api/ocr/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nasUrl: data.url, sid: data.sid, action: "download" }),
        }).catch(() => {});
      } else {
        setError(data.error || "로그인에 실패했습니다.");
      }
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-purple-600 mb-4">
            <Server className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Synol Design</h1>
          <p className="text-purple-200 mt-2">시놀로지 드라이브 기반 디자인 시스템</p>
        </div>

        <form onSubmit={handleLogin} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 space-y-4">
          <div className="bg-white/5 rounded-lg px-4 py-3 text-sm text-purple-200">
            <span className="text-purple-400 text-xs">NAS 서버</span>
            <p className="font-mono mt-0.5">{NAS_URL}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">계정</label>
            <input
              type="text"
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              placeholder="사용자 이름"
              className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-purple-200 mb-1">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="비밀번호"
                className="w-full px-4 py-3 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-500 pr-12"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="bg-red-500/20 text-red-200 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg bg-purple-600 hover:bg-purple-700 text-white font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                연결 중...
              </>
            ) : (
              "연결하기"
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
