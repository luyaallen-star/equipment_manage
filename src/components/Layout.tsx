import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Users, AlertTriangle, Package, Box } from "lucide-react";

interface LayoutProps {
    children: ReactNode;
}

export default function Layout({ children }: LayoutProps) {
    const location = useLocation();

    const navigation = [
        { name: "대시보드", href: "/", icon: LayoutDashboard },
        { name: "전체 장비 대장", href: "/equipment", icon: Package },
        { name: "창고 보유 장비", href: "/inventory", icon: Box },
        { name: "기수별 인원/장비", href: "/cohorts", icon: Users },
        { name: "손상 장비", href: "/damaged", icon: AlertTriangle },
    ];

    return (
        <div className="flex h-screen bg-gray-50 text-gray-900 w-full">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 shadow-sm flex flex-col">
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <h1 className="text-xl font-bold text-blue-600 tracking-tight">장비 관리 시스템</h1>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2">
                    {navigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                            <Link
                                key={item.name}
                                to={item.href}
                                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors font-medium ${isActive
                                    ? "bg-blue-50 text-blue-700"
                                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                {item.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="p-8 pb-16 h-full w-full">{children}</div>
            </main>
        </div>
    );
}
