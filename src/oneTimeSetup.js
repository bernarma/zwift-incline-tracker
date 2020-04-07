let fs = require('fs'),
	os = require('os'),
	readline = require('readline'),
	settings = require('./settings');

/*
 Public API.
 */
exports.setup = setup;

/*
 State.
 */
let readlineInterface;

/*
 Implementation.
 */
async function setup(ready) {
	console.log('Welcome to Zwifit Incline Tracker!');
	if (!fs.existsSync('./node_modules')) {
		console.log('Please run `npm install` before trying to run this.');
		process.exit(1);
	}
	if (settings.load()) {
		ready();
	}
	else {
		await readSettings();
	}

	async function readSettings() {
		readlineInterface = readline.createInterface({
			input: process.stdin,
			output: process.stdout
		});

		settings.minIncline = isFloat(await question('What is the Minimum Incline of your treadmill?'));
		settings.maxIncline = isFloat(await question('What is the Maximum Incline of your treadmill?'));

		readlineInterface.close();
		settings.save();
		ready();
	}
}

function question(q) {
	return new Promise(resolve => readlineInterface.question(q + ' ', resolve));
}

function isFloat(val) {
	if (val) {
        val = parseFloat(val);
        if (isNaN(val))
            return 0.0;
        else
            return val;
    }
    return 0.0;
}