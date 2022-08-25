import * as vscode from "vscode";

export interface IterableAssertion {
  toBePresent: (failMessage?: string) => Promise<any>;
  notToBePresent: (failMessage?: string) => Promise<any>;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function withTimeout(ms: number, intervalMs: number = 1000) {
  async function expect(
    condition: () => boolean,
    extraTrigger: (callback: () => void) => void = () => {},
    failMessage: string = "Timeout waiting for event"
  ): Promise<any> {
    const context: { periodicTimer?: NodeJS.Timeout } = {};

    return new Promise((resolve, reject) => {
      function check() {
        if (condition()) {
          resolve(null);
        }
      }
      sleep(ms).then(() => reject(new Error(failMessage)));
      extraTrigger(check);
      context.periodicTimer = setInterval(check, intervalMs);
    }).finally(() => clearInterval(context.periodicTimer));
  }

  function expectDiagnosticsForUri(uri: vscode.Uri): IterableAssertion {
    return {
      toBePresent: (failMessage) =>
        expect(
          () => vscode.languages.getDiagnostics(uri).length > 0,
          vscode.languages.onDidChangeDiagnostics,
          failMessage || `Expected diagnostics for ${uri} but found none`
        ),
      notToBePresent: (failMessage) =>
        expect(
          () => vscode.languages.getDiagnostics(uri).length === 0,
          vscode.languages.onDidChangeDiagnostics,
          failMessage || `Expected no diagnostics for ${uri} but found some`
        ),
    };
  }

  function expectWorkspaceFolders(): IterableAssertion {
    return {
      toBePresent: (failMessage) =>
        expect(
          () => workspaceFoldersPresent(),
          vscode.workspace.onDidChangeWorkspaceFolders,
          failMessage || "Expected workspace folders to exist but found none"
        ),
      notToBePresent: (failMessage) =>
        expect(
          () => !workspaceFoldersPresent(),
          vscode.workspace.onDidChangeWorkspaceFolders,
          failMessage || "Expected no workspace folders to exist but found some"
        ),
    };
  }

  return {
    expect,
    expectDiagnosticsForUri,
    expectWorkspaceFolders,
  };
}

export function workspaceFoldersPresent(): boolean {
  return !!(
    vscode.workspace.workspaceFolders &&
    vscode.workspace.workspaceFolders.length > 0
  );
}
