type BadgeStatus = 'IN_STOCK' | 'CHECKED_OUT' | 'DAMAGED';

interface StatusBadgeProps {
    status: BadgeStatus | string;
    label?: string; // Optional override text
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
    if (status === 'IN_STOCK') {
        return (
            <span className="inline-block px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-semibold shrink-0">
                {label || '창고 보관중'}
            </span>
        );
    }

    if (status === 'CHECKED_OUT') {
        return (
            <span className="inline-block px-2.5 py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold shrink-0">
                {label || '불출중'}
            </span>
        );
    }

    if (status === 'DAMAGED') {
        return (
            <span className="inline-block px-2.5 py-1 bg-red-100 text-red-800 rounded-full text-xs font-semibold shrink-0">
                {label || '손상/파손'}
            </span>
        );
    }

    // Fallback
    return (
        <span className="inline-block px-2.5 py-1 bg-gray-100 text-gray-800 rounded-full text-xs font-semibold shrink-0">
            {status}
        </span>
    );
}
