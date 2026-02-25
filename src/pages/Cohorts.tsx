import { useEffect, useState } from "react";
import { getDB } from "../lib/db";
import { Plus, Download, XCircle, FileText, CheckCircle2, Palette, X, EyeOff, Eye, RotateCcw, RefreshCw } from "lucide-react";
import * as XLSX from "xlsx";

interface Cohort {
    id: number;
    name: string;
    color: string | null;
    sort_order: number;
    is_hidden: number;
    total_personnel: number;
    checked_out_count: number;
}

interface PersonnelWithCheckout {
    checkout_id: number | null;
    personnel_id: number;
    personnel_name: string;
    duplicate_tag: string | null;
    equipment_id: number | null;
    equipment_type: string | null;
    serial_number: string | null;
    checkout_date: string | null;
    return_date: string | null;
    status: string | null; // IN_STOCK, CHECKED_OUT, DAMAGED
    remarks: string | null;
    previous_serial: string | null;
}

export default function CohortsPage() {
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
    const [personnel, setPersonnel] = useState<PersonnelWithCheckout[]>([]);
    const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
    const [newCohortName, setNewCohortName] = useState("");
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [showHiddenCohorts, setShowHiddenCohorts] = useState(false);

    const [newPersonName, setNewPersonName] = useState("");
    const [newPersonTag, setNewPersonTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    useEffect(() => {
        loadCohorts();
    }, []);

    useEffect(() => {
        if (selectedCohortId) {
            loadPersonnel(selectedCohortId);
        } else {
            setPersonnel([]);
        }
    }, [selectedCohortId]);

    async function loadCohorts() {
        try {
            const db = await getDB();
            const result: any[] = await db.select(`
                SELECT 
                    c.id, c.name, c.color, c.sort_order, IFNULL(c.is_hidden, 0) as is_hidden,
                    (SELECT COUNT(*) FROM personnel p WHERE p.cohort_id = c.id) as total_personnel,
                    (SELECT COUNT(*) FROM checkouts ck JOIN personnel p ON ck.personnel_id = p.id WHERE p.cohort_id = c.id AND ck.return_date IS NULL) as checked_out_count
                FROM cohorts c
                ORDER BY c.sort_order ASC, c.id ASC
            `);
            setCohorts(result as Cohort[]);
            if (result.length > 0 && !selectedCohortId) {
                setSelectedCohortId(result[0].id);
            }

            const types: any[] = await db.select("SELECT DISTINCT type FROM equipment WHERE type IS NOT NULL AND type != ''");
            setEquipmentTypes(types.map(t => t.type));
        } catch (error) {
            console.error(error);
        }
    }

    async function loadPersonnel(cohortId: number) {
        try {
            const db = await getDB();
            const result: PersonnelWithCheckout[] = await db.select(`
        SELECT 
          p.id as personnel_id, 
          p.name as personnel_name, 
          p.duplicate_tag,
          ck.id as checkout_id,
          ck.checkout_date,
          ck.return_date,
          ck.remarks,
          ck.previous_serial,
          e.id as equipment_id,
          e.type as equipment_type,
          e.serial_number,
          e.status
        FROM personnel p
        LEFT JOIN (
            SELECT ck_inner.*
            FROM checkouts ck_inner
            INNER JOIN (
                SELECT personnel_id, MAX(id) as max_id
                FROM checkouts
                GROUP BY personnel_id
            ) grouped_ck ON ck_inner.id = grouped_ck.max_id
        ) ck ON p.id = ck.personnel_id
        LEFT JOIN equipment e ON ck.equipment_id = e.id
        WHERE p.cohort_id = $1
        ORDER BY p.name ASC, ck.checkout_date DESC
      `, [cohortId]);

            setPersonnel(result);
        } catch (error) {
            console.error(error);
        }
    }

    const handleAddCohort = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCohortName.trim()) return;
        try {
            const db = await getDB();
            // Get max sort_order
            const maxRes: any[] = await db.select("SELECT IFNULL(MAX(sort_order), 0) as max_sort FROM cohorts");
            const nextSort = (maxRes[0]?.max_sort || 0) + 1;

            await db.execute("INSERT INTO cohorts (name, sort_order) VALUES ($1, $2)", [newCohortName.trim(), nextSort]);
            setNewCohortName("");
            loadCohorts();
        } catch (error) {
            console.error(error);
            alert("기수 추가에 실패했습니다.");
        }
    };

    // --- Cohort Visibility Handlers ---
    const handleToggleCohortVisibility = async (e: React.MouseEvent, cohortId: number, currentHidden: number) => {
        e.stopPropagation();
        try {
            const db = await getDB();
            const newHidden = currentHidden === 1 ? 0 : 1;
            await db.execute("UPDATE cohorts SET is_hidden = $1 WHERE id = $2", [newHidden, cohortId]);
            // refresh
            loadCohorts();
            if (currentHidden === 0 && selectedCohortId === cohortId) {
                setSelectedCohortId(null);
            }
        } catch (error) {
            console.error(error);
            alert("기수 상태 변경에 실패했습니다.");
        }
    };

    const handleColorChange = async (cohortId: number, color: string) => {
        setCohorts(prev => prev.map(c => c.id === cohortId ? { ...c, color } : c));
        try {
            const db = await getDB();
            await db.execute("UPDATE cohorts SET color = $1 WHERE id = $2", [color, cohortId]);
        } catch (error) {
            console.error("Failed to save color", error);
        }
    };

    const handleAddPersonnel = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPersonName.trim() || !selectedCohortId) return;

        try {
            const db = await getDB();

            if (!showTagInput) {
                const duplicates: any[] = await db.select(
                    "SELECT id FROM personnel WHERE cohort_id = $1 AND name = $2",
                    [selectedCohortId, newPersonName.trim()]
                );

                if (duplicates.length > 0) {
                    setShowTagInput(true);
                    return;
                }
            }

            const tagToInsert = showTagInput && newPersonTag.trim() !== "" ? newPersonTag.trim() : null;

            await db.execute(
                "INSERT INTO personnel (cohort_id, name, duplicate_tag) VALUES ($1, $2, $3)",
                [selectedCohortId, newPersonName.trim(), tagToInsert]
            );

            setNewPersonName("");
            setNewPersonTag("");
            setShowTagInput(false);
            loadPersonnel(selectedCohortId);
        } catch (error) {
            console.error(error);
            alert("인원 추가에 실패했습니다.");
        }
    };

    // --- Modal States ---
    const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
    const [checkoutTarget, setCheckoutTarget] = useState<PersonnelWithCheckout | null>(null);
    const [checkoutType, setCheckoutType] = useState("");
    const [checkoutSerial, setCheckoutSerial] = useState("");
    const [checkoutTypeMode, setCheckoutTypeMode] = useState<'select' | 'custom'>('select');

    const [isRemarkModalOpen, setIsRemarkModalOpen] = useState(false);
    const [remarkTarget, setRemarkTarget] = useState<PersonnelWithCheckout | null>(null);
    const [remarkText, setRemarkText] = useState("");

    const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
    const [damageTarget, setDamageTarget] = useState<PersonnelWithCheckout | null>(null);
    const [damageReason, setDamageReason] = useState("");

    const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
    const [returnTarget, setReturnTarget] = useState<PersonnelWithCheckout | null>(null);

    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [replaceTarget, setReplaceTarget] = useState<PersonnelWithCheckout | null>(null);
    const [replaceType, setReplaceType] = useState("");
    const [replaceSerial, setReplaceSerial] = useState("");
    const [replaceTypeMode, setReplaceTypeMode] = useState<'select' | 'custom'>('select');

    const [isUndoModalOpen, setIsUndoModalOpen] = useState(false);
    const [undoTarget, setUndoTarget] = useState<PersonnelWithCheckout | null>(null);

    // --- Action Handlers ---
    const openCheckoutModal = (p: PersonnelWithCheckout) => {
        setCheckoutTarget(p);

        let defaultMode: 'select' | 'custom' = equipmentTypes.length > 0 ? 'select' : 'custom';
        setCheckoutTypeMode(defaultMode);
        setCheckoutType(defaultMode === 'select' ? equipmentTypes[0] : "");
        setCheckoutSerial("");
        setIsCheckoutModalOpen(true);
    };

    const submitCheckout = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!checkoutTarget || !checkoutType.trim() || !checkoutSerial.trim()) return;

        try {
            const db = await getDB();
            const existing: any[] = await db.select("SELECT id, status FROM equipment WHERE serial_number = $1", [checkoutSerial.trim()]);

            let equipmentId;
            if (existing.length > 0) {
                if (existing[0].status === 'CHECKED_OUT') {
                    alert("이미 불출 중인 장비입니다!");
                    return;
                }
                equipmentId = existing[0].id;
                await db.execute("UPDATE equipment SET status = 'CHECKED_OUT', type = $1 WHERE id = $2", [checkoutType.trim(), equipmentId]);
            } else {
                const res = await db.execute("INSERT INTO equipment (type, serial_number, status) VALUES ($1, $2, 'CHECKED_OUT')", [checkoutType.trim(), checkoutSerial.trim()]);
                equipmentId = res.lastInsertId;
            }

            const dateStr = new Date().toISOString().split('T')[0];
            await db.execute(
                "INSERT INTO checkouts (personnel_id, equipment_id, checkout_date) VALUES ($1, $2, $3)",
                [checkoutTarget.personnel_id, equipmentId, dateStr]
            );

            setIsCheckoutModalOpen(false);
            if (selectedCohortId) loadPersonnel(selectedCohortId);
        } catch (error) {
            console.error(error);
            alert("불출 처리에 실패했습니다.");
        }
    };

    const openReturnModal = (p: PersonnelWithCheckout) => {
        setReturnTarget(p);
        setIsReturnModalOpen(true);
    };

    const submitReturn = async () => {
        if (!returnTarget || !returnTarget.checkout_id || !returnTarget.equipment_id) return;
        try {
            const db = await getDB();
            const dateStr = new Date().toISOString().split('T')[0];
            await db.execute("UPDATE checkouts SET return_date = $1 WHERE id = $2", [dateStr, returnTarget.checkout_id]);

            // Only update to IN_STOCK if it's not DAMAGED
            const oldStatus: any[] = await db.select("SELECT status FROM equipment WHERE id = $1", [returnTarget.equipment_id]);
            if (oldStatus.length > 0 && oldStatus[0].status !== 'DAMAGED') {
                await db.execute("UPDATE equipment SET status = 'IN_STOCK' WHERE id = $1", [returnTarget.equipment_id]);
            }

            setIsReturnModalOpen(false);
            if (selectedCohortId) {
                loadPersonnel(selectedCohortId);
                loadCohorts();
            }
        } catch (error) {
            console.error(error);
            alert("반납 처리에 실패했습니다.");
        }
    };

    const confirmUndoReturn = (e: React.MouseEvent, p: PersonnelWithCheckout) => {
        e.stopPropagation();
        setUndoTarget(p);
        setIsUndoModalOpen(true);
    };

    const submitUndoReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!undoTarget || !undoTarget.checkout_id || !undoTarget.equipment_id) return;

        try {
            const db = await getDB();
            // Check if equipment is currently checked out to someone else
            const existing: any[] = await db.select("SELECT status FROM equipment WHERE id = $1", [undoTarget.equipment_id]);
            if (existing.length > 0 && existing[0].status === 'CHECKED_OUT') {
                alert("해당 장비는 이미 다른 인원에게 불출되었습니다. 반납 취소가 불가합니다.");
                setIsUndoModalOpen(false);
                return;
            }

            await db.execute("UPDATE checkouts SET return_date = NULL WHERE id = $1", [undoTarget.checkout_id]);

            // Restore to CHECKED_OUT only if it wasn't DAMAGED. 
            // If it's DAMAGED, keep it DAMAGED but it is no longer returned, so it's actively checked out and damaged.
            if (existing.length > 0 && existing[0].status !== 'DAMAGED') {
                await db.execute("UPDATE equipment SET status = 'CHECKED_OUT' WHERE id = $1", [undoTarget.equipment_id]);
            }

            setIsUndoModalOpen(false);
            if (selectedCohortId) {
                loadPersonnel(selectedCohortId);
                loadCohorts();
            }
        } catch (error) {
            console.error(error);
            alert("반납 취소 처리에 실패했습니다.");
            setIsUndoModalOpen(false);
        }
    };

    const openReplaceModal = (p: PersonnelWithCheckout) => {
        setReplaceTarget(p);

        let defaultMode: 'select' | 'custom' = equipmentTypes.length > 0 ? 'select' : 'custom';
        setReplaceTypeMode(defaultMode);

        // If current equipment type exists in dropdown, select it by default. Otherwise select the first option or empty.
        const currentType = p.equipment_type || "";
        if (defaultMode === 'select') {
            setReplaceType(equipmentTypes.includes(currentType) ? currentType : equipmentTypes[0]);
        } else {
            setReplaceType("");
        }

        setReplaceSerial("");
        setIsReplaceModalOpen(true);
    };

    const submitReplace = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!replaceTarget || !replaceTarget.checkout_id || !replaceTarget.equipment_id || !replaceType.trim() || !replaceSerial.trim()) return;

        try {
            const db = await getDB();

            // 1. Check if the new equipment already exists
            const existing: any[] = await db.select("SELECT id, status FROM equipment WHERE serial_number = $1", [replaceSerial.trim()]);
            let newEquipmentId;

            if (existing.length > 0) {
                if (existing[0].status === 'CHECKED_OUT') {
                    alert("새 장비 시리얼 넘버가 이미 불출 중인 장비입니다!");
                    return;
                }
                newEquipmentId = existing[0].id;
                await db.execute("UPDATE equipment SET status = 'CHECKED_OUT', type = $1 WHERE id = $2", [replaceType.trim(), newEquipmentId]);
            } else {
                const res = await db.execute("INSERT INTO equipment (type, serial_number, status) VALUES ($1, $2, 'CHECKED_OUT')", [replaceType.trim(), replaceSerial.trim()]);
                newEquipmentId = res.lastInsertId;
            }

            // 2. Clear out the old equipment status (unless it was DAMAGED)
            const oldEquipmentDetails: any[] = await db.select("SELECT status FROM equipment WHERE id = $1", [replaceTarget.equipment_id]);
            if (oldEquipmentDetails.length > 0 && oldEquipmentDetails[0].status !== 'DAMAGED') {
                await db.execute("UPDATE equipment SET status = 'IN_STOCK' WHERE id = $1", [replaceTarget.equipment_id]);
            }

            // 3. Prepare the previous serials string
            const prevChain = replaceTarget.previous_serial
                ? `${replaceTarget.previous_serial}, ${replaceTarget.serial_number}`
                : replaceTarget.serial_number;

            // 4. Update the checkout record
            await db.execute(
                "UPDATE checkouts SET equipment_id = $1, previous_serial = $2 WHERE id = $3",
                [newEquipmentId, prevChain, replaceTarget.checkout_id]
            );

            setIsReplaceModalOpen(false);
            if (selectedCohortId) {
                loadPersonnel(selectedCohortId);
            }
        } catch (error) {
            console.error("Replace Equipment Error:", error);
            alert("장비 교체 처리에 실패했습니다.");
        }
    };

    const openDamageModal = (p: PersonnelWithCheckout) => {
        setDamageTarget(p);
        setDamageReason("");
        setIsDamageModalOpen(true);
    };

    const submitDamage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!damageTarget || !damageTarget.equipment_id || !damageReason.trim()) return;

        try {
            const db = await getDB();
            await db.execute("UPDATE equipment SET status = 'DAMAGED' WHERE id = $1", [damageTarget.equipment_id]);

            const dateStr = new Date().toISOString().split('T')[0];
            await db.execute("INSERT INTO damage_reports (equipment_id, report_date, description) VALUES ($1, $2, $3)",
                [damageTarget.equipment_id, dateStr, damageReason.trim()]);

            setIsDamageModalOpen(false);
            if (selectedCohortId) loadPersonnel(selectedCohortId);
            alert("손상 처리되었습니다. 대시보드의 손상 장비 탭에서 사진을 첨부할 수 있습니다.");
        } catch (error) {
            console.error(error);
            alert("손상 처리에 실패했습니다.");
        }
    };

    const openRemarkModal = (p: PersonnelWithCheckout) => {
        setRemarkTarget(p);
        setRemarkText(p.remarks || "");
        setIsRemarkModalOpen(true);
    };

    const submitRemark = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!remarkTarget || !remarkTarget.checkout_id) return;
        try {
            const db = await getDB();
            await db.execute("UPDATE checkouts SET remarks = $1 WHERE id = $2", [remarkText.trim() || null, remarkTarget.checkout_id]);
            setIsRemarkModalOpen(false);
            if (selectedCohortId) loadPersonnel(selectedCohortId);
        } catch (error) {
            console.error(error);
            alert("특이사항 저장에 실패했습니다.");
        }
    };

    const getDisplayName = (p: PersonnelWithCheckout) =>
        p.duplicate_tag ? `${p.personnel_name} (${p.duplicate_tag})` : p.personnel_name;

    const exportExcel = () => {
        if (personnel.length === 0) return alert("출력할 데이터가 없습니다.");
        const cohortName = cohorts.find(c => c.id === selectedCohortId)?.name || 'Unknown';
        const exportData = personnel.map((p, idx) => ({
            "연번": idx + 1, "이름": getDisplayName(p), "장비 종류": p.equipment_type || '-',
            "시리얼넘버": p.serial_number || '-', "불출일": p.checkout_date || '-', "반납일": p.return_date ? p.return_date.substring(2).replace(/-/g, '/') : '', "특이사항": p.remarks || '-'
        }));
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, cohortName);
        XLSX.writeFile(workbook, `${cohortName}_장비현황.xlsx`);
    };

    return (
        <div className="space-y-6 flex flex-col h-full relative">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-gray-800 tracking-tight">기수별 장비 불출 관리</h2>
                <div className="flex gap-2">
                    <button
                        onClick={() => setIsColorModalOpen(true)}
                        className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 hover:bg-indigo-100 text-indigo-700 px-4 py-2 rounded-lg font-medium transition-colors shadow-sm"
                    >
                        <Palette className="w-4 h-4" />
                        기수 색상 설정
                    </button>
                    <button onClick={exportExcel} className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors shadow-sm">
                        <Download className="w-4 h-4" /> 엑셀 다운로드
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 overflow-hidden">
                {/* Left Sidebar */}
                <div className="w-64 flex flex-col gap-4">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-col h-full">
                        <h3 className="font-semibold text-gray-800 mb-4">기수 목록</h3>
                        <div className="flex-1 overflow-y-auto space-y-1.5 pr-2">
                            {cohorts.filter(c => c.is_hidden === 0).map((cohort) => {
                                const isSelected = selectedCohortId === cohort.id;
                                const customColor = cohort.color || "#4b5563"; // default gray-600

                                return (
                                    <div
                                        key={cohort.id}
                                        className={`group relative flex items-center justify-between w-full text-left px-3 py-2 rounded-lg transition-all border cursor-pointer
                                            ${isSelected ? "bg-gray-50 border-gray-200 shadow-sm" : "border-transparent hover:bg-gray-50"}
                                        `}
                                        onClick={() => setSelectedCohortId(cohort.id)}
                                    >
                                        <div className="flex items-center gap-2 min-w-0 pr-2 pointer-events-none">
                                            <span
                                                className="inline-flex items-center px-2 py-0.5 rounded-full text-[13px] font-bold shadow-sm border"
                                                style={{
                                                    backgroundColor: `${customColor}15`,
                                                    color: customColor,
                                                    borderColor: `${customColor}30`
                                                }}
                                            >
                                                {cohort.name}
                                            </span>
                                            <div className="flex items-center text-[10px] font-mono leading-none tracking-tight">
                                                <span className={`${cohort.checked_out_count > 0 ? 'text-gray-700 font-bold' : 'text-gray-400 font-medium'}`}>
                                                    {cohort.checked_out_count}/{cohort.total_personnel}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Hide Button */}
                                        <div className="flex items-center transition-opacity shrink-0" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={(e) => handleToggleCohortVisibility(e, cohort.id, cohort.is_hidden)}
                                                className="w-6 h-6 flex items-center justify-center text-gray-300 hover:text-gray-600 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-all"
                                                title="기수 숨기기"
                                            >
                                                <EyeOff className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}

                            {/* Hidden Cohorts Section */}
                            {cohorts.some(c => c.is_hidden === 1) && (
                                <div className="pt-4 mt-2 border-t border-gray-100">
                                    <button
                                        onClick={() => setShowHiddenCohorts(!showHiddenCohorts)}
                                        className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 w-full mb-2"
                                    >
                                        {showHiddenCohorts ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                        숨겨진 기수 ({cohorts.filter(c => c.is_hidden === 1).length})
                                    </button>

                                    {showHiddenCohorts && (
                                        <div className="space-y-1.5">
                                            {cohorts.filter(c => c.is_hidden === 1).map((cohort) => {
                                                const isSelected = selectedCohortId === cohort.id;
                                                const customColor = cohort.color || "#4b5563";

                                                return (
                                                    <div
                                                        key={`hidden-${cohort.id}`}
                                                        className={`group relative flex items-center justify-between w-full text-left px-3 py-1.5 rounded-lg opacity-60 hover:opacity-100 transition-all border cursor-pointer
                                                            ${isSelected ? "bg-gray-50 border-gray-200" : "border-transparent"}
                                                        `}
                                                        onClick={() => setSelectedCohortId(cohort.id)}
                                                    >
                                                        <div className="flex items-center gap-2 min-w-0 pr-2 pointer-events-none grayscale">
                                                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[12px] font-medium border"
                                                                style={{ backgroundColor: `${customColor}10`, color: customColor, borderColor: `${customColor}20` }}>
                                                                {cohort.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center shrink-0">
                                                            <button
                                                                onClick={(e) => handleToggleCohortVisibility(e, cohort.id, cohort.is_hidden)}
                                                                className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                                title="기수 다시 보이기"
                                                            >
                                                                <Eye className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                        <form onSubmit={handleAddCohort} className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                            <input
                                type="text" value={newCohortName} onChange={e => setNewCohortName(e.target.value)}
                                placeholder="새 기수명" className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 outline-none"
                            />
                            <button type="submit" className="p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"><Plus className="w-4 h-4" /></button>
                        </form>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 flex flex-col gap-4 min-w-0">
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                        {selectedCohortId ? (
                            <>
                                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                    <h3 className="font-semibold text-gray-800">인원 및 장비 현황 - {cohorts.find(c => c.id === selectedCohortId)?.name}</h3>
                                    <form onSubmit={handleAddPersonnel} className="flex gap-2 items-center">
                                        <input
                                            type="text" value={newPersonName} onChange={e => { setNewPersonName(e.target.value); setShowTagInput(false); }}
                                            placeholder="인원 이름" className="w-32 px-3 py-1.5 text-sm border border-gray-300 rounded-md focus:border-blue-500 outline-none"
                                        />
                                        {showTagInput && (
                                            <input
                                                type="text" value={newPersonTag} onChange={e => setNewPersonTag(e.target.value)}
                                                placeholder="동명이인 태그 (예: A)" className="w-36 px-3 py-1.5 text-sm border border-red-300 rounded-md focus:border-red-500 outline-none" autoFocus
                                            />
                                        )}
                                        <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 whitespace-nowrap">
                                            {showTagInput ? "태그 포함 추가" : "인원 추가"}
                                        </button>
                                    </form>
                                </div>

                                <div className="overflow-auto flex-1">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200">
                                            <tr className="text-gray-500 uppercase tracking-wider">
                                                <th className="px-4 py-3 font-medium w-12">연번</th>
                                                <th className="px-4 py-3 font-medium w-32">이름</th>
                                                <th className="px-4 py-3 font-medium">장비종류</th>
                                                <th className="px-4 py-3 font-medium border-r border-gray-100">시리얼넘버</th>
                                                <th className="px-4 py-3 font-medium border-r border-gray-100 w-28 text-center">반납일</th>
                                                <th className="px-4 py-3 font-medium text-center">장비 관리 액션</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {personnel.length === 0 ? (
                                                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-500">등록된 인원이 없습니다.</td></tr>
                                            ) : (
                                                personnel.map((p, idx) => (
                                                    <tr key={`${p.personnel_id}-${p.checkout_id || 'new'}`} className="hover:bg-gray-50/50 group">
                                                        <td className="px-4 py-4 text-gray-500">{idx + 1}</td>
                                                        <td className="px-4 py-4 font-medium text-gray-900">
                                                            {getDisplayName(p)}
                                                            {p.remarks && <div className="text-xs text-blue-600 mt-1 truncate max-w-[120px]" title={p.remarks}>* {p.remarks}</div>}
                                                        </td>
                                                        <td className="px-4 py-4 text-gray-600">
                                                            {p.equipment_type || <span className="text-gray-300">-</span>}
                                                        </td>
                                                        <td className="px-4 py-4 text-gray-600 font-mono text-xs border-r border-gray-100 flex-col">
                                                            <div className="flex items-center gap-1.5 mb-1">
                                                                <span>{p.serial_number || <span className="text-gray-300">-</span>}</span>
                                                                {p.return_date && <span className="px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded text-[10px] font-medium border border-gray-200">반납 완료</span>}
                                                                {p.status === 'DAMAGED' && <span className="px-1.5 py-0.5 bg-red-100 text-red-800 rounded text-[10px] font-medium border border-red-200">손상됨</span>}
                                                            </div>
                                                            {p.previous_serial && p.previous_serial.split(',').map((serial, i) => (
                                                                <div key={i} className="text-[10px] text-gray-400 font-normal mt-0.5">
                                                                    기존장비: {serial.trim()}
                                                                </div>
                                                            ))}
                                                        </td>
                                                        <td className="px-4 py-4 text-gray-500 font-mono text-center text-xs border-r border-gray-100">
                                                            {p.return_date ? p.return_date.substring(2).replace(/-/g, '/') : ""}
                                                        </td>
                                                        <td className="px-4 py-4">
                                                            <div className="flex justify-center gap-1.5">
                                                                {!p.checkout_id || (p.status === 'IN_STOCK' && !p.equipment_type) ? (
                                                                    <button onClick={() => openCheckoutModal(p)} className="px-2.5 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors flex items-center gap-1 font-medium">
                                                                        <Plus className="w-3.5 h-3.5" /> 새 장비 불출
                                                                    </button>
                                                                ) : p.return_date !== null ? (
                                                                    <>
                                                                        <button onClick={() => openCheckoutModal(p)} className="px-2 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded transition-colors flex items-center gap-1 font-medium border border-gray-200" title="새로운 다른 장비 불출">
                                                                            <Plus className="w-3.5 h-3.5" /> 새 장비
                                                                        </button>
                                                                        <button onClick={(e) => confirmUndoReturn(e, p)} className="px-2 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded border border-amber-200 flex items-center gap-1 font-medium" title="실수로 반납 처리한 경우 취소합니다.">
                                                                            <RotateCcw className="w-3.5 h-3.5" /> 반납 취소
                                                                        </button>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <button onClick={() => openReturnModal(p)} className="px-2 py-1.5 text-xs bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded border border-emerald-200 flex items-center gap-1 font-medium title='장비를 반납합니다'">
                                                                            <CheckCircle2 className="w-3.5 h-3.5" /> 반납
                                                                        </button>
                                                                        <button onClick={() => openReplaceModal(p)} className="px-2 py-1.5 text-xs bg-orange-50 hover:bg-orange-100 text-orange-700 rounded border border-orange-200 flex items-center gap-1 font-medium" title="다른 장비로 교체합니다">
                                                                            <RefreshCw className="w-3.5 h-3.5" /> 교체
                                                                        </button>
                                                                        <button title="특이사항 기록" onClick={() => openRemarkModal(p)} className="px-2 py-1.5 text-xs bg-blue-50 hover:bg-blue-100 text-blue-700 rounded border border-blue-200 flex items-center gap-1 font-medium">
                                                                            <FileText className="w-3.5 h-3.5" /> 메모
                                                                        </button>
                                                                        {p.status !== 'DAMAGED' && (
                                                                            <button title="장비 손상 보고" onClick={() => openDamageModal(p)} className="px-2 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-700 rounded border border-red-200 flex items-center gap-1 font-medium">
                                                                                <XCircle className="w-3.5 h-3.5" /> 손상
                                                                            </button>
                                                                        )}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-gray-400 p-8">좌측에서 기수를 선택해주세요.</div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modals */}
            {isCheckoutModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">새 장비 불출</h3>
                            <button onClick={() => setIsCheckoutModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitCheckout} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">불출 대상</label>
                                <div className="p-2 bg-gray-50 rounded text-sm text-gray-600">{checkoutTarget ? getDisplayName(checkoutTarget) : ""}</div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">장비 종류 <span className="text-red-500">*</span></label>
                                {checkoutTypeMode === 'select' ? (
                                    <div className="flex flex-col gap-2">
                                        <select
                                            value={checkoutType}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setCheckoutTypeMode('custom');
                                                    setCheckoutType("");
                                                } else {
                                                    setCheckoutType(e.target.value);
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none bg-white"
                                        >
                                            {equipmentTypes.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value="__custom__">+ 직접 입력 (새 장비)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={checkoutType}
                                            onChange={e => setCheckoutType(e.target.value)}
                                            required autoFocus
                                            placeholder="예: 소총, 무전기"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none"
                                        />
                                        {equipmentTypes.length > 0 && (
                                            <button type="button" onClick={() => { setCheckoutTypeMode('select'); setCheckoutType(equipmentTypes[0]); }} className="text-xs text-blue-600 whitespace-nowrap hover:underline">
                                                목록 선택
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">시리얼 넘버 <span className="text-red-500">*</span></label>
                                <input type="text" value={checkoutSerial} onChange={e => setCheckoutSerial(e.target.value)} required placeholder="S/N" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 outline-none" />
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsCheckoutModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">불출 완료</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isRemarkModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="font-bold text-gray-800">특이사항 메모</h3>
                            <button onClick={() => setIsRemarkModalOpen(false)} className="text-gray-400 hover:text-gray-600"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitRemark} className="p-6 space-y-4">
                            <textarea value={remarkText} onChange={e => setRemarkText(e.target.value)} autoFocus rows={4} placeholder="장비 파손 우려, 대여 연장 등 특이사항..." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-blue-500 outline-none resize-none" />
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-gray-400">내용을 모두 지우면 메모가 삭제됩니다.</span>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setIsRemarkModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                                    <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 font-medium">저장</button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isDamageModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                        <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                            <h3 className="font-bold text-red-800">장비 손상 보고</h3>
                            <button onClick={() => setIsDamageModalOpen(false)} className="text-red-400 hover:text-red-600"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitDamage} className="p-6 space-y-4">
                            <div className="text-sm text-gray-600 mb-2">
                                <strong>{damageTarget?.equipment_type}</strong> (S/N: {damageTarget?.serial_number}) 장비가 손상 처리되며, 대시보드의 손상 장비 탭으로 이동됩니다.
                            </div>
                            <textarea value={damageReason} onChange={e => setDamageReason(e.target.value)} required autoFocus rows={3} placeholder="어떻게 파손되었는지 사유를 적어주세요." className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-red-500 outline-none resize-none" />
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsDamageModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">파손 처리 확정</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {isReturnModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-80 overflow-hidden">
                        <div className="p-6 text-center space-y-4">
                            <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                                <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 mb-1">장비 반납</h3>
                                <p className="text-sm text-gray-500">{returnTarget?.equipment_type} 기기를 반납 처리하시겠습니까? 창고 재고로 이동됩니다.</p>
                            </div>
                        </div>
                        <div className="flex border-t border-gray-100">
                            <button onClick={() => setIsReturnModalOpen(false)} className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100">취소</button>
                            <button onClick={submitReturn} className="flex-1 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50">반납 확정</button>
                        </div>
                    </div>
                </div>
            )}
            {/* Cohort Color Setting Modal */}
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
                                기수별 색상 지정
                            </h3>
                            <button
                                onClick={() => setIsColorModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600 transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1">
                            {cohorts.length === 0 ? (
                                <p className="text-center text-gray-500 py-8">등록된 기수가 없습니다.</p>
                            ) : (
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-500 mb-4">
                                        우측의 컬러 피커를 클릭하여 각 기수의 고유 색상을 지정하세요. 지정된 색상은 대시보드의 기수 목록 캡슐에 반영됩니다.
                                    </p>
                                    {cohorts.map(cohort => {
                                        const cColor = cohort.color || '#4b5563';
                                        return (
                                            <div key={cohort.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <span
                                                    className="font-bold px-2.5 py-1.5 rounded-full text-sm shadow-sm border"
                                                    style={{
                                                        backgroundColor: `${cColor}15`,
                                                        color: cColor,
                                                        borderColor: `${cColor}30`
                                                    }}
                                                >
                                                    {cohort.name}
                                                </span>
                                                <div className="flex items-center gap-3">
                                                    <div className="text-xs text-gray-400 font-mono uppercase w-16 text-right">
                                                        {cColor}
                                                    </div>
                                                    <input
                                                        type="color"
                                                        value={cColor}
                                                        onChange={(e) => handleColorChange(cohort.id, e.target.value)}
                                                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 bg-transparent"
                                                    />
                                                </div>
                                            </div>
                                        )
                                    })}
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

            {/* Replace Modal */}
            {isReplaceModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                        <div className="px-6 py-4 bg-orange-50 border-b border-orange-100 flex justify-between items-center">
                            <h3 className="font-bold text-orange-800">장비 교체</h3>
                            <button onClick={() => setIsReplaceModalOpen(false)} className="text-orange-400 hover:text-orange-600"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitReplace} className="p-6 space-y-4">
                            <div className="text-sm text-gray-600 mb-2">
                                <strong>{replaceTarget?.personnel_name}</strong> 인원의 대여 장비를 새 장비로 교체 기록합니다.<br />
                                기존 장비({replaceTarget?.equipment_type} - {replaceTarget?.serial_number})는 자동으로 반납 처리됩니다.
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 장비 종류 <span className="text-red-500">*</span></label>
                                {replaceTypeMode === 'select' ? (
                                    <div className="flex flex-col gap-2">
                                        <select
                                            value={replaceType}
                                            onChange={(e) => {
                                                if (e.target.value === '__custom__') {
                                                    setReplaceTypeMode('custom');
                                                    setReplaceType("");
                                                } else {
                                                    setReplaceType(e.target.value);
                                                }
                                            }}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-orange-500 outline-none bg-white"
                                        >
                                            {equipmentTypes.map(t => (
                                                <option key={t} value={t}>{t}</option>
                                            ))}
                                            <option value="__custom__">+ 직접 입력 (새 장비)</option>
                                        </select>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={replaceType}
                                            onChange={e => setReplaceType(e.target.value)}
                                            required autoFocus
                                            placeholder="예: 소총, 무전기"
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-orange-500 outline-none"
                                        />
                                        {equipmentTypes.length > 0 && (
                                            <button type="button" onClick={() => { setReplaceTypeMode('select'); setReplaceType(equipmentTypes.includes(replaceTarget?.equipment_type || "") ? (replaceTarget?.equipment_type || "") : equipmentTypes[0]); }} className="text-xs text-orange-600 whitespace-nowrap hover:underline">
                                                목록 선택
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">새 장비 시리얼 넘버 <span className="text-red-500">*</span></label>
                                <input type="text" value={replaceSerial} onChange={e => setReplaceSerial(e.target.value)} required placeholder="S/N" className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-orange-500 outline-none" />
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsReplaceModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200">취소</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 font-medium">교체 완료</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Undo Confirm Modal */}
            {isUndoModalOpen && undoTarget && (
                <div className="fixed inset-0 bg-black/50 flex flex-col items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                        <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex justify-between items-center">
                            <h3 className="font-bold text-amber-800">반납 취소</h3>
                            <button onClick={() => setIsUndoModalOpen(false)} className="text-amber-400 hover:text-amber-600"><XCircle className="w-5 h-5" /></button>
                        </div>
                        <form onSubmit={submitUndoReturn} className="p-6 space-y-4">
                            <div className="text-sm text-gray-600">
                                <strong>{undoTarget.personnel_name}</strong> 인원의 <strong>{undoTarget.equipment_type} ({undoTarget.serial_number})</strong> 반납 처리를 취소하고 다시 불출 상태로 되돌리시겠습니까?
                            </div>
                            <div className="pt-2 flex justify-end gap-2">
                                <button type="button" onClick={() => setIsUndoModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md border border-gray-200">취소</button>
                                <button type="submit" className="px-4 py-2 text-sm bg-amber-600 text-white rounded-md hover:bg-amber-700 font-medium">반납 취소 확정</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
