import { CheckCircle2 } from "lucide-react";

interface ReturnModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: () => void;
    targetName: string | null | undefined;
}

export function ReturnModal({
    isOpen,
    onClose,
    onSubmit,
    targetName
}: ReturnModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-80 overflow-hidden">
                <div className="p-6 text-center space-y-4">
                    <div className="mx-auto w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center">
                        <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-gray-900 mb-1">장비 반납</h3>
                        <p className="text-sm text-gray-500">
                            {targetName} 기기를 반납 처리하시겠습니까? 창고 재고로 이동됩니다.
                        </p>
                    </div>
                </div>
                <div className="flex border-t border-gray-100">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 text-sm font-medium text-gray-600 hover:bg-gray-50 border-r border-gray-100"
                    >
                        취소
                    </button>
                    <button
                        onClick={onSubmit}
                        className="flex-1 py-3 text-sm font-medium text-emerald-600 hover:bg-emerald-50"
                    >
                        반납 확정
                    </button>
                </div>
            </div>
        </div>
    );
}
