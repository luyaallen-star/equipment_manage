import { useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import Swal from "sweetalert2";

export default function Updater() {
    useEffect(() => {
        // Runs once on startup to check for updates
        checkForAppUpdates();
    }, []);

    async function checkForAppUpdates() {
        try {
            const update = await check();

            // If an update is available (update !== null)
            if (update) {
                console.log(`Update available: ${update.version}`);

                // Prompt user to update
                const result = await Swal.fire({
                    title: "새 버전 업데이트 안내",
                    html: `최신 버전(<b>${update.version}</b>)이 출시되었습니다.<br/>지금 바로 업데이트하시겠습니까?<br/><br/><span style="font-size: 13px; color: gray;">참고: ${update.body || '최신 기능 추가 및 버그 수정'}</span>`,
                    icon: "info",
                    showCancelButton: true,
                    confirmButtonColor: "#10b981", // Emerald 500
                    cancelButtonColor: "#6b7280", // Gray 500
                    confirmButtonText: "예, 지금 설치합니다",
                    cancelButtonText: "나중에"
                });

                if (result.isConfirmed) {
                    let downloaded = 0;
                    let contentLength = 0;

                    // Show blocking loading dialog while downloading
                    Swal.fire({
                        title: "업데이트 다운로드 중...",
                        html: "잠시만 기다려주세요, 앱이 곧 재시작됩니다.",
                        allowOutsideClick: false,
                        allowEscapeKey: false,
                        didOpen: () => {
                            Swal.showLoading();
                        }
                    });

                    // Download the update
                    await update.downloadAndInstall((event) => {
                        switch (event.event) {
                            case 'Started':
                                contentLength = event.data.contentLength || 0;
                                console.log(`Started downloading ${contentLength} bytes`);
                                break;
                            case 'Progress':
                                downloaded += event.data.chunkLength;
                                console.log(`Downloaded ${downloaded} from ${contentLength}`);
                                break;
                            case 'Finished':
                                console.log('Download finished');
                                break;
                        }
                    });

                    // Once downloaded and installed, relaunch the app
                    await relaunch();
                }
            }
        } catch (error) {
            console.error("Failed to check for updates:", error);
            // Optionally could notify user if update check failed, but usually silent is better for UX.
        }
    }

    return null; // This is a headless component
}
