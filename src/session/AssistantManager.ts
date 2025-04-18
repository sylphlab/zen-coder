import * as vscode from 'vscode';
import { v4 as uuidv4 } from 'uuid';
import { Assistant, ModelConfig, NewAssistant, UpdateAssistantPayload } from '../common/types'; // Added ModelConfig
import { logDebug, logError, logWarn } from '../utils/logger'; // Revert to standard relative path
import { DefaultChatConfig } from '../common/types'; // Import DefaultChatConfig for settings update

const ASSISTANTS_FILE = 'assistants.json';
const ASSISTANTS_BAK_FILE = 'assistants.json.bak'; // For safer saving

export class AssistantManager {
    private assistants: Map<string, Assistant> = new Map();
    private storageUri: vscode.Uri | undefined;
    private initializationPromise: Promise<void> | null = null; // Promise for initialization
    private saveTimeout: NodeJS.Timeout | null = null;

    constructor(private context: vscode.ExtensionContext) {
        this.initializationPromise = this.initializeStorage();
    }

    private async initializeStorage(): Promise<void> {
        this.storageUri = this.context.storageUri;
        if (!this.storageUri) {
            const errorMsg = 'AssistantManager: Extension storage URI not available. Assistant functionality disabled.';
            logError(errorMsg);
            // Consider notifying the user or disabling UI elements?
            throw new Error(errorMsg); // Throw to indicate critical failure
        }

        try {
            await vscode.workspace.fs.createDirectory(this.storageUri);
            logDebug(`AssistantManager: Storage directory ensured at ${this.storageUri.fsPath}`);
            await this.loadAssistants(); // Load existing assistants
            await this.ensureDefaultAssistantExists(); // Add check for default assistant
        } catch (error: any) {
            logError('AssistantManager: Failed to initialize storage or load/create assistants.', error);
            // Allow initialization to "complete" but in a potentially empty state
            // The error is logged, subsequent operations might fail if load failed badly
        }
    }

    private getFilePath(backup: boolean = false): vscode.Uri | undefined {
        if (!this.storageUri) { return undefined; } // Add curly braces
        const filename = backup ? ASSISTANTS_BAK_FILE : ASSISTANTS_FILE;
        return vscode.Uri.joinPath(this.storageUri, filename);
    }

    private async loadAssistants(): Promise<void> {
        const filePath = this.getFilePath();
        if (!filePath) {
             logWarn('AssistantManager: Cannot load assistants, file path unavailable.');
             return; // Cannot load if path is missing
        }

        let fileContent: Uint8Array | undefined;
        try {
            fileContent = await vscode.workspace.fs.readFile(filePath);
        } catch (error: any) {
            if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
                logDebug(`AssistantManager: ${ASSISTANTS_FILE} not found. Attempting to load backup.`);
                // Try loading backup
                const backupFilePath = this.getFilePath(true);
                if (backupFilePath) {
                    try {
                        fileContent = await vscode.workspace.fs.readFile(backupFilePath);
                        logWarn(`AssistantManager: Loaded from backup file ${ASSISTANTS_BAK_FILE}. Original file might have been corrupted or missing.`);
                        // Optionally, try to restore the main file from backup here?
                        // await vscode.workspace.fs.copy(backupFilePath, filePath, { overwrite: true });
                    } catch (backupError: any) {
                         if (backupError instanceof vscode.FileSystemError && backupError.code === 'FileNotFound') {
                            logDebug(`AssistantManager: No primary or backup assistant file found. Starting fresh.`);
                            this.assistants.clear();
                            return; // Start fresh
                         } else {
                             logError(`AssistantManager: Failed to read backup file ${ASSISTANTS_BAK_FILE}. Starting fresh.`, backupError);
                             this.assistants.clear();
                             return; // Start fresh on backup read error
                         }
                    }
                } else {
                     logDebug(`AssistantManager: No primary assistant file found and backup path unavailable. Starting fresh.`);
                     this.assistants.clear();
                     return; // Start fresh
                }

            } else {
                logError(`AssistantManager: Failed to read ${ASSISTANTS_FILE}. Starting fresh.`, error);
                this.assistants.clear(); // Start fresh on unexpected read error
                return;
            }
        }

