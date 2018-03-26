'use strict';

const { spawn } = require('child_process')
const {
  IPCMessageReader, IPCMessageWriter, createConnection, IConnection,
  TextDocuments, TextDocument, Diagnostic, Range, DiagnosticSeverity,
  InitializeResult
} = require('vscode-languageserver')
const tempWrite = require('temp-write')

const MESSAGE_EXP = [
  /^(warning|error) file=(.*) message=(.*) line=(\d+) column=(\d+)$/,
  /^(warning|error) file=(.*) message=(.*) line=(\d+)$/,
  /^(warning|error) file=(.*) message=(.*)$/
]

let connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));
let documents = new TextDocuments();

documents.listen(connection);
documents.onDidChangeContent((change) => {
  runScalaStyle(change.document, (diagnostics) => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics });
  })
});

connection.onInitialize(() => {
  // workspaceRoot = params.rootPath;
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: { resolveProvider: true }
    }
  }
});
connection.onCompletion(() => []);
connection.onDidChangeWatchedFiles(() => {
  // connection.console.log('We recevied an file change event');
});
connection.listen();

function extractSeverity(match) {
  switch (match[1]) {
    case 'warning': return DiagnosticSeverity.Warning
    case 'error': return DiagnosticSeverity.Error
  }

  return DiagnosticSeverity.Information
}

function lineLength(line, textDocument) {
  return (textDocument.getText().split('\n')[line] || '').length
}

function extractRange(match, textDocument) {
  const line = match[4] !== '' ? Number(match[4]) - 1 : 0
  const character = match[5] !== '' ? Number(match[5]) : 0

  return {
    start: { line, character },
    end: { line, character: lineLength(line, textDocument) }
  }
}

function runScalaStyle(textDocument, callback) {
  const filePath = tempWrite.sync(textDocument.getText(), 'doc.scala');

  connection.console.log(`scalastyle --config /Users/josa/projects/api-myliga-all/ln-api-myliga/scalastyle-config.xml ${filePath}`)
    
  let output = ''
  const { pid, stdout }  = spawn('scalastyle', ['--config', '/Users/josa/projects/api-myliga-all/ln-api-myliga/scalastyle-config.xml', filePath]);
  if (pid) {
    stdout
      .on('data', (data) => output += data)
      .on('end', () => {
        callback(output.split('\n').reduce((diagnostics, str) => {
          const exp = MESSAGE_EXP.find((exp) => exp.test(str))
          if (exp) {
            const m = exp.exec(str)
            diagnostics.push({
              severity: extractSeverity(m),
              range: extractRange(m, textDocument),
              message: m[3]
            })
          }

          return diagnostics
        }, []))
    });
  }
}