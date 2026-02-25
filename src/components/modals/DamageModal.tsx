import { XCircle } from "lucide-react";

interface DamageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (e: React.FormEvent) => void;
    damageTarget: {
        equipment_type: string | null;
        serial_number: string | null;
    } | null;
    damageReason: string;
    setDamageReason: (reason: string) => void;
}

export function DamageModal({
    isOpen,
    onClose,
    onSubmit,
    damageTarget,
    damageReason,
    setDamageReason
}: DamageModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl shadow-xl w-96 overflow-hidden">
                <div className="px-6 py-4 bg-red-50 border-b border-red-100 flex justify-between items-center">
                    <h3 className="font-bold text-red-800">장비 손상 보고</h3>
                    <button onClick={onClose} className="text-red-400 hover:text-red-600">
                        <XCircle className="w-5 h-5" />
                    </button>
                </div>
                <form onSubmit={onSubmit} className="p-6 space-y-4">
                    <div className="text-sm text-gray-600 mb-2">
                        <strong>{damageTarget?.equipment_type}</strong> (S/N: {damageTarget?.serial_number}) 장비가 손상 처리되며, 대시보드의 손상 장비 탭으로 이동됩니다.
                    </div>
                    <textarea
                        value={damageReason}
                        onChange={e => setDamageReason(e.target.value)}
                        required
                        autoFocus
                        rows={3}
                        placeholder="어떻게 파 파손되었는지 사유를 적어주세요."
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:border-red-500 outline-none resize-none"
                    />
                    <div className="pt-2 flex justify-end gap-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-md">취소</button>
                        <button type="submit" className="px-4 py-2 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 font-medium">파손 처리 확정</button>
                    </div>
                </form>
            </div>
        </div>
    );
}
