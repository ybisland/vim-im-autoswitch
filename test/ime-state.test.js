const assert = require('assert').strict;
const { setIMEStateWithFallback } = require('../ime-state');

function createApi(overrides = {}) {
	const calls = [];
	let currentState = 1;
	return {
		calls,
		setCurrentState: (state) => { currentState = state; },
		api: {
			getForegroundWindow: () => 'foreground-window',
			getDefaultIMEWindow: () => 'ime-window',
			sendMessage: (...args) => {
				calls.push(['sendMessage', ...args]);
				if (overrides.messageApplies) currentState = args[3];
			},
			getIMEState: () => currentState,
			getInputContext: () => 'ime-context',
			setOpenStatus: (_context, state) => {
				calls.push(['setOpenStatus', state]);
				currentState = state;
				return 1;
			},
			releaseInputContext: (...args) => calls.push(['releaseInputContext', ...args]),
			message: 0x283,
			setOpenStatusCommand: 0x006,
			...overrides.api,
		},
	};
}

	module.exports = (test) => {
	test('returns success when the default IME window applies the requested state', () => {
		const { api, calls } = createApi({ messageApplies: true });

		assert.equal(setIMEStateWithFallback(0, api), 1);
		assert.equal(calls.some(([name]) => name === 'setOpenStatus'), false);
	});

	test('preserves non-boolean state codes for the existing message path', () => {
		const { api, calls } = createApi({ messageApplies: true });
		api.sendMessage = (...args) => {
			calls.push(['sendMessage', ...args]);
			api.getIMEState = () => args[3];
		};

		assert.equal(setIMEStateWithFallback(2, api), 1);
		assert.equal(calls[0][4], 2);
	});

	test('uses ImmSetOpenStatus when the default IME window does not change state', () => {
		const { api, calls } = createApi();

		assert.equal(setIMEStateWithFallback(0, api), 1);
		assert.deepEqual(calls.slice(-2), [
			['setOpenStatus', 0],
			['releaseInputContext', 'foreground-window', 'ime-context'],
		]);
	});

	test('returns failure when no input context is available and the message did not work', () => {
		const { api } = createApi({ api: { getInputContext: () => null } });

		assert.equal(setIMEStateWithFallback(0, api), 0);
	});

	test('returns unavailable when there is no foreground window', () => {
		const { api } = createApi({ api: { getForegroundWindow: () => null } });

		assert.equal(setIMEStateWithFallback(0, api), -1);
	});
};
