import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Generates the HTML content for the webview panel.
 * Handles loading from Vite dev server in development or build output in production.
 * Injects CSP nonce and adjusts asset paths.
 */
export function getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri, extensionMode: vscode.ExtensionMode): string {
    const nonce = getNonce();
    const isDevelopment = extensionMode === vscode.ExtensionMode.Development;
    let viteDevServerPort = 5173; // Default port
    const portFilePath = path.join(extensionUri.fsPath, '.vite.port'); // Path relative to extension root

    try {
        if (fs.existsSync(portFilePath)) {
            const portFileContent = fs.readFileSync(portFilePath, 'utf8');
            const parsedPort = parseInt(portFileContent.trim(), 10);
            if (!isNaN(parsedPort) && parsedPort > 0) {
                viteDevServerPort = parsedPort;
                console.log(`Read Vite dev server port ${viteDevServerPort} from ${portFilePath}`);
            } else {
                console.warn(`Invalid port number found in ${portFilePath}: ${portFileContent}. Using default ${viteDevServerPort}.`);
            }
        } else {
            console.log(`.vite.port file not found at ${portFilePath}. Using default port ${viteDevServerPort}.`);
        }
    } catch (error: any) {
        console.error(`Error reading port file ${portFilePath}: ${error.message}. Using default port ${viteDevServerPort}.`);
    }

    const viteDevServerUrl = `http://localhost:${viteDevServerPort}`;
    const buildDir = 'webview'; // Build output directory for webview UI
    const title = 'Zen Coder'; // Simple title
    const mainTsxPath = '/src/main.tsx'; // Entry point for webview UI

    console.log(`Getting webview content. Development mode: ${isDevelopment}`);

    if (isDevelopment) {
        // Development mode: Load from the Vite dev server for HMR
        console.log(`Loading webview from Vite dev server: ${viteDevServerUrl}`);
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        style-src 'unsafe-inline' ${webview.cspSource} ${viteDevServerUrl};
        script-src 'unsafe-eval' 'nonce-${nonce}' ${viteDevServerUrl};
        connect-src ${viteDevServerUrl} ws://${viteDevServerUrl.split('//')[1]};
        img-src ${webview.cspSource} data: ${viteDevServerUrl};
        font-src ${webview.cspSource} ${viteDevServerUrl};
    ">
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}/@vite/client"></script>
    <script type="module" nonce="${nonce}" src="${viteDevServerUrl}${mainTsxPath}"></script>
</head>
<body>
    <div id="root"></div>
</body>
</html>`;

    } else {
        // Production mode: Load from the build output directory
        console.log(`Loading webview from dist/${buildDir}`);
        const buildPath = vscode.Uri.joinPath(extensionUri, 'dist', buildDir);
        const htmlPath = vscode.Uri.joinPath(buildPath, 'index.html');

        try {
            let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

            // Replace asset paths with webview URIs
            htmlContent = htmlContent.replace(/(href|src)="(\/[^"]+)"/g, (match, attr, path) => {
                const assetUriOnDisk = vscode.Uri.joinPath(buildPath, path);
                const assetWebviewUri = webview.asWebviewUri(assetUriOnDisk);
                return `${attr}="${assetWebviewUri}"`;
            });

            // Inject nonce into the main script tag
            htmlContent = htmlContent.replace(
                /(<script type="module" crossorigin src="[^"]+")>/,
                `$1 nonce="${nonce}">`
            );

            // Inject CSP meta tag
            htmlContent = htmlContent.replace(
                '</head>',
                `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; connect-src 'self'; img-src ${webview.cspSource} data:; font-src ${webview.cspSource};">
                  </head>`
            );

            return htmlContent;
        } catch (e: any) {
            console.error(`Error reading or processing production webview HTML from ${htmlPath.fsPath}: ${e}`);
            return `<html><body>Error loading webview content. Failed to read or process build output. Check console and ensure 'pnpm run build:webview' has run successfully. Path: ${htmlPath.fsPath} Error: ${e.message}</body></html>`;
        }
    }
}

/**
 * Generates a random nonce string for Content Security Policy.
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}