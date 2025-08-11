/**
 * Enhanced Logging System for SYA App Frontend
 * ============================================
 * Comprehensive logging with timestamps, operation tracking, and local storage.
 */

class SYAFrontendLogger {
    constructor() {
        this.logBuffer = [];
        this.maxBufferSize = 1000;
        this.logLevels = {
            DEBUG: 0,
            INFO: 1,
            WARN: 2,
            ERROR: 3
        };
        this.currentLogLevel = this.logLevels.INFO;
        
        // Initialize logging
        this.initializeLogging();
        
        // Auto-save logs periodically
        this.startAutoSave();
        
        // Log session start
        this.logInfo('Frontend session started', { 
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href
        });
        
        // Initialize log exporter
        this.initializeLogExporter();
    }
    
    initializeLogging() {
        // Load existing logs from localStorage
        try {
            const savedLogs = localStorage.getItem('sya_frontend_logs');
            if (savedLogs) {
                this.logBuffer = JSON.parse(savedLogs);
                // Keep only recent logs (last 500)
                if (this.logBuffer.length > 500) {
                    this.logBuffer = this.logBuffer.slice(-500);
                }
            }
        } catch (error) {
            console.error('Failed to load saved logs:', error);
            this.logBuffer = [];
        }
        
        // Override console methods to capture all logs
        this.interceptConsole();
        
        // Capture unhandled errors
        this.setupErrorHandlers();
    }
    
    interceptConsole() {
        const originalConsole = {
            log: console.log,
            info: console.info,
            warn: console.warn,
            error: console.error,
            debug: console.debug
        };
        
        console.log = (...args) => {
            this.logDebug('CONSOLE', { args: args.map(arg => this.safeStringify(arg)) });
            originalConsole.log.apply(console, args);
        };
        
        console.info = (...args) => {
            this.logInfo('CONSOLE', { args: args.map(arg => this.safeStringify(arg)) });
            originalConsole.info.apply(console, args);
        };
        
        console.warn = (...args) => {
            this.logWarning('CONSOLE', { args: args.map(arg => this.safeStringify(arg)) });
            originalConsole.warn.apply(console, args);
        };
        
        console.error = (...args) => {
            this.logError('CONSOLE', null, { args: args.map(arg => this.safeStringify(arg)) });
            originalConsole.error.apply(console, args);
        };
        
        console.debug = (...args) => {
            this.logDebug('CONSOLE', { args: args.map(arg => this.safeStringify(arg)) });
            originalConsole.debug.apply(console, args);
        };
    }
    
