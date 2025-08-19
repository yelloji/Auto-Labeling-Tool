/**
 * Professional Frontend Logger
 * ===========================
 * Connects frontend logging to backend logging system.
 * Sends logs to backend API and routes to appropriate log files.
 */

class ProfessionalFrontendLogger {
    constructor() {
        this.apiBaseUrl = 'http://localhost:12000'; // Backend API URL
        this.sessionId = this.generateSessionId();
        this.userId = null;
        this.requestId = null;
        this.logBuffer = [];
        this.maxBufferSize = 50;
        this.flushInterval = 5000; // 5 seconds
        
        // Start auto-flush
        this.startAutoFlush();
        
        // Log session start
        this.info('app.frontend', 'session_start', 'Frontend session started', {
            sessionId: this.sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: new Date().toISOString()
        });
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    setUserId(userId) {
        this.userId = userId;
    }
    
    setRequestId(requestId) {
        this.requestId = requestId;
    }
    
    async sendToBackend(logData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/logs/frontend`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(logData)
            });
            
            if (!response.ok) {
                console.error('Failed to send log to backend:', response.status, response.statusText);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('Error sending log to backend:', error);
            return false;
        }
    }
    
    createLogData(level, category, operation, message, details = null) {
        return {
            timestamp: new Date().toISOString(),
            level: level,
            category: category,
            operation: operation,
            message: message,
            logger_name: 'frontend_professional_logger',
            request_id: this.requestId,
            user_id: this.userId,
            session_id: this.sessionId,
            details: details || {},
            source: 'frontend'
        };
    }
    
    async log(level, category, operation, message, details = null) {
        const logData = this.createLogData(level, category, operation, message, details);
        
        // Add to buffer
        this.logBuffer.push(logData);
        
        // Flush if buffer is full
        if (this.logBuffer.length >= this.maxBufferSize) {
            await this.flushBuffer();
        }
        
        // Also send immediately for important logs
        if (level === 'ERROR' || level === 'WARNING') {
            await this.sendToBackend(logData);
        }
    }
    
    async flushBuffer() {
        if (this.logBuffer.length === 0) return;
        
        try {
            const response = await fetch(`${this.apiBaseUrl}/api/v1/logs/frontend/batch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(this.logBuffer)
            });
            
            if (response.ok) {
                this.logBuffer = [];
            } else {
                console.error('Failed to flush log buffer:', response.status);
            }
        } catch (error) {
            console.error('Error flushing log buffer:', error);
        }
    }
    
    startAutoFlush() {
        setInterval(() => {
            this.flushBuffer();
        }, this.flushInterval);
        
        // Flush on page unload
        window.addEventListener('beforeunload', () => {
            this.flushBuffer();
        });
        
        // Flush when page becomes hidden
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.flushBuffer();
            }
        });
    }
    
    // Main logging methods
    async info(category, operation, message, details = null) {
        await this.log('INFO', category, operation, message, details);
    }
    
    async warning(category, operation, message, details = null) {
        await this.log('WARNING', category, operation, message, details);
    }
    
    async error(category, operation, message, error = null, details = null) {
        const errorDetails = details || {};
        if (error) {
            errorDetails.error_type = error.name || 'Error';
            errorDetails.error_message = error.message || String(error);
            errorDetails.stack_trace = error.stack;
        }
        await this.log('ERROR', category, operation, message, errorDetails);
    }
    
    async debug(category, operation, message, details = null) {
        await this.log('DEBUG', category, operation, message, details);
    }
    
    // Frontend-specific convenience methods
    async logUserInteraction(component, action, details = null) {
        await this.info('app.frontend', 'user_interaction', `User ${action} in ${component}`, details);
    }
    
    async logPageNavigation(fromPage, toPage, details = null) {
        await this.info('app.frontend', 'page_navigation', `Navigation from ${fromPage} to ${toPage}`, details);
    }
    
    async logApiCall(endpoint, method, status, responseTime = null) {
        const level = status < 400 ? 'INFO' : 'ERROR';
        const details = responseTime ? { response_time_ms: responseTime } : null;
        await this.log(level, 'app.api', 'api_call', `${method} ${endpoint} - ${status}`, details);
    }
    
    async logComponentLifecycle(component, lifecycleEvent, details = null) {
        await this.info('app.frontend', 'component_lifecycle', `${component} ${lifecycleEvent}`, details);
    }
    
    async logFormValidation(formName, validationResult, details = null) {
        const level = validationResult === 'valid' ? 'INFO' : 'WARNING';
        await this.log(level, 'app.frontend', 'form_validation', `${formName} validation: ${validationResult}`, details);
    }
    
    async logFileOperation(operation, fileName, details = null) {
        await this.info('operations.images', 'file_operation', `${operation} ${fileName}`, details);
    }
    
    async logUiEvent(eventType, component, details = null) {
        await this.info('app.frontend', 'ui_event', `${eventType} on ${component}`, details);
    }
    
    // Convenience methods for common actions
    async logUserClick(component, action, details = null) {
        await this.logUserInteraction(component, `clicked ${action}`, details);
    }
    
    async logFormSubmit(formName, success, details = null) {
        const result = success ? 'successful' : 'failed';
        await this.logUserInteraction(formName, `submitted ${result}`, details);
    }
    
    async logPageView(pageName, details = null) {
        await this.logPageNavigation('', pageName, details);
    }
    
    async logApiRequest(endpoint, method, status, responseTime = null) {
        await this.logApiCall(endpoint, method, status, responseTime);
    }
}

// Global logger instance
const professionalLogger = new ProfessionalFrontendLogger();

// Export the logger and convenience functions
export default professionalLogger;

// Convenience functions for easy logging
export const logInfo = (category, operation, message, details) => 
    professionalLogger.info(category, operation, message, details);

export const logWarning = (category, operation, message, details) => 
    professionalLogger.warning(category, operation, message, details);

export const logError = (category, operation, message, error, details) => 
    professionalLogger.error(category, operation, message, error, details);

export const logDebug = (category, operation, message, details) => 
    professionalLogger.debug(category, operation, message, details);

// Frontend-specific convenience functions
export const logUserClick = (component, action, details) => 
    professionalLogger.logUserClick(component, action, details);

export const logFormSubmit = (formName, success, details) => 
    professionalLogger.logFormSubmit(formName, success, details);

export const logPageView = (pageName, details) => 
    professionalLogger.logPageView(pageName, details);

export const logApiRequest = (endpoint, method, status, responseTime) => 
    professionalLogger.logApiRequest(endpoint, method, status, responseTime);

export const logComponentMount = (component, details) => 
    professionalLogger.logComponentLifecycle(component, 'mounted', details);

export const logComponentUnmount = (component, details) => 
    professionalLogger.logComponentLifecycle(component, 'unmounted', details);

export const logFormValidation = (formName, validationResult, details) => 
    professionalLogger.logFormValidation(formName, validationResult, details);

export const logFileUpload = (fileName, details) => 
    professionalLogger.logFileOperation('upload', fileName, details);

export const logFileDownload = (fileName, details) => 
    professionalLogger.logFileOperation('download', fileName, details);
