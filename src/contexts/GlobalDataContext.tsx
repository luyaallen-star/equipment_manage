import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDB } from '../lib/db';

interface Cohort {
    id: number;
    name: string;
    color: string | null;
    sort_order: number;
    is_hidden: number;
    total_personnel: number;
    checked_out_count: number;
}

interface GlobalData {
    cohorts: Cohort[];
    equipmentTypes: string[];
    isLoading: boolean;
    refreshData: () => Promise<void>;
}

const GlobalDataContext = createContext<GlobalData | undefined>(undefined);

export const GlobalDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [cohorts, setCohorts] = useState<Cohort[]>([]);
    const [equipmentTypes, setEquipmentTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const refreshData = useCallback(async () => {
        setIsLoading(true);
        try {
            const db = await getDB();

            // Generate all cohorts (including hidden) with subquery data
            const loadedCohorts: Cohort[] = await db.select(`
                SELECT 
                    c.*,
                    (SELECT COUNT(*) FROM personnel WHERE cohort_id = c.id) as total_personnel,
                    (
                        SELECT COUNT(ck.id) 
                        FROM checkouts ck
                        JOIN personnel p on ck.personnel_id = p.id
                        WHERE p.cohort_id = c.id AND ck.return_date IS NULL
                    ) as checked_out_count
                FROM cohorts c
                ORDER BY c.is_hidden ASC, c.sort_order ASC
            `);
            setCohorts(loadedCohorts);

            // Generate Equipment Types
            const typesResult: { type: string }[] = await db.select("SELECT DISTINCT type FROM equipment WHERE type IS NOT NULL ORDER BY type ASC");
            setEquipmentTypes(typesResult.map(t => t.type));

        } catch (error) {
            console.error("Failed to load global data:", error);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        refreshData();
    }, [refreshData]);

    return (
        <GlobalDataContext.Provider value={{ cohorts, equipmentTypes, isLoading, refreshData }}>
            {children}
        </GlobalDataContext.Provider>
    );
};

export const useGlobalData = () => {
    const context = useContext(GlobalDataContext);
    if (context === undefined) {
        throw new Error('useGlobalData must be used within a GlobalDataProvider');
    }
    return context;
};
