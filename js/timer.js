var Timer = function (callback) {
	let _status = 0; // 0- stopped, 1 - running, 2 - paused
	let _ticks = 0;
	let _start = 0;
	let _ms = 0;
	let _timer = null;
	let tick = function() {
		_ticks++;
		if (_callback) callback(this);
	};
	let _callback = null;

	let val2int = function(val){
		let num = 0;
		if (typeof val === 'undefined') {
			num = 0;
		} else if (typeof val === 'string') {
			num = parseInt(val);
		} else {
			num = Math.floor(val);
		}
		return num;
	};
	let start = function(from) {
			if (_status != 2) {
				_ms = val2int(from);
			}
			_ticks = Math.floor(_ms / 1000);

			_start = (new Date()).getTime();
			if (_timer) {
				window.clearInterval(_timer);
			}
			_timer = window.setInterval(tick.bind(this), 1000);
			if (_callback) callback(this);
			_status = 1;
		},
	stop = function() {
			if (_status == 0) return;
			if (_timer != null) {
				window.clearInterval(_timer);
			}
			_timer = null;
			_ms += (new Date()).getTime() - _start;
			_ticks = Math.floor(_ms / 1000);
			_status = 0;
		},
	pause = function() {
			if (_status != 1) return;
			if (_timer != null) {
				window.clearInterval(_timer);
			}
			_ms += (new Date()).getTime() - _start;
			_ticks = Math.floor(_ms / 1000);
			_timer = null;
			_status = 2;
		},
	setTime = function(ms) {
			_ms = val2int(ms);
			_ticks = Math.floor(_ms / 1000);
		},
	getTime = function () {
			return isRunning() ? _ticks * 1000 : _ms;
		},
	getTicks = function() {
			return _ticks;
		},
	isRunning = function() {
			return _status == 1;
		},
	isPaused = function() {
			return _status == 2;
		},
	getStatus = function() {
			return _status;
		},
	toString = function() {
			let t = isRunning() ? _ticks * 1000 : _ms;
			return Timer.formatTime(t);
		}

	if (typeof callback === 'function') {
		_callback = callback;
	}

	return {
		start: start,
		stop: stop,
		pause: pause,
		setTime: setTime,
		getTime: getTime,
		getTicks: getTicks,
		isRunning: isRunning,
		isPaused: isPaused,
		getStatus: getStatus,
		toString: toString
	};
};
Timer.formatTime = function(ms) {
	const units = [60, 60, 24];
	let val = Math.floor(ms/1000), rem, str;
	let time = [];
	for (let i = 0; i < units.length; i++) {
		rem = val % units[i];
		str =  (rem < 10 ? '0' : '') + rem;
		time.push(str);
		val = (val-rem) / units[i];
		if (time.length > 1 && val == 0) break;
	}
	return time.reverse().join(':');
}
