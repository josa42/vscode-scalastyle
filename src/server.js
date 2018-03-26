'use strict'

const path = require('path')
const fs = require('fs')
const { spawn } = require('child_process')
const {
  IPCMessageReader, IPCMessageWriter, createConnection, TextDocuments,
  DiagnosticSeverity
} = require('vscode-languageserver')
const tempWrite = require('temp-write')

function findConfigPath (filePath) {
  const parts = filePath.split(path.sep)
  do {
    let dirPath = parts.join(path.sep) || '/'
    const fileBuildPath = path.join(dirPath, 'scalastyle-config.xml')

    try {
      fs.accessSync(fileBuildPath, fs.R_OK)
      return fileBuildPath
    } catch (_) {
      // Do nothing
    }
  } while (parts.pop())

  return null
}

const MESSAGE_EXP = [
  /^(warning|error) file=(.*) message=(.*) line=(\d+) column=(\d+)$/,
  /^(warning|error) file=(.*) message=(.*) line=(\d+)$/,
  /^(warning|error) file=(.*) message=(.*)$/
]

let connection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process))
let documents = new TextDocuments()

documents.listen(connection)
documents.onDidChangeContent((change) => {
  runScalaStyle(change.document, (_, diagnostics) => {
    connection.sendDiagnostics({ uri: change.document.uri, diagnostics })
  })
})

connection.onInitialize(() => {
  // workspaceRoot = params.rootPath;
  return {
    capabilities: {
      textDocumentSync: documents.syncKind,
      completionProvider: { resolveProvider: true }
    }
  }
})
connection.onCompletion(() => [])
connection.onDidChangeWatchedFiles(() => {
  // connection.console.log('We recevied an file change event');
})
connection.listen()

function extractSeverity (match) {
  switch (match[1]) {
    case 'warning': return DiagnosticSeverity.Warning
    case 'error': return DiagnosticSeverity.Error
  }

  return DiagnosticSeverity.Information
}

function lineLength (line, textDocument) {
  return (textDocument.getText().split('\n')[line] || '').length
}

function extractRange (match, textDocument) {
  const line = match[4] !== '' ? Number(match[4]) - 1 : 0
  const character = match[5] !== '' ? Number(match[5]) : 0

  return {
    start: { line, character },
    end: { line, character: lineLength(line, textDocument) }
  }
}

function runScalaStyle (textDocument, callback) {
  const filePath = tempWrite.sync(textDocument.getText(), 'doc.scala')
  const configPath = findConfigPath(textDocument.uri.replace(/^file:\/\//, ''))
  if (configPath === null) {
    return callback(null, [])
  }

  // connection.console.log(`scalastyle --config "${configPath}" ${filePath}`)

  let output = ''
  const { pid, stdout } = spawn('scalastyle', ['--config', configPath, filePath])
  if (pid) {
    stdout
      .on('data', (data) => (output += data))
      .on('end', () => {
        callback(null, output.split('\n').reduce((diagnostics, str) => {
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
      })
  }
}
