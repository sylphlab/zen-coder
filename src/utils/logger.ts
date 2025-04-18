// src/utils/logger.ts

const LOG_PREFIX = "[Cline] ";

export function logDebug(...args: any[]): void {
    // Basic debug logging, could be enhanced to check a log level setting
    console.log(LOG_PREFIX, ...args);
}

export function logWarn(...args: any[]): void {
    console.warn(LOG_PREFIX, ...args);
}

export function logError(...args: any[]): void {
    console.error(LOG_PREFIX, ...args);
}

// Optional: Add more sophisticated logging later (e.g., to VS Code OutputChannel)