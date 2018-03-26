'use strict';

// import './server';
import * as path from 'path';
import * as vscode from 'vscode'; 

import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: vscode.ExtensionContext) {

  let serverModule = context.asAbsolutePath(path.join('server', 'server.js'));

	let serverOptions: ServerOptions = {
		run : { module: serverModule, transport: TransportKind.ipc },
		debug: { module: serverModule, transport: TransportKind.ipc, options: { execArgv: ["--nolazy", "--debug=6009"] } }
	}
	
	let clientOptions: LanguageClientOptions = {
		documentSelector: ['scala'],
		synchronize: {
			configurationSection: 'scalastyle',
			fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
		}
	}
	
	// Create the language client and start the client.
	let disposable = new LanguageClient('scalastyle','scalastyle', serverOptions, clientOptions, true).start();
	
	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
}