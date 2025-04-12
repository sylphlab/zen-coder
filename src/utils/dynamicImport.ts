/**
 * Dynamically imports a module. This is useful for importing ES Modules
 * in a CommonJS context or vice-versa, especially for dependencies
 * like node-fetch that might be distributed primarily as ESM.
 *
 * The `new Function` approach avoids static analysis issues where bundlers
 * might try to resolve the import() path statically.
 *
 * @param modulePath The path or name of the module to import.
 * @returns A promise that resolves to the imported module.
 */
export const dynamicImport = <T = any>(modulePath: string): Promise<T> => {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(`return import('${modulePath}')`)() as Promise<T>;
};

// Example Usage (kept for reference, remove if not needed):
/*
async function example() {
  try {
    const fetch = await dynamicImport<typeof import('node-fetch')>('node-fetch');
    const response = await fetch.default('https://api.github.com');
    const data = await response.json();
    console.log(data);
  } catch (error) {
    console.error('Failed to dynamically import or use node-fetch:', error);
  }
}
*/