import { useEffect, useState, useRef } from "react";
import { getDB } from "../lib/db";
import { Upload, Package, Download, Palette, X } from "lucide-react";
import * as XLSX from "xlsx";
import { downloadExcel } from "../lib/excelUtils";
import { StatusBadge } from "../components/ui/StatusBadge";
import { useDebounce } from "../hooks/useDebounce";

interface EquipmentItem {
    id: number;
    type: string;
    serial_number: string;
    status: string; // IN_STOCK, CHECKED_OUT, DAMAGED
    cohort_name?: string;
    person_name?: string;
    cohort_color?: string;
    remarks?: string;
}

export default function EquipmentPage() {
    const [equipmentList, setEquipmentList] = useState<EquipmentItem[]>([]);
    const [typeColors, setTypeColors] = useState<Record<string, string>>({});
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Get unique equipment types
    const uniqueTypes = Array.from(new Set(equipmentList.map(e => e.type))).sort();

    useEffect(() => {
        loadEquipmentAndColors();
    }, []);

    async function loadEquipmentAndColors() {
        try {
            const db = await getDB();

            // 1. Load Equipment
            const result: EquipmentItem[] = await db.select(`
                SELECT 
                    e.id, 
                    e.type, 
                    e.serial_number, 
                    e.status,
                    IFNULL(MAX(c.name), '') as cohort_name,
                    IFNULL(MAX(p.name), '') as person_name,
                    MAX(c.color) as cohort_color,
                    MAX(last_ck.remarks) as remarks
                FROM equipment e
                LEFT JOIN checkouts ch ON e.id = ch.equipment_id AND ch.return_date IS NULL
                LEFT JOIN personnel p ON ch.personnel_id = p.id
                LEFT JOIN cohorts c ON p.cohort_id = c.id
                LEFT JOIN (
                    SELECT equipment_id, remarks
                    FROM checkouts c1
                    WHERE id = (SELECT MAX(id) FROM checkouts c2 WHERE c2.equipment_id = c1.equipment_id)
                ) last_ck ON e.id = last_ck.equipment_id
                GROUP BY e.id
                ORDER BY CASE e.status
                    WHEN 'IN_STOCK' THEN 1
                    WHEN 'CHECKED_OUT' THEN 2
                    WHEN 'DAMAGED' THEN 3
                    ELSE 4
                END, e.type ASC, e.id DESC
            `);
            setEquipmentList(result);

            // 2. Load Colors
            const colorsResult: any[] = await db.select("SELECT type, color FROM equipment_colors");
            const colorMap: Record<string, string> = {};
            colorsResult.forEach(row => {
                colorMap[row.type] = row.color;
            });
            setTypeColors(colorMap);
        } catch (error) {
            console.error("Failed to load equipment data:", error);
        }
    }

    const handleColorChange = async (type: string, color: string) => {
        // Update local state immediately for snappy UI
        setTypeColors(prev => ({ ...prev, [type]: color }));

        // Save to DB
        try {
            const db = await getDB();
            await db.execute(`
                INSERT INTO equipment_colors (type, color) 
                VALUES ($1, $2)
                ON CONFLICT(type) DO UPDATE SET color = excluded.color
            `, [type, color]);
        } catch (error) {
            console.error("Failed to save color:", error);
        }
    };

    const handleImportExcel = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const worksheet = workbook.Sheets[workbook.SheetNames[0]];

                // Get data as array of arrays
                const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

                if (rawData.length < 2) {
                    alert("가져올 데이터가 없습니다.");
                    return;
                }

                // Detect headers: expect "장비종류" and "시리얼"
                const headers = rawData[0].map(h => String(h).trim().replace(/\s+/g, ''));
                const typeIdx = headers.findIndex(h => h.includes("장비") || h.includes("종류") || h.includes("모델"));
                const serialIdx = headers.findIndex(h => h.includes("시리얼") || h.includes("S/N") || h.includes("serial"));

                if (typeIdx === -1 || serialIdx === -1) {
                    alert("엑셀 데이터에 최소 '장비종류'와 '시리얼' 관련 열(Header)이 필요합니다.");
                    return;
                }

                const db = await getDB();
                let successCount = 0;
                let skipCount = 0;

                // Process rows
                for (let i = 1; i < rawData.length; i++) {
                    const row = rawData[i];
                    if (!row || row.length === 0) continue; // Skip empty rows

                    const equipmentType = row[typeIdx] ? String(row[typeIdx]).trim() : null;
                    const serialNum = row[serialIdx] ? String(row[serialIdx]).trim() : null;

                    if (!equipmentType || !serialNum) continue;

                    let equipRes: any[] = await db.select("SELECT id FROM equipment WHERE serial_number = $1", [serialNum]);

                    if (equipRes.length === 0) {
                        // Insert new equipment as IN_STOCK
                        await db.execute("INSERT INTO equipment (type, serial_number, status) VALUES ($1, $2, 'IN_STOCK')", [equipmentType, serialNum]);
                        successCount++;
                    } else {
                        // Already exists, skip
                        skipCount++;
                    }
                }

                alert(`장비 대장 등록 완료: ${successCount}건 추가, ${skipCount}건 중복 건너뜀.`);
                loadEquipmentAndColors();

            } catch (err) {
                console.error("Equipment Excel import failed:", err);
                alert("엑셀 파싱 중 오류가 발생했습니다. 헤더 형식을 확인해주세요.");
            } finally {
                if (fileInputRef.current) {
                    fileInputRef.current.value = "";
                }
            }
        };

        reader.readAsArrayBuffer(file);
    };

    const handleExportExcel = () => {
        if (equipmentList.length === 0) {
            alert("출력할 데이터가 없습니다.");
            return;
        }

        const exportData = equipmentList.map((item, idx) => ({
            "연번": idx + 1,
            "장비 종류": item.type,
            "시리얼 넘버": item.serial_number,
            "상태": item.status === 'IN_STOCK' ? '창고 보관중' : (item.status === 'CHECKED_OUT' ? `불출됨 ${item.cohort_name && item.person_name ? `(${item.cohort_name} ${item.person_name})` : ''}` : '손상/파손')
        }));

        downloadExcel(exportData, "전체장비대장", "전체_장비_대장");
    };

    const debouncedSearchQuery = useDebounce(searchQuery, 300);

    const filteredList = equipmentList.filter(item => {
        if (!debouncedSearchQuery.trim()) return true;
        const query = debouncedSearchQuery.toLowerCase().trim();
        const searchableText = [
            item.serial_number,
            item.type,
            item.person_name,
            item.cohort_name,
            item.remarks
        ].filter(Boolean).map(s => String(s).toLowerCase()).join(" ");

        return query.split(/\s+/).every(term => searchableText.includes(term));
    });

    return (
        <div className="space-y-6 flex flex-col h-full relative">
            <div className="flex flex-col sm:flex-row justify-between items-start lg:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight flex items-center gap-2 shrink-0">
                    <Package className="w-6 h-6 text-indigo-600" />
                    장비 전체 대장 관리
                </h2>
                <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                    <input
                        type="text"
                        placeholder="종류, 시리얼, 이름 통합 검색..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-full md:w-56 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
                    />
                    <button
                        onClick={() => setIsColorModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Palette className="w-4 h-4" />
                        장비 색상 설정
                    </button>

                    <input
                        type="file"
                        accept=".xlsx, .xls"
                        className="hidden"
                        ref={fileInputRef}
                        onChange={handleImportExcel}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center gap-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Upload className="w-4 h-4" />
                        새 장비 입고 (엑셀)
                    </button>
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Download className="w-4 h-4" />
                        전체 다운로드
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <h3 className="font-semibold text-gray-800">
                        전체 장비 현황 (총 {equipmentList.length}대)
                    </h3>
                </div>

                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse text-sm">
                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200">
                            <tr className="text-gray-500 uppercase tracking-wider">
                                <th className="px-6 py-3 font-medium w-24">NO</th>
                                <th className="px-6 py-3 font-medium w-36">장비 종류</th>
                                <th className="px-6 py-3 font-medium w-48">시리얼 넘버</th>
                                <th className="px-6 py-3 font-medium">현재 상태</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                            {filteredList.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        {searchQuery ? "검색 결과가 없습니다." : "등록된 장비가 없습니다. 우측 상단의 [새 장비 대량 입고] 버튼을 이용하여 장비를 등록해주세요."}
                                    </td>
                                </tr>
                            ) : (
                                filteredList.map((equip) => {
                                    const cardColor = typeColors[equip.type] || '#4b5563'; // default gray-600

                                    const originalIndex = equipmentList.findIndex(e => e.id === equip.id) + 1;

                                    return (
                                        <tr key={equip.id} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="px-6 py-4 text-gray-500 font-mono text-xs">{originalIndex}</td>
                                            <td className="px-6 py-4">
                                                <span
                                                    className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold shadow-sm border"
                                                    style={{
                                                        backgroundColor: `${cardColor}15`,
                                                        color: cardColor,
                                                        borderColor: `${cardColor}30`
                                                    }}
                                                >
                                                    {equip.type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600 font-mono text-xs">{equip.serial_number}</td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-2 items-center">
                                                    {equip.status === 'IN_STOCK' && <StatusBadge status="IN_STOCK" />}
                                                    {equip.status === 'CHECKED_OUT' && (
                                                        <div className="flex items-center gap-2">
                                                            <StatusBadge status="CHECKED_OUT" />
                                                            {equip.cohort_name && equip.person_name && (
                                                                <span
                                                                    className="px-2 py-0.5 border text-gray-600 rounded-md text-[11px] font-bold shrink-0 shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                                                                    style={{
                                                                        backgroundColor: equip.cohort_color ? `${equip.cohort_color}15` : '#f3f4f6',
                                                                        color: equip.cohort_color || '#4b5563',
                                                                        borderColor: equip.cohort_color ? `${equip.cohort_color}30` : '#e5e7eb'
                                                                    }}
                                                                >
                                                                    {equip.cohort_name} {equip.person_name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {equip.status === 'DAMAGED' && <StatusBadge status="DAMAGED" />}
                                                </div>
                                                {equip.remarks && (
                                                    <div className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 p-2 rounded-md break-words max-w-sm">
                                                        <span className="font-semibold mr-1">메모:</span>{equip.remarks}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Color Setting Modal */}
            {isColorModalOpen && (
                <div
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                    onClick={() => setIsColorModalOpen(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[80vh]"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                                <Palette className="w-5 h-5 text-indigo-500" />
                                장비 종류별 색상 지정
                            </h3>
                            <button
                                onClick={() => setIsColorModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {uniqueTypes.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">등록된 장비가 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-500 mb-4">
                                        우측의 컬러 피커를 클릭하여 각 장비의 고유 색상을 지정하세요. 지정된 색상은 대장 및 손상 장비 목록에서 캡슐 형태와 카드 테두리로 표시됩니다.
                                    </p>
                                    {uniqueTypes.map(type => (
                                        <div key={type} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                            <span
                                                className="font-medium px-2 py-1 rounded-md"
                                                style={{
                                                    backgroundColor: `${typeColors[type] || '#4b5563'}15`,
                                                    color: typeColors[type] || '#4b5563'
                                                }}
                                            >
                                                {type}
                                            </span>
                                            <div className="flex items-center gap-3">
                                                <div className="text-xs text-gray-400 font-mono uppercase w-16 text-right">
                                                    {typeColors[type] || '#4B5563'}
                                                </div>
                                                <input
                                                    type="color"
                                                    value={typeColors[type] || '#4b5563'}
                                                    onChange={(e) => handleColorChange(type, e.target.value)}
                                                    className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                            <button
                                onClick={() => setIsColorModalOpen(false)}
                                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors shadow-sm"
                            >
                                완료
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
