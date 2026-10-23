let passed = 0;

function test(name, callback) {
	callback();
	passed += 1;
	console.log(`ok ${passed} - ${name}`);
}

require('./mode-switcher.test')(test);
require('./ime-state.test')(test);
console.log(`\n${passed} tests passed`);
