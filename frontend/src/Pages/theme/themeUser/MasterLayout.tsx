import { Outlet } from "react-router-dom";
import Header from "./Header";
import Footer from "./Footer";
import DirectorWorkspaceReturnBar from "./DirectorWorkspaceReturnBar";

const MasterLayout = () => {
    return (
        <div className="min-h-screen flex flex-col bg-white font-sans">
            {/* Header fixed: z-50 đảm bảo nằm trên cùng */}
            <header className="flex-shrink-0 z-50">
                <Header />
            </header>

            {/* TINH CHỈNH KHOẢNG CÁCH:
                - pt-[72px]: Cho mobile (Header py-4)
                - lg:pt-[88px]: Cho desktop (Header py-6 ban đầu)
                Khoảng cách này giúp khối đen Hero nằm gần Header hơn, tạo sự liên kết.
            */}
            <main className="flex-grow pt-[72px] lg:pt-[70px] transition-all duration-300">
                <DirectorWorkspaceReturnBar />
                <Outlet />
            </main>

           
            <footer className="flex-shrink-0"> {/* Xóa border cũ */}
                <Footer />
            </footer>
        </div>
    );
}

export default MasterLayout;