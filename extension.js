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
const { setIMEStateWithFallback } = require('./ime-state');

//#region Win32 API Module
// Define the types that used in Win32 API
const HANDLE = koffi.pointer('HANDLE', koffi.opaque());
koffi.alias('HWND', HANDLE);
koffi.alias('LRESULT', 'intptr_t');
koffi.alias('UINT', 'unsigned int');
koffi.alias('WPARAM', 'uintptr_t');
koffi.alias('LPARAM', 'intptr_t');

// Load Win32 API DLL
const user32 = koffi.load('user32.dll');
const imm32 = koffi.load('imm32.dll');

// Bind Win32 API functions. `__stdcall` is used to specify the calling convention (Windows ABI).
const GetForegroundWindow = user32.func('HWND __stdcall GetForegroundWindow()');
const ImmGetDefaultIMEWnd = imm32.func('HWND __stdcall ImmGetDefaultIMEWnd(HWND)');
const SendMessageW = user32.func('LRESULT __stdcall SendMessageW(HWND, UINT, WPARAM, LPARAM)');
const ImmGetContext = imm32.func('HANDLE __stdcall ImmGetContext(HWND)');
const ImmReleaseContext = imm32.func('int __stdcall ImmReleaseContext(HWND, HANDLE)');
const ImmSetOpenStatus = imm32.func('int __stdcall ImmSetOpenStatus(HANDLE, int)');

const WM_IME_CONTROL = 0x283;
const IMC_GETOPENSTATUS = 0x005;
const IMC_SETOPENSTATUS = 0x006;
//#endregion

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
    return setIMEStateWithFallback(imeState, {
        getForegroundWindow: GetForegroundWindow,
        getDefaultIMEWindow: ImmGetDefaultIMEWnd,
        sendMessage: SendMessageW,
        getIMEState,
        getInputContext: ImmGetContext,
        setOpenStatus: ImmSetOpenStatus,
        releaseInputContext: ImmReleaseContext,
        message: WM_IME_CONTROL,
        setOpenStatusCommand: IMC_SETOPENSTATUS,
    });
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
	const autoswitchEnable = ourConfig.get('enable', true);
	if (!autoswitchEnable) {
		return;
	}
    const rememberIMEStateOfInsert = ourConfig.get('rememberLastIMEState', true);
    const defaultIMEState_Insert = ourConfig.get('default IME State for Insert Mode', 1);
    const defaultIMEState_Normal = ourConfig.get('default IME State for Normal Mode', 0);

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
	const { createModeSwitcher, createEditorFocusChecker } = require('./mode-switcher');
	const modeSwitcher = createModeSwitcher({
		normalCursorStyle: cursorStyleForNormal,
		insertCursorStyle: cursorStyleForInsert,
		rememberLastIMEState: rememberIMEStateOfInsert,
		defaultIMEStateForInsert: defaultIMEState_Insert,
		defaultIMEStateForNormal: defaultIMEState_Normal,
		getIMEState,
		setIMEState,
	});
	context.subscriptions.push(vscode.window.onDidChangeTextEditorOptions(modeSwitcher));

	const checkEditorFocus = createEditorFocusChecker({
		normalCursorStyle: cursorStyleForNormal,
		defaultIMEStateForNormal: defaultIMEState_Normal,
		getIMEState,
		setIMEState,
	});
	context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(checkEditorFocus));
	context.subscriptions.push(vscode.window.onDidChangeWindowState((state) => {
		if (state.focused) {
			checkEditorFocus(vscode.window.activeTextEditor);
		}
	}));
	checkEditorFocus(vscode.window.activeTextEditor);

}

// This method is called when your extension is deactivated
function deactivate() {}

module.exports = {
	activate,
	deactivate,
}