    setupErrorHandlers() {
        // Capture unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            this.logError('UNHANDLED_ERROR', event.error, {
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                stack: event.error?.stack
            });
        });
        
        // Capture unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError('UNHANDLED_PROMISE_REJECTION', event.reason, {
                promise: event.promise,
                reason: this.safeStringify(event.reason)
            });
        });
    }
    
    createLogEntry(level, message, context = null, error = null) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            context: context ? this.safeStringify(context) : null,
            error: error ? {
                message: error.message,
                stack: error.stack,
                name: error.name
            } : null,
            url: window.location.href,
            userAgent: navigator.userAgent.substring(0, 100) // Truncate for storage
        };
        
        return logEntry;
    }
    
    addToBuffer(logEntry) {
        this.logBuffer.push(logEntry);
        
        // Maintain buffer size
        if (this.logBuffer.length > this.maxBufferSize) {
            this.logBuffer = this.logBuffer.slice(-this.maxBufferSize);
        }
        
        // Also log to console for development
        const consoleMessage = `${logEntry.timestamp} | ${logEntry.level} | ${logEntry.message}`;
        if (logEntry.context) {
            console.log(consoleMessage, logEntry.context);
        } else {
            console.log(consoleMessage);
        }
    }
    
    logDebug(message, context = null) {
        if (this.currentLogLevel <= this.logLevels.DEBUG) {
            const logEntry = this.createLogEntry('DEBUG', message, context);
            this.addToBuffer(logEntry);
        }
    }
    
    logInfo(message, context = null) {
        if (this.currentLogLevel <= this.logLevels.INFO) {
            const logEntry = this.createLogEntry('INFO', message, context);
            this.addToBuffer(logEntry);
        }
    }
    
    logWarning(message, context = null) {
        if (this.currentLogLevel <= this.logLevels.WARN) {
            const logEntry = this.createLogEntry('WARN', message, context);
            this.addToBuffer(logEntry);
        }
    }
    
    logError(message, error = null, context = null) {
        const logEntry = this.createLogEntry('ERROR', message, context, error);
        this.addToBuffer(logEntry);
    }
    
    // Specific logging methods for different operations
    logApiRequest(method, url, params = null, body = null) {
        this.logInfo(`API REQUEST | ${method} ${url}`, {
            method,
            url,
            params: params ? this.safeStringify(params) : null,
            body: body ? this.safeStringify(body) : null
        });
    }
    
    logApiResponse(method, url, status, data = null, duration = null) {
        const level = status >= 400 ? 'ERROR' : 'INFO';
        const message = `API RESPONSE | ${method} ${url} | Status: ${status}`;
        
        const context = {
            method,
            url,
            status,
            duration: duration ? `${duration}ms` : null,
            dataSize: data ? JSON.stringify(data).length : 0
        };
        
        if (level === 'ERROR') {
            this.logError(message, null, context);
        } else {
            this.logInfo(message, context);
        }
    }
    
    logUserAction(action, component, details = null) {
        this.logInfo(`USER ACTION | ${action} | Component: ${component}`, {
            action,
            component,
            details: details ? this.safeStringify(details) : null,
            timestamp: new Date().toISOString()
        });
    }
    
    logTransformationOperation(operation, transformId = null, status = null, details = null) {
        this.logInfo(`TRANSFORMATION | ${operation}`, {
            operation,
            transformId,
            status,
            details: details ? this.safeStringify(details) : null
        });
    }
    
    logComponentLifecycle(component, lifecycle, props = null) {
        this.logDebug(`COMPONENT | ${component} | ${lifecycle}`, {
            component,
            lifecycle,
            props: props ? this.safeStringify(props) : null
        });
    }
    
    logStateChange(component, oldState, newState) {
        this.logDebug(`STATE CHANGE | ${component}`, {
            component,
            oldState: this.safeStringify(oldState),
            newState: this.safeStringify(newState)
        });
    }
    
    logNavigation(from, to) {
        this.logInfo(`NAVIGATION | ${from} → ${to}`, {
            from,
            to,
            timestamp: new Date().toISOString()
        });
    }
    
    safeStringify(obj) {
        try {
            if (obj === null || obj === undefined) {
                return String(obj);
            }
            if (typeof obj === 'string') {
                return obj.length > 500 ? obj.substring(0, 500) + '...' : obj;
            }
            if (typeof obj === 'object') {
                const stringified = JSON.stringify(obj, null, 2);
                return stringified.length > 1000 ? stringified.substring(0, 1000) + '...' : stringified;
            }
            return String(obj);
        } catch (error) {
            return `[Unstringifiable object: ${typeof obj}]`;
        }
    }
    
    startAutoSave() {
        // Save logs to localStorage every 30 seconds
        setInterval(() => {
            this.saveLogs();
        }, 30000);
        
        // Save logs when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.saveLogs();
        });
    }
    
    saveLogs() {
        try {
            localStorage.setItem('sya_frontend_logs', JSON.stringify(this.logBuffer));
        } catch (error) {
            console.error('Failed to save logs to localStorage:', error);
        }
    }
    
    exportLogs() {
        const logsData = {
            exportTime: new Date().toISOString(),
            totalLogs: this.logBuffer.length,
            logs: this.logBuffer
        };
        
        const blob = new Blob([JSON.stringify(logsData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sya_frontend_logs_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.logInfo('Logs exported', { filename: a.download, totalLogs: this.logBuffer.length });
    }
    
    clearLogs() {
        this.logBuffer = [];
        localStorage.removeItem('sya_frontend_logs');
        this.logInfo('Logs cleared');
    }
    
    getLogs(level = null, limit = null) {
        let filteredLogs = this.logBuffer;
        
        if (level) {
            filteredLogs = filteredLogs.filter(log => log.level === level.toUpperCase());
        }
        
        if (limit) {
            filteredLogs = filteredLogs.slice(-limit);
        }
        
        return filteredLogs;
    }
    
    getLogsSummary() {
        const summary = {
            total: this.logBuffer.length,
            byLevel: {},
            timeRange: {
                oldest: this.logBuffer.length > 0 ? this.logBuffer[0].timestamp : null,
                newest: this.logBuffer.length > 0 ? this.logBuffer[this.logBuffer.length - 1].timestamp : null
            }
        };
        
        // Count by level
        this.logBuffer.forEach(log => {
            summary.byLevel[log.level] = (summary.byLevel[log.level] || 0) + 1;
        });
        
        return summary;
    }
    
    setLogLevel(level) {
        if (this.logLevels.hasOwnProperty(level.toUpperCase())) {
            this.currentLogLevel = this.logLevels[level.toUpperCase()];
            this.logInfo(`Log level changed to ${level.toUpperCase()}`);
        }
    }
    
    initializeLogExporter() {
        // Export logs to backend every 30 seconds
        setInterval(() => {
            this.exportLogsToBackend();
        }, 30000);
        
        // Export logs when page is about to unload
        window.addEventListener('beforeunload', () => {
            this.exportLogsToBackend();
        });
    }
    
    async exportLogsToBackend() {
        try {
            if (this.logBuffer.length === 0) return;
            
            const response = await fetch('/api/v1/logs/frontend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    logs: this.logBuffer,
                    timestamp: new Date().toISOString(),
                    source: 'frontend'
                })
            });

            if (response.ok) {
                // Clear buffer after successful export
                this.logBuffer = [];
                localStorage.removeItem('sya_frontend_logs');
            }
        } catch (error) {
            // Don't log this error to avoid infinite loops
            console.error('Failed to export logs to backend:', error);
        }
    }
}

