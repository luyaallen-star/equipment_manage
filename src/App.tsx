import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { initDB } from "./lib/db";
import Layout from "./components/Layout";
import { GlobalDataProvider } from "./contexts/GlobalDataContext";
import "./App.css";

// Placeholder pages
import Dashboard from "./pages/Dashboard";
import CohortsPage from "./pages/Cohorts";
import EquipmentPage from "./pages/EquipmentPage";
import InventoryPage from "./pages/InventoryPage";
import DamagedPage from "./pages/DamagedPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  const [dbReady, setDbReady] = useState(false);
  const [error, setError] = useState<any>(null);

  useEffect(() => {
    initDB()
      .then(() => setDbReady(true))
      .catch((err) => setError(err));
  }, []);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-red-50 text-red-600 p-8">
        <h1 className="text-xl font-bold mb-2">데이터베이스 초기화 실패</h1>
        <div className="bg-red-100 p-4 rounded text-sm whitespace-pre-wrap max-w-full overflow-auto">
          {typeof error === 'string' ? error : (error?.message || JSON.stringify(error))}
        </div>
      </div>
    );
  }

  if (!dbReady) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50 text-gray-500">
        <div className="animate-pulse flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-blue-500"></div>
          데이터베이스를 불러오는 중입니다...
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <GlobalDataProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/equipment" element={<EquipmentPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/cohorts" element={<CohortsPage />} />
            <Route path="/damaged" element={<DamagedPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Routes>
        </Layout>
      </GlobalDataProvider>
    </BrowserRouter>
  );
}

export default App;
