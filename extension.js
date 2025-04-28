/**
 * @description This is a VS Code extension that interacts with the Windows Input Method Editor (IME) to manage input method states.
 * @author Bin YIN
 * @version 0.1.2
 * 
 * @todo
 * - 支持其他输入法
 * 
 */

const process = require('process');
const vscode = require('vscode'); // The module 'vscode' contains the VS Code extensibility API
const koffi = require('koffi');   // The module 'koffi' is used to call Win32 API functions. Useful doc:https://docs.ffffee.com/electron/electron-koffi/%E4%BB%80%E4%B9%88%E6%98%AFffi%EF%BC%8C%E6%AF%94%E5%A6%82node.js%E4%B8%AD%E6%9C%89%20koffi%E3%80%81node-ffi.html

//#region Win32 API Module
// Define the types that used in Win32 API
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
const HWND = koffi.alias('HWND', HANDLE);
const LRESULT = koffi.alias('LRESULT', 'long');
const DWORD = koffi.alias('DWORD', 'uint32_t');
const UINT = koffi.alias('UINT', 'unsigned int');
const WPARAM = koffi.alias('WPARAM', 'unsigned int');
const LPARAM = koffi.alias('LPARAM', LRESULT);

// Load Win32 API DLL
const user32 = koffi.load('user32.dll');
const imm32 = koffi.load('imm32.dll');

// Bind Win32 API functions. `__stdcall` is used to specify the calling convention (Windows ABI).
const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()');
const ImmGetDefaultIMEWnd = imm32.func('HWND __stdcall ImmGetDefaultIMEWnd(HWND)');
const SendMessageW = user32.func('LRESULT __stdcall SendMessageW(HWND, UINT, WPARAM, LPARAM)');

const WM_IME_CONTROL = 0x283;
const IMC_GETOPENSTATUS = 0x005;
const IMC_SETOPENSTATUS = 0x006;
//#endregion

var lastCursorStyle = null; // 记录上一个光标样式
var lastIMEStateOnInsert = null; // 记录上一个输入法状态

const cursorStyleMap = {
	'line': vscode.TextEditorCursorStyle.Line,
	'block': vscode.TextEditorCursorStyle.Block,
	'underline': vscode.TextEditorCursorStyle.Underline,
	'line-thin': vscode.TextEditorCursorStyle.LineThin,
	'block-outline': vscode.TextEditorCursorStyle.BlockOutline,
	'underline-thin': vscode.TextEditorCursorStyle.UnderlineThin,
};

/**
 * 获取输入法的中英文状态
 * @returns {number} 输入法的中英文状态，-1 表示获取失败。
 */
function getIMEState() {
    const hWnd = GetForegroundWindow();
	if (!hWnd)
		return -1;

    const defaultIMEWnd = ImmGetDefaultIMEWnd(hWnd);
    if (!defaultIMEWnd) 
        return -1;

    const result = SendMessageW(defaultIMEWnd, WM_IME_CONTROL, IMC_GETOPENSTATUS, 0);
    return result;
}

/**
 * 设置输入法的中英文状态
 * @param {number} imeState 输入法的状态码
 * @returns {number} 1 表示成功，0 表示失败。
 */
function setIMEState(imeState) {
    const hWnd = GetForegroundWindow();
    if (!hWnd) 
        return -1; // 获取失败

    const defaultIMEWnd = ImmGetDefaultIMEWnd(hWnd);
    if (!defaultIMEWnd) 
        return -1; // 获取失败

    const result = SendMessageW(defaultIMEWnd, WM_IME_CONTROL, IMC_SETOPENSTATUS, imeState);
    return result;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
	if (process.platform !== 'win32') {
		vscode.window.showErrorMessage('vim-im-autoswitch: This extension only works on Windows.');
		return;
	}

	// The command has been defined in the package.json file
	const disposable = vscode.commands.registerCommand('vim-im-autoswitch.checkIMEState', function () {
			const imeState = getIMEState();
			vscode.window.showInformationMessage(`Current IME State: ${imeState}`);
			// console.log('ime status:', imeState);
		});

	context.subscriptions.push(disposable);

	// Logging channel
	// const outputChannel = vscode.window.createOutputChannel('vim-im-autoswitch');

	//#region Get configuration
	const ourConfig = vscode.workspace.getConfiguration('vim-im-autoswitch');
	let autoswitchEnable = ourConfig.get('enable', true);
	if (!autoswitchEnable) {
		return;
	}
	let rememberIMEStateOfInsert = ourConfig.get('rememberLastIMEState', true);
	let defaultIMEState_Insert = ourConfig.get('default IME State for Insert Mode', 1);
	let defaultIMEState_Normal = ourConfig.get('default IME State for Normal Mode', 0);

	const vimConfig = vscode.workspace.getConfiguration('vim');
	if (!vimConfig) {
		vscode.window.showErrorMessage('Vim configuration not found.');
		return;
	}

	let cursorStyleForNormal = vimConfig.get('cursorStylePerMode.normal');
	let cursorStyleForInsert = vimConfig.get('cursorStylePerMode.insert');
	if (!cursorStyleForNormal || !cursorStyleForInsert) {
		vscode.window.showErrorMessage('vim-im-autoswitch: cursorStylePerMode is not set.');
		return;
	}
	if (cursorStyleForNormal == cursorStyleForInsert) {
		vscode.window.showErrorMessage('vim-im-autoswitch: vim.cursorStylePerMode is the same for normal and insert mode, so the vim-im-autoswitch will not work.');
		return;
	}
	// console.log(`cursorStyleForNormal: ${cursorStyleForNormal}`);
	// console.log(`cursorStyleForInsert: ${cursorStyleForInsert}`);
	cursorStyleForInsert = cursorStyleMap[cursorStyleForInsert]; // 从 string 转成 vscode.cursorStyle
	cursorStyleForNormal = cursorStyleMap[cursorStyleForNormal];
	//#endregion Get configuration

	
	// 监听编辑器选项的变化（包括光标样式）
	vscode.window.onDidChangeTextEditorOptions((event) => {
		const cursorStyle = event.options.cursorStyle;
		let newState;

		// 根据光标样式推断 Vim 模式
		if (cursorStyle != lastCursorStyle) {
			switch (cursorStyle) {
				case cursorStyleForNormal: // entering Normal mode
					if (rememberIMEStateOfInsert) {
						lastIMEStateOnInsert = getIMEState();
						if (lastIMEStateOnInsert == -1) 
							lastIMEStateOnInsert = defaultIMEState_Insert; // 获取失败，使用默认值

						// outputChannel.appendLine(`Last IME state on Insert mode: ${lastIMEStateOnInsert}`);
						// console.log(`Last IME state on Insert mode: ${lastIMEStateOnInsert}`);
					}

					newState = defaultIMEState_Normal;
					setIMEState(defaultIMEState_Normal);
					// outputChannel.appendLine(`IME state set to ${newState} for Normal mode.`);
					// console.log(`IME state set to ${newState} for Normal mode.`);
					lastCursorStyle = cursorStyle;
					break;
				case cursorStyleForInsert: // entering Insert mode
					if (rememberIMEStateOfInsert) {
						newState = lastIMEStateOnInsert;
					} else {
						newState = defaultIMEState_Insert;
					}
					setIMEState(newState);
					// outputChannel.appendLine(`IME state set to ${newState} for Insert mode.`);
					// console.log(`IME state set to ${newState} for Insert mode.`);
					lastCursorStyle = cursorStyle;
					break;
				default:
					// 其他模式不处理
					break;
			}

		}
	});

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
