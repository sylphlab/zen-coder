import { McpManager } from '../../ai/mcpManager';
import { RequestHandler } from './RequestHandler';
// Removed unused ServerMessage import

interface RetryMcpConnectionPayload {
  identifier: string; // Unique identifier for the MCP server (e.g., config path or name)
}

// Made RequestHandler generic
export class RetryMcpConnectionHandler implements RequestHandler<RetryMcpConnectionPayload, void> {
  public readonly requestType = 'retryMcpConnection'; // Added requestType
  private mcpManager: McpManager;

  constructor(mcpManager: McpManager) {
    this.mcpManager = mcpManager;
  }

  public async handle(payload: RetryMcpConnectionPayload): Promise<void> {
    if (!payload || typeof payload.identifier !== 'string') {
      throw new Error('Invalid payload: Missing or invalid identifier for MCP retry.');
    }

    try {
      console.log(`Retrying MCP connection for identifier: ${payload.identifier}`);
      // Corrected method name
      await this.mcpManager.retryMcpConnection(payload.identifier);
      // Status update will be pushed via the McpManager's subscription mechanism
    } catch (error: any) {
      console.error(`Error retrying MCP connection for ${payload.identifier}:`, error);
      // Optionally, re-throw or handle specific errors if needed
      // For now, we let the McpManager handle pushing the error status
      // Re-throwing might be useful if the frontend needs specific confirmation of failure
      // throw new Error(`Failed to retry connection for ${payload.identifier}: ${error.message}`);
    }
  }
}
