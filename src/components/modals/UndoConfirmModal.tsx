import { AlertCircle } from "lucide-react";

interface UndoConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (e: React.FormEvent) => void;
    undoTarget: {
        equipment_type: string | null;
        serial_number: string | null;
        personnel_name: string | null;
    } | null;
}

export function UndoConfirmModal({
    isOpen,
    onClose,
    onConfirm,
    undoTarget
}: UndoConfirmModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-80 overflow-hidden">
                <div className="p-6 text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">반납 취소</h3>
                        <p className="text-sm text-gray-500">
                            <strong>{undoTarget?.personnel_name}</strong>님의<br />
                            [{undoTarget?.equipment_type}] {undoTarget?.serial_number} 반납을 취소하시겠습니까?<br />
                            <span className="text-red-500 text-xs mt-2 block">해당 장비는 다시 '불출됨' 상태로 복구됩니다.</span>
                        </p>
                    </div>
                </div>
                <div className="flex border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100"
                    >
                        유지
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                        반납 취소 (복구)
                    </button>
                </div>
            </div>
        </div>
    );
}
