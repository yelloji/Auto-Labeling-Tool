/**
 * Professional Frontend Logger
 * ===========================
 * Connects frontend logging to backend logging system.
 * Sends logs to backend API and routes to appropriate log files.
 * 
 * ONLY 3 FUNCTIONS NEEDED:
 * - logInfo: For all information logging
 * - logError: For all error logging  
 * - logUserClick: For all user click logging
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
        
        // Deduplication system
        this.recentLogs = new Map(); // Track recent logs to prevent duplicates
        this.deduplicationWindow = 2000; // 2 seconds window for deduplication
        
        // Start auto-flush
        this.startAutoFlush();
        
        // Log session start with consistent timestamp
        const sessionStartTime = new Date().toISOString();
        this.info('app.frontend.ui', 'session_start', 'Frontend session started', {
            sessionId: this.sessionId,
            userAgent: navigator.userAgent,
            url: window.location.href,
            timestamp: sessionStartTime,
            session_start_time: sessionStartTime
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
    
    // Get current timestamp consistently
    getCurrentTimestamp() {
        const now = new Date();
        return now.toISOString();
    }
    
    async sendToBackend(logData) {
        // Temporarily disabled to prevent UI blocking
        // Backend logging system needs to be properly set up
        return true;
    }
    
    createLogData(level, category, operation, message, details = null) {
        const currentTime = new Date().toISOString();
        return {
            timestamp: currentTime,
            level: level,
            category: category,
            operation: operation,
            message: message,
            logger_name: 'frontend_professional_logger',
            request_id: this.requestId || 'frontend_request',
            user_id: this.userId || 'frontend_user',
            session_id: this.sessionId,
            details: details || {},
            source: 'frontend',
            created_at: currentTime // Ensure consistent timestamp
        };
    }
    
    async log(level, category, operation, message, details = null) {
        // Create unique key for deduplication
        const logKey = `${category}:${operation}:${message}`;
        const now = Date.now();
        const currentTimestamp = this.getCurrentTimestamp();
        
        // Check if this log was recently sent
        const lastLogTime = this.recentLogs.get(logKey);
        if (lastLogTime && (now - lastLogTime) < this.deduplicationWindow) {
            // Skip duplicate log within deduplication window
            return;
        }
        
        // Update recent logs map
        this.recentLogs.set(logKey, now);
        
        // Clean up old entries from recentLogs map (older than 10 seconds)
        for (const [key, timestamp] of this.recentLogs.entries()) {
            if (now - timestamp > 10000) {
                this.recentLogs.delete(key);
            }
        }
        
        // Add current timestamp to details if not provided
        const enhancedDetails = {
            ...details,
            log_timestamp: currentTimestamp,
            log_created_at: currentTimestamp
        };
        
        const logData = this.createLogData(level, category, operation, message, enhancedDetails);
        
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
                // Send to main batch endpoint (now fixed)
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
    
    // Main logging methods - ONLY 3 NEEDED
    async info(category, operation, message, details = null) {
        await this.log('INFO', category, operation, message, details);
    }
    
    async error(category, operation, message, error = null, details = null) {
        const errorDetails = details || {};
        if (error) {
            errorDetails.error_type = error.name || 'Error';
            errorDetails.error_message = error.message || String(error);
            errorDetails.stack_trace = error.stack;
            // Ensure error message is properly stringified
            if (typeof errorDetails.error_message === 'object') {
                errorDetails.error_message = JSON.stringify(errorDetails.error_message);
            }
        }
        await this.log('ERROR', category, operation, message, errorDetails);
    }
    
    // User click logging - bypasses deduplication since user actions should always be logged
    async logUserClick(component, action, details = null) {
        const logData = this.createLogData('INFO', 'app.frontend.interactions', 'user_click', `User clicked ${action} in ${component}`, details);
        
        // Add to buffer (no deduplication for user clicks)
        this.logBuffer.push(logData);
        
        // Flush if buffer is full
        if (this.logBuffer.length >= this.maxBufferSize) {
            await this.flushBuffer();
        }
    }
}

// Global logger instance
const professionalLogger = new ProfessionalFrontendLogger();

// Export the logger and ONLY 3 ESSENTIAL FUNCTIONS
export default professionalLogger;

// ONLY 3 FUNCTIONS - NO CONFUSION
export const logInfo = (category, operation, message, details) => 
    professionalLogger.info(category, operation, message, details);

export const logError = (category, operation, message, error, details) => 
    professionalLogger.error(category, operation, message, error, details);

export const logUserClick = (component, action, details) => 
    professionalLogger.logUserClick(component, action, details);
