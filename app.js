#!/usr/bin/env node
let oneTime = require('./src/oneTimeSetup');

oneTime.setup(() => {

	let tracker = require('./src/tracker');

	/*
	 Initialization.
	 */
	tracker.start();
});
