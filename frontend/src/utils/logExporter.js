/**
 * Frontend Log Exporter
 * Exports frontend logs to root logs directory via backend API
 */

import { logInfo, logError } from './logger';

class LogExporter {
    constructor() {
        this.exportInterval = 30000; // Export every 30 seconds
        this.isExporting = false;
        this.startAutoExport();
    }

    async exportLogsToBackend(logs) {
        try {
            const response = await fetch('/api/v1/logs/frontend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logs: logs,
                    timestamp: new Date().toISOString(),
                    source: 'frontend'
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            return true;
        } catch (error) {
            console.error('Failed to export logs to backend:', error);
            return false;
        }
    }

    async exportCurrentLogs() {
        if (this.isExporting) return;
        
        this.isExporting = true;
        
        try {
            // Get logs from localStorage
            const savedLogs = localStorage.getItem('sya_frontend_logs');
            if (!savedLogs) {
                return;
            }

            const logs = JSON.parse(savedLogs);
            if (logs.length === 0) {
                return;
            }

            // Export to backend
            const success = await this.exportLogsToBackend(logs);
            
            if (success) {
                logInfo('Frontend logs exported to backend', { 
                    logCount: logs.length,
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            logError('Failed to export frontend logs', error);
        } finally {
            this.isExporting = false;
        }
    }

    startAutoExport() {
        // Export logs periodically
        setInterval(() => {
            this.exportCurrentLogs();
        }, this.exportInterval);

        // Export logs when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.exportCurrentLogs();
        });

        // Export logs when page becomes hidden (mobile/tab switching)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.exportCurrentLogs();
            }
        });
    }
}

// Create global exporter instance
const logExporter = new LogExporter();

export default logExporter;