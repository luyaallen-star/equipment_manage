import { useState } from "react";
import { getDB } from "../lib/db";
import { Settings, AlertTriangle, Trash2 } from "lucide-react";
import Swal from "sweetalert2";

export default function SettingsPage() {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleHardReset = async () => {
        const result1 = await Swal.fire({
            title: "데이터 전체 삭제",
            text: "정말로 모든 데이터를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
            icon: "warning",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "예, 삭제합니다!",
            cancelButtonText: "취소"
        });

        if (!result1.isConfirmed) return;

        const result2 = await Swal.fire({
            title: "최종 확인",
            text: "데이터베이스의 모든 내용이 완전히 삭제됩니다. 계속하시겠습니까?",
            icon: "error",
            showCancelButton: true,
            confirmButtonColor: "#d33",
            cancelButtonColor: "#3085d6",
            confirmButtonText: "영구 삭제",
            cancelButtonText: "취소"
        });

        if (!result2.isConfirmed) return;

        setIsDeleting(true);
        try {
            const db = await getDB();

            // Delete data in order that respects foreign keys (child tables first)
            await db.execute("DELETE FROM damage_reports");
            await db.execute("DELETE FROM checkouts");
            await db.execute("DELETE FROM personnel");
            await db.execute("DELETE FROM equipment");
            await db.execute("DELETE FROM cohorts");
            await db.execute("DELETE FROM equipment_colors");

            // Try resetting SQLite auto-increment sequences so IDs start from 1 again
            try {
                await db.execute("DELETE FROM sqlite_sequence");
            } catch (e) {
                console.log("Could not reset sqlite sequence, which is fine.", e);
            }

            await Swal.fire("초기화 완료", "모든 데이터가 성공적으로 초기화되었습니다.", "success");
            window.location.href = "/"; // Reload the app to clear global state cleanly
        } catch (error) {
            console.error("Factory Reset Failed:", error);
            await Swal.fire("오류 발생", "삭제 처리 중 알 수 없는 오류가 발생했습니다.", "error");
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-full relative">
            <div className="flex flex-col sm:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2 shrink-0">
                    <Settings className="w-6 h-6 text-gray-700" />
                    환경 설정
                </h2>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8 flex flex-col max-w-4xl">
                <h3 className="text-lg font-bold text-gray-800 mb-6 border-b border-gray-100 pb-4">안전 데이터 관리</h3>

                <div className="bg-red-50 border border-red-200 rounded-lg p-6 relative overflow-hidden">
                    <div className="absolute -right-4 -bottom-4 opacity-5 pointer-events-none">
                        <AlertTriangle className="w-48 h-48" />
                    </div>
                    <div className="flex flex-col sm:flex-row gap-5 relative z-10">
                        <div className="bg-white p-3 rounded-full h-fit shadow-[0_2px_8px_rgba(220,38,38,0.15)] border border-red-100 shrink-0">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        <div className="flex-1">
                            <h4 className="text-red-800 font-bold text-xl mb-2">앱 완전 초기화 (Factory Reset)</h4>
                            <p className="text-red-700 text-sm mb-6 leading-relaxed bg-red-100/50 p-3 rounded border border-red-200/50">
                                장비 대장, 기수 관리 정보, 점검 보고서 및 모든 인원의 불출 내역 등 데이터베이스에 등록된 전체 데이터를 영구적으로 삭제합니다.
                                <br /><br />
                                <strong>⚠️ 이 작업은 되돌릴 수 없으며 복구가 불가능합니다.</strong> 삭제 전 대시보드의 '불출현황 내보내기' 등을 통해 엑셀 데이터 백업을 권장드립니다.
                            </p>
                            <button
                                onClick={handleHardReset}
                                disabled={isDeleting}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white px-5 py-2.5 rounded-lg font-bold transition-all shadow-[0_2px_4px_rgba(220,38,38,0.2)] hover:shadow-[0_4px_8px_rgba(220,38,38,0.3)] active:translate-y-[1px]"
                            >
                                <Trash2 className="w-4 h-4" />
                                {isDeleting ? "삭제를 진행하는 중..." : "모든 데이터 영구 삭제"}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
