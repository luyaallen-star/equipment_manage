import { useEffect, useState } from "react";
import { getDB } from "../lib/db";
import { Plus, Download, XCircle, FileText, CheckCircle2, Palette, EyeOff, Eye, RotateCcw, RefreshCw } from "lucide-react";
import { saveExcelWithDialog } from "../lib/excelUtils";
import { CheckoutModal } from "../components/modals/CheckoutModal";
import { RemarkModal } from "../components/modals/RemarkModal";
import { ReturnModal } from "../components/modals/ReturnModal";
import { DamageModal } from "../components/modals/DamageModal";
import { ReplaceModal } from "../components/modals/ReplaceModal";
import { UndoConfirmModal } from "../components/modals/UndoConfirmModal";
import { ColorModal } from "../components/modals/ColorModal";
import { BatchReturnModal } from "../components/modals/BatchReturnModal";
import { useGlobalData } from "../contexts/GlobalDataContext";



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
    const { cohorts, equipmentTypes, refreshData } = useGlobalData();
    const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
    const [personnel, setPersonnel] = useState<PersonnelWithCheckout[]>([]);
    const [newCohortName, setNewCohortName] = useState("");
    const [isColorModalOpen, setIsColorModalOpen] = useState(false);
    const [showHiddenCohorts, setShowHiddenCohorts] = useState(false);

    const [newPersonName, setNewPersonName] = useState("");
    const [newPersonTag, setNewPersonTag] = useState("");
    const [showTagInput, setShowTagInput] = useState(false);

    // Batch Processing State
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    useEffect(() => {
        if (selectedCohortId) {
            loadPersonnel(selectedCohortId);
        } else {
            setPersonnel([]);
        }
    }, [selectedCohortId]);

    useEffect(() => {
        const visibleCohorts = cohorts.filter(c => c.is_hidden === 0);
        if (visibleCohorts.length > 0 && !selectedCohortId) {
            setSelectedCohortId(visibleCohorts[0].id);
        }
    }, [cohorts, selectedCohortId]);

    // Clear selection when cohort changes
    useEffect(() => {
        setSelectedIds(new Set());
    }, [selectedCohortId]);

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
            refreshData();
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
            refreshData();
            if (currentHidden === 0 && selectedCohortId === cohortId) {
                setSelectedCohortId(null);
            }
        } catch (error) {
            console.error(error);
            alert("기수 상태 변경에 실패했습니다.");
        }
    };

    const handleColorChange = async (cohortId: number, color: string) => {
        try {
            const db = await getDB();
            await db.execute("UPDATE cohorts SET color = $1 WHERE id = $2", [color, cohortId]);
            await refreshData();
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

    // --- Batch Modal States ---
    const [isBatchReturnModalOpen, setIsBatchReturnModalOpen] = useState(false);

    const [isReplaceModalOpen, setIsReplaceModalOpen] = useState(false);
    const [replaceTarget, setReplaceTarget] = useState<PersonnelWithCheckout | null>(null);
    const [replaceType, setReplaceType] = useState("");
    const [replaceSerial, setReplaceSerial] = useState("");

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

            // Update status to NEEDS_INSPECTION to require check before next checkout
            const oldStatus: any[] = await db.select("SELECT status FROM equipment WHERE id = $1", [returnTarget.equipment_id]);
            if (oldStatus.length > 0 && oldStatus[0].status !== 'DAMAGED') {
                await db.execute("UPDATE equipment SET status = 'NEEDS_INSPECTION' WHERE id = $1", [returnTarget.equipment_id]);
            }

            setIsReturnModalOpen(false);
            if (selectedCohortId) {
                loadPersonnel(selectedCohortId);
                refreshData();
            }
        } catch (error) {
            console.error(error);
            alert("반납 처리에 실패했습니다.");
        }
    };

    // --- Batch Action Handlers ---
    const submitBatchReturn = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const db = await getDB();
            const dateStr = new Date().toISOString().split('T')[0];
            const selectedPersonnel = personnel.filter(p => selectedIds.has(p.personnel_id) && p.status === 'CHECKED_OUT' && p.checkout_id);

            if (selectedPersonnel.length === 0) {
                alert("선택된 인원 중 반납 가능한 불출 장비가 없습니다.");
                return;
            }

            for (const p of selectedPersonnel) {
                await db.execute("UPDATE checkouts SET return_date = $1 WHERE id = $2", [dateStr, p.checkout_id]);
                // Ensure we don't overwrite DAMAGED status on return
                await db.execute("UPDATE equipment SET status = 'NEEDS_INSPECTION' WHERE id = $1 AND status != 'DAMAGED'", [p.equipment_id]);
            }

            setIsBatchReturnModalOpen(false);
            setSelectedIds(new Set()); // clear selection
            if (selectedCohortId) {
                loadPersonnel(selectedCohortId);
                refreshData();
            }
            alert(`${selectedPersonnel.length}개의 장비가 일괄 반납되었습니다.`);

        } catch (error) {
            console.error(error);
            alert("일괄 반납 처리에 실패했습니다.");
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
                refreshData();
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

            // 2. Set the old equipment status to NEEDS_INSPECTION (unless it was DAMAGED)
            const oldEquipmentDetails: any[] = await db.select("SELECT status FROM equipment WHERE id = $1", [replaceTarget.equipment_id]);
            if (oldEquipmentDetails.length > 0 && oldEquipmentDetails[0].status !== 'DAMAGED') {
                await db.execute("UPDATE equipment SET status = 'NEEDS_INSPECTION' WHERE id = $1", [replaceTarget.equipment_id]);
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

    const exportExcel = async () => {
        if (personnel.length === 0) return alert("출력할 데이터가 없습니다.");
        const cohortName = cohorts.find(c => c.id === selectedCohortId)?.name || 'Unknown';
        const exportData = personnel.map((p, idx) => ({
            "연번": idx + 1, "이름": getDisplayName(p), "장비 종류": p.equipment_type || '-',
            "시리얼넘버": p.serial_number || '-', "불출일": p.checkout_date || '-', "반납일": p.return_date ? p.return_date.substring(2).replace(/-/g, '/') : '', "특이사항": p.remarks || '-'
        }));
        await saveExcelWithDialog(exportData, cohortName, `${cohortName}_장비현황`);
    };

    const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setSelectedIds(new Set(personnel.map(p => p.personnel_id)));
        } else {
            setSelectedIds(new Set());
        }
    };

    const handleSelectOne = (id: number) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
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

                                {selectedIds.size > 0 && (
                                    <div className="bg-indigo-50 px-4 py-2 flex items-center justify-between border-b border-indigo-100">
                                        <span className="text-sm font-medium text-indigo-700">
                                            {selectedIds.size}명 선택됨
                                        </span>
                                        <div className="flex gap-2">
                                            <button
                                                className="px-3 py-1.5 bg-white border border-indigo-200 text-emerald-700 hover:bg-emerald-50 rounded text-sm font-medium shadow-sm flex items-center gap-1.5 transition-colors"
                                                onClick={() => setIsBatchReturnModalOpen(true)}
                                            >
                                                <CheckCircle2 className="w-3.5 h-3.5" /> 일괄 반납
                                            </button>
                                        </div>
                                    </div>
                                )}

                                <div className="overflow-auto flex-1">
                                    <table className="w-full text-left border-collapse text-sm">
                                        <thead className="sticky top-0 bg-gray-50 z-10 shadow-sm border-b border-gray-200">
                                            <tr className="text-gray-500 uppercase tracking-wider">
                                                <th className="px-4 py-3 font-medium w-10 text-center">
                                                    <input
                                                        type="checkbox"
                                                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                                        checked={personnel.length > 0 && selectedIds.size === personnel.length}
                                                        onChange={handleSelectAll}
                                                    />
                                                </th>
                                                <th className="px-4 py-3 font-medium w-12">연번</th>
                                                <th className="px-4 py-3 font-medium w-32">이름</th>
                                                <th className="px-4 py-3 font-medium">장비종류</th>
                                                <th className="px-4 py-3 font-medium w-auto whitespace-nowrap border-r border-gray-100">시리얼넘버</th>
                                                <th className="px-4 py-3 font-medium border-r border-gray-100 w-28 text-center">반납일</th>
                                                <th className="px-4 py-3 font-medium border-r border-gray-100 min-w-[200px]">메모</th>
                                                <th className="px-4 py-3 font-medium text-center">장비 관리 액션</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100 bg-white">
                                            {personnel.length === 0 ? (
                                                <tr><td colSpan={8} className="px-4 py-12 text-center text-gray-500">등록된 인원이 없습니다.</td></tr>
                                            ) : (
                                                personnel.map((p, idx) => (
                                                    <tr key={`${p.personnel_id}-${p.checkout_id || 'new'}`} className={`hover:bg-gray-50/50 group ${selectedIds.has(p.personnel_id) ? 'bg-indigo-50/30' : ''}`}>
                                                        <td className="px-4 py-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                                                checked={selectedIds.has(p.personnel_id)}
                                                                onChange={() => handleSelectOne(p.personnel_id)}
                                                            />
                                                        </td>
                                                        <td className="px-4 py-4 text-gray-500">{idx + 1}</td>
                                                        <td className="px-4 py-4 font-medium text-gray-900">
                                                            {getDisplayName(p)}
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
                                                        <td className="px-4 py-4 text-gray-600 text-xs border-r border-gray-100 break-all">
                                                            {p.remarks || <span className="text-gray-300">-</span>}
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
            <CheckoutModal
                isOpen={isCheckoutModalOpen}
                onClose={() => setIsCheckoutModalOpen(false)}
                onSubmit={submitCheckout}
                checkoutTargetName={checkoutTarget ? getDisplayName(checkoutTarget) : ""}
                checkoutTypeMode={checkoutTypeMode}
                setCheckoutTypeMode={setCheckoutTypeMode}
                checkoutType={checkoutType}
                setCheckoutType={setCheckoutType}
                equipmentTypes={equipmentTypes}
                checkoutSerial={checkoutSerial}
                setCheckoutSerial={setCheckoutSerial}
            />

            <RemarkModal
                isOpen={isRemarkModalOpen}
                onClose={() => setIsRemarkModalOpen(false)}
                onSubmit={submitRemark}
                remarkText={remarkText}
                setRemarkText={setRemarkText}
            />

            <DamageModal
                isOpen={isDamageModalOpen}
                onClose={() => setIsDamageModalOpen(false)}
                onSubmit={submitDamage}
                damageTarget={damageTarget}
                damageReason={damageReason}
                setDamageReason={setDamageReason}
            />

            <ReturnModal
                isOpen={isReturnModalOpen}
                onClose={() => setIsReturnModalOpen(false)}
                onSubmit={submitReturn}
                targetName={returnTarget?.equipment_type}
            />

            {/* Cohort Color Setting Modal */}
            <ColorModal
                isOpen={isColorModalOpen}
                onClose={() => setIsColorModalOpen(false)}
                cohorts={cohorts}
                handleColorChange={handleColorChange}
            />

            {/* Replace Modal */}
            <ReplaceModal
                isOpen={isReplaceModalOpen}
                onClose={() => setIsReplaceModalOpen(false)}
                onSubmit={submitReplace}
                replaceTarget={replaceTarget}
                replaceSerial={replaceSerial}
                setReplaceSerial={setReplaceSerial}
            />

            <UndoConfirmModal
                isOpen={isUndoModalOpen}
                onClose={() => setIsUndoModalOpen(false)}
                onConfirm={submitUndoReturn}
                undoTarget={undoTarget}
            />

            <BatchReturnModal
                isOpen={isBatchReturnModalOpen}
                onClose={() => setIsBatchReturnModalOpen(false)}
                onSubmit={submitBatchReturn}
                selectedCount={selectedIds.size}
            />
        </div>
    );
}
