"use client";

import { useDesignStore } from "@/store/useDesignStore";
import LoginModal from "@/components/LoginModal";
import Sidebar from "@/components/Sidebar";
import DesignCanvas from "@/components/DesignCanvas";
import PropertyPanel from "@/components/PropertyPanel";

export default function Home() {
  const { connection } = useDesignStore();

  if (!connection) {
    return <LoginModal />;
  }

  return (
    <div className="h-screen flex">
      <Sidebar />
      <DesignCanvas />
      <PropertyPanel />
    </div>
  );
}
