const assert = require('assert').strict;
const { createModeSwitcher, createEditorFocusChecker } = require('../mode-switcher');

function createHarness(overrides = {}) {
	const calls = [];
	let currentIMEState = 1;
	const onChange = createModeSwitcher({
		normalCursorStyle: 2,
		insertCursorStyle: 1,
		rememberLastIMEState: true,
		defaultIMEStateForInsert: 1,
		defaultIMEStateForNormal: 0,
		getIMEState: () => currentIMEState,
		setIMEState: (state) => {
			calls.push(state);
			currentIMEState = state;
			return 1;
		},
		...overrides,
	});
	return { onChange, calls };
}

	module.exports = (test) => {
	test('switches to the configured Normal state and restores the prior Insert state', () => {
	const { onChange, calls } = createHarness();
	onChange({ options: { cursorStyle: 2 } });
	onChange({ options: { cursorStyle: 1 } });

	assert.deepEqual(calls, [0, 1]);
});

	test('uses the Insert default when the first observed transition is into Insert mode', () => {
	const { onChange, calls } = createHarness();
	onChange({ options: { cursorStyle: 1 } });

	assert.deepEqual(calls, [1]);
});

	test('uses the Insert default when reading the previous state fails', () => {
	const { onChange, calls } = createHarness({ getIMEState: () => -1 });
	onChange({ options: { cursorStyle: 2 } });
	onChange({ options: { cursorStyle: 1 } });

	assert.deepEqual(calls, [0, 1]);
});

	test('ignores unrelated and duplicate cursor styles', () => {
	const { onChange, calls } = createHarness();
	onChange({ options: { cursorStyle: 3 } });
	onChange({ options: { cursorStyle: 2 } });
	onChange({ options: { cursorStyle: 2 } });

	assert.deepEqual(calls, [0]);
});

	test('uses the current editor options when the event options omit cursorStyle', () => {
	const { onChange, calls } = createHarness();
	onChange({ options: {}, textEditor: { options: { cursorStyle: 2 } } });

	assert.deepEqual(calls, [0]);
	});

	test('corrects the IME state to the configured Normal state when an editor gains focus', () => {
	let currentIMEState = 1;
	const calls = [];
	const checkEditorFocus = createEditorFocusChecker({
		normalCursorStyle: 2,
		defaultIMEStateForNormal: 0,
		getIMEState: () => currentIMEState,
		setIMEState: (state) => {
			calls.push(state);
			currentIMEState = state;
			return 1;
		},
	});

	checkEditorFocus({ options: { cursorStyle: 2 } });

	assert.deepEqual(calls, [0]);
	assert.equal(currentIMEState, 0);
	});

	test('does not rewrite the IME state when it already matches Normal mode', () => {
	const { calls } = createHarness({ getIMEState: () => 0 });
	const checkEditorFocus = createEditorFocusChecker({
		normalCursorStyle: 2,
		defaultIMEStateForNormal: 0,
		getIMEState: () => 0,
		setIMEState: (state) => calls.push(state),
	});

	checkEditorFocus({ options: { cursorStyle: 2 } });

	assert.deepEqual(calls, []);
	});

	test('does not alter the IME state when the focused editor is in Insert mode', () => {
	const { calls } = createHarness();
	const checkEditorFocus = createEditorFocusChecker({
		normalCursorStyle: 2,
		defaultIMEStateForNormal: 0,
		getIMEState: () => 1,
		setIMEState: (state) => calls.push(state),
	});

	checkEditorFocus({ options: { cursorStyle: 1 } });

	assert.deepEqual(calls, []);
	});
};