        // If we have content (from primary or backup)
        if (fileContent) {
            try {
                const assistantsArray = JSON.parse(Buffer.from(fileContent).toString('utf-8')) as Assistant[];
                // Basic validation: check if it's an array
                if (!Array.isArray(assistantsArray)) {
                    throw new Error('Parsed content is not an array');
                }
                this.assistants.clear();
                assistantsArray.forEach(assistant => {
                    // TODO: Add more robust validation per assistant object (e.g., using Zod) here?
                    if (assistant && typeof assistant.id === 'string') {
                         this.assistants.set(assistant.id, assistant);
                    } else {
                        logWarn('AssistantManager: Skipping invalid assistant object during load:', assistant);
                    }
                });
                logDebug(`AssistantManager: Loaded ${this.assistants.size} assistants.`);
            } catch (parseError) {
                logError(`AssistantManager: Failed to parse assistants file content. Starting fresh.`, parseError);
                this.assistants.clear(); // Start fresh if parsing fails
            }
        } else {
             // This case should ideally be handled by the file reading logic above
             logWarn(`AssistantManager: File content was unexpectedly undefined after read attempts. Starting fresh.`);
             this.assistants.clear();
        }
    }

    // Ensure a default assistant exists if none were loaded
    private async ensureDefaultAssistantExists(): Promise<void> {
        if (this.assistants.size === 0) {
            logDebug('AssistantManager: No assistants found, creating default assistant.');
            const defaultId = uuidv4(); // Generate ID for the default
            const now = new Date().toISOString();
            const defaultAssistant: Assistant = {
                id: defaultId,
                name: 'Default Assistant',
                description: 'The default assistant configuration.',
                instructions: 'You are a helpful assistant.', // Simple default instructions
                modelConfig: { // Use a concrete default model (e.g., Claude 3 Haiku)
                    providerId: 'anthropic',
                    modelId: 'claude-3-haiku', // Or another sensible default like a Gemini Flash variant if preferred
                },
                createdAt: now,
                updatedAt: now,
            };

            this.assistants.set(defaultId, defaultAssistant);
            const saved = await this.saveAssistants(); // Save the newly created default

            if (saved) {
                logDebug(`AssistantManager: Default assistant created with ID ${defaultId}.`);
                // TODO: Update the global 'zencoder.defaults.defaultAssistantId' setting
                // This likely needs to happen outside this class, maybe via an event or callback
                // Example: this.context.globalState.update('defaultAssistantId', defaultId);
                // Or: vscode.workspace.getConfiguration('zencoder.defaults').update('defaultAssistantId', defaultId, vscode.ConfigurationTarget.Global);
            } else {
                 logError('AssistantManager: Failed to save the newly created default assistant.');
                 // Remove from map if save failed?
                 this.assistants.delete(defaultId);
            }
        }
    }

    // Safer save: Write to temp/backup, then rename/overwrite main file
    private async saveAssistants(): Promise<boolean> {
        await this.ensureInitialized(); // Ensure init is done before saving
        const filePath = this.getFilePath();
        const backupFilePath = this.getFilePath(true);
        if (!filePath || !backupFilePath) {
            logError('AssistantManager: Cannot save assistants, file path unavailable.');
            return false;
        }

        // Removed debounce logic for immediate saving
        try {
            const assistantsArray = Array.from(this.assistants.values());
            const fileContent = Buffer.from(JSON.stringify(assistantsArray, null, 2), 'utf-8');

            // 1. Write to backup file first
            await vscode.workspace.fs.writeFile(backupFilePath, fileContent);

            // 2. Overwrite main file
            await vscode.workspace.fs.writeFile(filePath, fileContent);

            logDebug(`AssistantManager: Saved ${assistantsArray.length} assistants to ${filePath.fsPath} (and backup).`);
            return true; // Indicate success
        } catch (error) {
            logError(`AssistantManager: Failed to write assistants file.`, error);
            return false; // Indicate save failure
        }
    }

    // Helper to ensure initialization is complete before proceeding
    private async ensureInitialized(): Promise<void> {
        if (!this.initializationPromise) {
             // This case should not happen if constructor logic is sound
             logError("AssistantManager: Initialization promise is missing!");
             this.initializationPromise = this.initializeStorage(); // Attempt re-initialization
        }
        try {
            await this.initializationPromise;
        } catch (error) {
             logError("AssistantManager: Initialization failed previously. Operations may fail.", error);
             // Allow to proceed, but operations might fail if storageUri is missing etc.
        }
    }

    // --- Public API ---

    async getAllAssistants(): Promise<Assistant[]> {
        await this.ensureInitialized();
        return Array.from(this.assistants.values()).sort((a, b) => a.name.localeCompare(b.name)); // Sort by name
    }

    async getAssistantById(id: string): Promise<Assistant | undefined> {
        await this.ensureInitialized();
        return this.assistants.get(id);
    }

    async createAssistant(payload: NewAssistant): Promise<Assistant | null> {
        // Note: Input validation (Zod) should happen in the API handler before calling this
        await this.ensureInitialized();
        const newId = uuidv4();
        const now = new Date().toISOString();
        const newAssistant: Assistant = {
            ...payload,
            id: newId,
            createdAt: now,
            updatedAt: now,
        };
        this.assistants.set(newId, newAssistant);
        const saved = await this.saveAssistants();
        return saved ? newAssistant : null; // Return null if save failed
    }

    async updateAssistant(payload: UpdateAssistantPayload): Promise<Assistant | null> {
         // Note: Input validation (Zod) should happen in the API handler before calling this
        await this.ensureInitialized();
        const existingAssistant = this.assistants.get(payload.id);
        if (!existingAssistant) {
            logError(`AssistantManager: Assistant with ID ${payload.id} not found for update.`);
            return null; // Indicate not found
        }
        const updatedAssistant: Assistant = {
            ...existingAssistant,
            ...payload, // Apply partial updates
            updatedAt: new Date().toISOString(),
        };
        this.assistants.set(payload.id, updatedAssistant);
        const saved = await this.saveAssistants();
        return saved ? updatedAssistant : null; // Return null if save failed
    }

    async deleteAssistant(id: string): Promise<boolean> {
        await this.ensureInitialized();
        const exists = this.assistants.has(id);
        if (!exists) {
             logWarn(`AssistantManager: Assistant with ID ${id} not found for deletion.`);
             return false; // Indicate not found
        }
        this.assistants.delete(id);
        const saved = await this.saveAssistants();
        return saved; // Return save status
    }
}