// Create global logger instance
const syaLogger = new SYAFrontendLogger();

// Export convenience functions
export const logDebug = (message, context) => syaLogger.logDebug(message, context);
export const logInfo = (message, context) => syaLogger.logInfo(message, context);
export const logWarning = (message, context) => syaLogger.logWarning(message, context);
export const logError = (message, error, context) => syaLogger.logError(message, error, context);

export const logApiRequest = (method, url, params, body) => syaLogger.logApiRequest(method, url, params, body);
export const logApiResponse = (method, url, status, data, duration) => syaLogger.logApiResponse(method, url, status, data, duration);

export const logUserAction = (action, component, details) => syaLogger.logUserAction(action, component, details);
export const logTransformationOperation = (operation, transformId, status, details) => syaLogger.logTransformationOperation(operation, transformId, status, details);
export const logComponentLifecycle = (component, lifecycle, props) => syaLogger.logComponentLifecycle(component, lifecycle, props);
export const logStateChange = (component, oldState, newState) => syaLogger.logStateChange(component, oldState, newState);
export const logNavigation = (from, to) => syaLogger.logNavigation(from, to);

export const exportLogs = () => syaLogger.exportLogs();
export const clearLogs = () => syaLogger.clearLogs();
export const getLogs = (level, limit) => syaLogger.getLogs(level, limit);
export const getLogsSummary = () => syaLogger.getLogsSummary();
export const setLogLevel = (level) => syaLogger.setLogLevel(level);

// Make logger available globally for debugging
window.syaLogger = syaLogger;

export default syaLogger;