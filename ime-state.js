/**
 * Set the IME open state, falling back to the IMM API when the default IME
 * window does not apply the WM_IME_CONTROL message.
 *
 * @param {number} imeState
 * @param {object} api
 * @returns {number} 1 on success, 0 if setting failed, -1 if no window exists.
 */
function setIMEStateWithFallback(imeState, api) {
	const windowHandle = api.getForegroundWindow();
	if (!windowHandle) {
		return -1;
	}

	const state = Number(imeState);
	const defaultIMEWindow = api.getDefaultIMEWindow(windowHandle);
	if (defaultIMEWindow) {
		api.sendMessage(defaultIMEWindow, api.message, api.setOpenStatusCommand, state);
		if (api.getIMEState() === state) {
			return 1;
		}
	}

	if (state !== 0 && state !== 1) {
		return 0;
	}

	const inputContext = api.getInputContext(windowHandle);
	if (!inputContext) {
		return defaultIMEWindow ? 0 : -1;
	}

	let result;
	try {
		result = api.setOpenStatus(inputContext, state);
	} finally {
		api.releaseInputContext(windowHandle, inputContext);
	}

	return result && api.getIMEState() === state ? 1 : 0;
}

module.exports = { setIMEStateWithFallback };
