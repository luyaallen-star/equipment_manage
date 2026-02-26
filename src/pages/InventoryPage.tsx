import { useEffect, useState } from "react";
import { getDB } from "../lib/db";
import { Download, CheckCircle, Package, XCircle } from "lucide-react";
import { saveExcelWithDialog } from "../lib/excelUtils";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useDebounce } from "../hooks/useDebounce";
import { DamageModal } from "../components/modals/DamageModal";

interface InventoryItem {
    id: number;
    type: string;
    serial_number: string;
    status: string;
    remarks?: string;
}

export default function InventoryPage() {
    const [inventoryList, setInventoryList] = useState<InventoryItem[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
    const [damageReason, setDamageReason] = useState("");
    const [damageTarget, setDamageTarget] = useState<{ personnel_id: number; equipment_id: number; equipment_type: string; serial_number: string } | null>(null);

    useEffect(() => {
        loadInventory();
    }, []);

    async function loadInventory() {
        try {
            const db = await getDB();
            const result: InventoryItem[] = await db.select(`
                SELECT 
                    e.id, 
                    e.type, 
                    e.serial_number, 
                    e.status,
                    last_ck.remarks
                FROM equipment e
                LEFT JOIN (
                    SELECT equipment_id, remarks
                    FROM checkouts c1
                    WHERE id = (SELECT MAX(id) FROM checkouts c2 WHERE c2.equipment_id = c1.equipment_id)
                ) last_ck ON e.id = last_ck.equipment_id
                WHERE e.status IN ('IN_STOCK', 'NEEDS_INSPECTION')
                ORDER BY e.status DESC, e.type ASC, e.id DESC
            `);
            setInventoryList(result);
        } catch (error) {
            console.error("Failed to load inventory:", error);
        }
    }

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const handleExportExcel = async () => {
        if (inventoryList.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        const exportData = inventoryList.map((item, idx) => ({
            "연번": idx + 1,
            "장비 종류": item.type,
            "시리얼 넘버": item.serial_number,
            "상태": item.status === 'IN_STOCK' ? "점검 완료(불출 가능)" : "점검 미완료(대기)"
        }));

        await saveExcelWithDialog(exportData, "창고 재고", "창고_재고_현황");
    };

    const filteredList = inventoryList.filter(item => {
        if (!debouncedSearchQuery.trim()) return true;
        const query = debouncedSearchQuery.toLowerCase().trim();
        const searchableText = [
            item.serial_number,
            item.type,
            item.remarks
        ].filter(Boolean).map(s => String(s).toLowerCase()).join(" ");

        return query.split(/\s+/).every(term => searchableText.includes(term));
    });

    // Compute sums by equipment type only for IN_STOCK
    const typeCounts = inventoryList.reduce((acc, item) => {
        if (item.status === 'IN_STOCK') {
            acc[item.type] = (acc[item.type] || 0) + 1;
        }
        return acc;
    }, {} as Record<string, number>);

    const handleMarkInspected = async (id: number) => {
        try {
            const db = await getDB();
            await db.execute("UPDATE equipment SET status = 'IN_STOCK' WHERE id = $1", [id]);
            loadInventory();
        } catch (error) {
            console.error(error);
            alert("상태 변경에 실패했습니다.");
        }
    };

    const handleDamageSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!damageTarget || !damageReason.trim()) return;
        try {
            const db = await getDB();

            // 1. Add damage report
            await db.execute(
                "INSERT INTO damage_reports (equipment_id, report_date, description) VALUES ($1, $2, $3)",
                [damageTarget.equipment_id, new Date().toISOString(), damageReason.trim()]
            );

            // 2. Change status to DAMAGED
            await db.execute("UPDATE equipment SET status = 'DAMAGED' WHERE id = $1", [damageTarget.equipment_id]);

            loadInventory();
            setIsDamageModalOpen(false);
            setDamageTarget(null);
            setDamageReason("");
        } catch (e) {
            console.error(e);
            alert("손상 보고 중 오류가 발생했습니다.");
        }
    };

    return (
        <div className="space-y-6 flex flex-col h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2">
                    <CheckCircle className="w-6 h-6 text-emerald-600" />
                    창고 보유 장비 관리
                </h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="종류, 시리얼, 메모 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                    />
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm whitespace-nowrap"
                    >
                        <Download className="w-4 h-4" />
                        재고 리스트 내보내기
                    </button>
                </div>
            </div>

            {/* Inventory Type Summary Stats */}
            {inventoryList.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2 mb-3">
                        <Package className="w-4 h-4 text-gray-500" />
                        불출 가능 장비 현황
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {Object.entries(typeCounts).sort(([a], [b]) => a.localeCompare(b)).map(([type, count]) => (
                            <div key={type} className="flex items-center bg-gray-50 border border-gray-200 rounded-lg overflow-hidden shrink-0">
                                <div className="px-3 py-1.5 bg-gray-100 text-gray-700 text-sm font-medium border-r border-gray-200">
                                    {type}
                                </div>
                                <div className="px-3 py-1.5 text-emerald-700 font-bold text-sm bg-emerald-50/50">
                                    {count}대
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-emerald-100 flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-emerald-50 bg-emerald-50/30 flex justify-between items-center">
                    <h3 className="font-semibold text-emerald-900">
                        창고 장비 목록 (총 {filteredList.length}대 검색됨)
                    </h3>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200">
                            <tr className="text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 font-medium w-24">NO</th>
                                <th className="px-6 py-3 font-medium w-36">장비 종류</th>
                                <th className="px-6 py-3 font-medium w-auto whitespace-nowrap border-r border-gray-100">시리얼 넘버</th>
                                <th className="px-6 py-3 font-medium w-40 border-r border-gray-100 text-center">현재 상태</th>
                                <th className="px-6 py-3 font-medium border-r border-gray-100 min-w-[200px]">메모</th>
                                <th className="px-6 py-3 font-medium w-40 text-center">작업</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery ? "검색 결과가 없습니다." : "창고에 남아있는 장비가 없습니다."}
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((equip) => {
                                    // Use absolute index from the main list so Sequence NO doesn't reset
                                    const filterIndex = inventoryList.findIndex(e => e.id === equip.id) + 1;

                                    return (
                                        <tr key={equip.id} className="hover:bg-emerald-50/30 transition-colors">
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">{filterIndex}</td>
                                            <td className="px-6 py-4 font-medium text-gray-900">{equip.type}</td>
                                            <td className="px-6 py-4 text-gray-600 font-mono text-xs border-r border-gray-100">{equip.serial_number}</td>
                                            <td className="px-6 py-4 border-r border-gray-100 text-center">
                                                {equip.status === 'NEEDS_INSPECTION' ? (
                                                    <StatusBadge status="NEEDS_INSPECTION" label="점검 대기" />
                                                ) : (
                                                    <StatusBadge status="IN_STOCK" label="점검 완료" />
                                                )}
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 text-xs border-r border-gray-100 break-all">
                                                {equip.remarks || <span className="text-gray-300">-</span>}
                                            </td>
                                            <td className="px-6 py-4 text-center align-top">
                                                <div className="flex justify-center gap-1.5 flex-wrap">
                                                    {equip.status === 'NEEDS_INSPECTION' && (
                                                        <button
                                                            onClick={() => handleMarkInspected(equip.id)}
                                                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-medium text-xs rounded border border-indigo-200 transition-colors whitespace-nowrap"
                                                        >
                                                            점검 완료
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => {
                                                            setDamageTarget({ personnel_id: 0, equipment_id: equip.id, equipment_type: equip.type, serial_number: equip.serial_number });
                                                            setIsDamageModalOpen(true);
                                                        }}
                                                        className="px-2 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 flex items-center gap-1 font-medium title='장비 손상 보고'"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5" /> 손상
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Damage Modal */}
            <DamageModal
                isOpen={isDamageModalOpen}
                onClose={() => setIsDamageModalOpen(false)}
                onSubmit={handleDamageSubmit}
                damageTarget={damageTarget}
                damageReason={damageReason}
                setDamageReason={setDamageReason}
            />
        </div>
    );
}
