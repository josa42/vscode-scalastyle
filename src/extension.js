'use strict'

const path = require('path')
const vscode = require('vscode')
const { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } = require('vscode-languageclient')

function activate(context) {

  console.log("activate")

  const cwd = path.join(__dirname, '..')
  const module = path.join(__dirname, 'server.js')
  const transport = TransportKind.ipc

  const serverOptions = {
    run:   { cwd, module, transport },
    debug: { cwd, module, transport, options: { execArgv: ["--nolazy", "--debug=6009"] } }
  }
  
  const clientOptions = {
    documentSelector: ['scala'],
    synchronize: {
      configurationSection: 'scalastyle',
      fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
    }
  }
  
  const disposable = new LanguageClient('scalastyle', 'scalastyle', serverOptions, clientOptions, true).start()
  
  context.subscriptions.push(disposable)
}

function deactivate() {}

module.exports = { activate, deactivate }