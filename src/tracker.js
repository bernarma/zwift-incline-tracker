const Netmask = require('netmask').Netmask;
const socketio = require('socket.io-client');
const ZwiftPacketMonitor = require('@zwfthcks/zwift-packet-monitor');
const internalIp = require('internal-ip');
const net = require('net');
const settings = require('./settings');
const Socket = net.Socket;

let debug = false;
let prevDistance = 0;
let prevAltitude = 0;
let prevSlope = 0;
let numberOfRuns = 0;

function simpleMovingAverager(period) {
    var nums = [];
    return function(num) {
        nums.push(num);
        if (nums.length > period)
            nums.splice(0,1);  // remove the first element of the array
        var sum = 0;
        for (var i in nums)
            sum += nums[i];
        var n = period;
        if (nums.length < period)
            n = nums.length;
        return(sum/n);
    }
}

const sma = simpleMovingAverager(3);

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

function roundToPrecision(x, precision) {
    var y = +x + (precision === undefined ? 0.5 : precision/2);
    return y - (y % (precision === undefined ? 1 : +precision));
}

Array.prototype.asyncFilter = async function(f) {
	const array = this;
	const booleans = await Promise.all(array.map(f));
	return array.filter((x, i) => booleans[i]);
}

async function run() {
    console.log('Scanning your network for Zwifit...');

	const ips = [];
	const myIP = internalIp.v4.sync();
	const block = new Netmask(myIP + '/24');
	block.forEach((ip) => ips.push(ip));

	const tests = await Promise.all(ips
			.map(ip => testPortConnectable(ip, 1337)));
	const clients = tests
			.filter(test => test.result)
			.map(test => socketio(`http://${test.ip}:1337`));

	if (!clients || (clients.length === 0)) {
		console.log('Did not found Zwifit on any IP address of your local network running at port 1337 :-(');
		process.exit(1);
	} else {
		console.log('Found Zwifit at ', clients.map(client => client.io.uri));
	}

	console.log(`Tracking Zwift at ${myIP}...`);

    const monitor = new ZwiftPacketMonitor(myIP);
	monitor.on('outgoingPlayerState', (playerState, serverWorldTime) => {
        if (playerState.distance > prevDistance + 3 && numberOfRuns > 4) {
            if (debug){
                console.log(serverWorldTime, playerState);
            }
            
            var angle = Math.asin((playerState.altitude - prevAltitude) / (200 * (playerState.distance - prevDistance)));
            const slp_pc = 100 * Math.tan(angle);
            const slope_pc = sma(slp_pc);
            
            if (debug) {
                console.log('Simulating ' + slp_pc + '% incline pckt ' + numberOfRuns)
            }
    
            if (Math.abs(slope_pc - prevSlope) > 0.9) {
                try {
                    const angle = roundToPrecision(slp_pc, 0.5);
                    const clampedAngle = clamp(angle, settings.minIncline, settings.maxIncline);

                    if (debug) {
                        console.log(`Sending Clamped Incline ${clampedAngle}% - Unclamped Angle ${angle}%`);
                    }

                    const data = {
                        incline: clampedAngle
                    };

                    clients.forEach(client => client.emit('message', JSON.stringify({ event: 'control', data })));
                } catch(e) {
                    console.log(e);
                }
                
                prevSlope = slope_pc;
            }
    
            prevDistance = playerState.distance;
            prevAltitude = playerState.altitude;
    
            numberOfRuns = 1;
        } else if (numberOfRuns == 0 || playerState.distance < prevDistance) {
            // also handle when player changes worlds without restarting the script
            prevDistance = playerState.distance;
            prevAltitude = playerState.altitude;
            console.log('Init done');
        }
    
        numberOfRuns = numberOfRuns + 1;
	});
	
	monitor.start();
}

/*
 Public API.
 */
exports.start = run;

function testPortConnectable(ip, port) {
	return new Promise(resolve => {
		const socket = new Socket();
		let result = false;
	
		socket.on('connect', () => {
			result = true;
			socket.destroy();
		});
	
		socket.setTimeout(400);
		socket.on('timeout', () => {
			socket.destroy();
		});
		
		socket.on('error', (error) => {
		});
	
		socket.on('close', (exception) => {
			resolve({ ip, result });
		});
	
		socket.connect(port, ip);
	});
}

function roundToPrecision(x, precision) {
    var y = +x + (precision === undefined ? 0.5 : precision/2);
    return y - (y % (precision === undefined ? 1 : +precision));
}