import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import * as tmp from "tmp";
import * as vscode from "vscode";
import { withTimeout, workspaceFoldersPresent } from "./utils";

suite("Folder-level settings", function () {
  this.slow(1000);

  let folder1: tmp.DirResult;
  let folder2: tmp.DirResult;

  suiteSetup("Create two workspace folders", async function () {
    folder1 = tmp.dirSync({ unsafeCleanup: true });
    folder2 = tmp.dirSync({ unsafeCleanup: true });
    fs.mkdirSync(path.join(folder1.name, ".vscode"));
    fs.mkdirSync(path.join(folder2.name, ".vscode"));

    const settings1: string = path.join(
      folder1.name,
      ".vscode",
      "settings.json"
    );
    const settings2: string = path.join(
      folder2.name,
      ".vscode",
      "settings.json"
    );
    fs.writeFileSync(settings1, "{}");
    fs.writeFileSync(settings2, '{ "shellcheck.exclude": ["2034"] }');

    if (workspaceFoldersPresent()) {
      assert.strictEqual(
        vscode.workspace.updateWorkspaceFolders(
          0,
          vscode.workspace.workspaceFolders!.length
        ),
        true,
        "Unable to remove workspace folders"
      );

      await withTimeout(5000)
        .expectWorkspaceFolders()
        .notToBePresent(
          "Expected no workspace folders initially but found some"
        );
    }

    assert.strictEqual(
      vscode.workspace.updateWorkspaceFolders(
        0,
        0,
        {
          name: "folder1",
          uri: vscode.Uri.file(folder1.name),
        },
        {
          name: "folder2",
          uri: vscode.Uri.file(folder2.name),
        }
      ),
      true,
      "updateWorkspaceFolders refused request to add workspace folders"
    );

    await withTimeout(5000)
      .expectWorkspaceFolders()
      .toBePresent("Expected workspace folders to exist at end of setup");

    assert.strictEqual(
      vscode.workspace.workspaceFolders!.length,
      2,
      "Unexpected number of workspace folders found at end of setup"
    );
  });

  test("A shell script in workspace folder #1 violates SC2034", async () => {
    const script: string = path.join(folder1.name, "script1");
    fs.writeFileSync(script, "#!/bin/bash\nx=1");
    const textDocument: vscode.TextDocument =
      await vscode.workspace.openTextDocument(vscode.Uri.file(script));
    await withTimeout(5000)
      .expectDiagnosticsForUri(textDocument.uri)
      .toBePresent();

    const diagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(
      textDocument.uri
    );
    assert.strictEqual(
      diagnostics.length,
      1,
      "Unexpected number of diagnostics"
    );
    if (typeof diagnostics[0].code !== "object") {
      throw new Error("diagnostics.code should be an object");
    }
    assert.strictEqual(diagnostics[0].code?.value, "SC2034");
  });

  test("A shell script in workspace folder #2 does not violate SC2034", async () => {
    const script: string = path.join(folder2.name, "script2");
    fs.writeFileSync(script, "#!/bin/bash\nx=1\ny= 2");
    const textDocument: vscode.TextDocument =
      await vscode.workspace.openTextDocument(vscode.Uri.file(script));
    await withTimeout(5000)
      .expectDiagnosticsForUri(textDocument.uri)
      .toBePresent();

    const diagnostics: vscode.Diagnostic[] = vscode.languages.getDiagnostics(
      textDocument.uri
    );
    assert.strictEqual(
      diagnostics.length,
      1,
      "SC2034 should have been disabled in document #2"
    );
    if (typeof diagnostics[0].code !== "object") {
      throw new Error("diagnostics.code should be an object");
    }
    assert.strictEqual(diagnostics[0].code?.value, "SC1007");
  });

  suiteTeardown(
    "Delete workspace folders and all their contents",
    async function () {
      if (workspaceFoldersPresent()) {
        assert.strictEqual(
          vscode.workspace.updateWorkspaceFolders(
            0,
            vscode.workspace.workspaceFolders!.length
          ),
          true,
          "Unable to remove workspace folders"
        );

        await withTimeout(5000)
          .expectWorkspaceFolders()
          .notToBePresent(
            "Expected no more folders after teardown but found some"
          );
      }

      folder1.removeCallback();
      folder2.removeCallback();
    }
  );
});
