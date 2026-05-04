import React from "react";
import { Outlet } from "react-router-dom";
import HeaderAdmin from "./HeaderAdmin";
import SidebarAdmin from "./SidebarAdmin";

const AdminMasterLayout: React.FC = () => {
  return (
    <div className="min-h-screen flex items-stretch bg-[#020617] text-slate-900 font-sans">
      {/* Sidebar cố định bên trái */}
      <SidebarAdmin />

      {/* Khu vực nội dung chính */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        <HeaderAdmin />

        {/* Nội dung route con — full width; từng page tự giới hạn max-width nếu cần */}
        <main className="relative z-0 flex-1 flex flex-col min-h-0 overflow-y-auto bg-[black]/90">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminMasterLayout;

