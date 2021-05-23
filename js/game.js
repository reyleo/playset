const _Game = (function($){

const version = "0.111";
const svgNS = "http://www.w3.org/2000/svg";
const xlinkNS = "http://www.w3.org/1999/xlink";


function Card(p) {
	this.color = p[0];
	this.shape = p[1];
	this.quantity = p[2] + 1;
	this.fill = p[3];
}
Card.prototype.toString = function() {
	return this.color + ', ' + this.shape + ', ' + this.quantity + ', ' + this.fill;
}
Card.prototype.toArray = function() {
	let p = [];
	p[0] = this.color;
	p[1] = this.shape;
	p[2] = this.quantity - 1;
	p[3] = this.fill;
	return p;
}
Card.prototype._shapes = ["pill", "curve", "rhomb"];
Card.prototype._colors = ["red", "green", "purple"];
Card.prototype._fills = ["empty", "filled", "stripes"];

Card.prototype.render = function(cardElem) {
	if (cardElem != null) {
		if (cardElem.hasChildNodes()) {
			cardElem.removeChild(cardElem.firstChild);
		}

		let group = document.createElement('div');
		group.className = 'group' + " group" + this.quantity;
		for (let i = 0; i < this.quantity; i++) {
			group.appendChild(this.createSymbol());
		}
		cardElem.appendChild(group);
	}
};

Card.prototype.createSymbol = function() {
	let svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute('class', "symbol");
	svg.setAttribute('viewBox','0 0 200 100');
	svg.style.width = "100%";

	let symbol = document.getElementById("symbol-" + this._shapes[this.shape]).cloneNode();
	symbol.removeAttribute('id');
	symbol.setAttribute('class', this._colors[this.color] + " " + this._fills[this.fill]);
	svg.appendChild(symbol);
	return svg;
};


function Player(id) {

	if (!(this instanceof Player)) {
		return new Player(id);
	}
	this.id = id;
	this.name = "";
	this.wins = 0;
	this.fails = 0;
	this.layout = '';
	this.class = '';
	this.position = '';
	this.area = null;
}

Player.prototype.resetScore = function() {
	this.wins = 0;
	this.fails = 0;
};

Player.prototype.points = function() {
	return this.wins - this.fails;
};

Player.prototype.isValid = function() {
	return this.class !== '' && typeof this.id !== undefined;
};

Player.prototype.isTopPosition = function() {
	return this.class === 'player-top';
}

Player.prototype.setPosition = function(position) {
	if (position === 'top' || position === 'bottom') {
		this.layout = 'horizontal';
	} else if (position === 'right' || position === 'left') {
		this.layout = 'vertical';
	} else {
		player.class = '';
		return;
	}
	this.position = position;
	this.class = 'player-' + position;
};

Player.prototype.increaseWins = function() {
	this.wins++;
	this.area.find('.win-counter').html(this.wins);
	this.area.removeClass('clicked');
};

Player.prototype.increaseFails = function() {
	this.fails++;
	this.area.find('.fail-counter').html(this.fails);
	this.area.removeClass('clicked');
};

const Status = { active: 0, pause: 1, over: 2 };

const Game = (function(){

	let _board = null;
	let _cardsLeft = 0;
	let _deck = [];
	let _next = 0;
	let _counter = null;
	let _players = [];
	let _player = null;
	let _queue = [];
	let _timer = null;
	let _countDown;
	let _setup = {
		player: 0,
		next: false
	};
	let _status = Status.active;
	let _eventName = "";
	let _selectionDone = false;
	let _clockTimer = new Timer(updateTime);
	let _clockWidget = null;
	let _exit = false;
	let _userPause = false;

	let _topResults = [];

	let config = {
		rows: 3,
		columns: 4,
		maxColumns: 5,
		cardHeight: 200,
		cardWidth: 300,
		keepScore: false,
		maxTime: 10,
		showSetOnHint: true
	};
	let boardPadding = 0;
	let _isStorageAvailable = false;
	let _debug = false;

	let debug = function(str) {
		if (_debug) {
			window.console.log(str);
		}
	};

	function isPause() {
		return _status == Status.pause;
	}

	function updateTime (timer) {
		_clockWidget.html(timer.toString());
		//saveTime(timer);
	}

	function isSinglePlayer() {
		return _players.length == 1;
	}

	function isTimerOn() {
		return isSinglePlayer();
	}

	function showTime () {
		if (isTimerOn()) {
			_clockWidget.show();
		}
	}

	function startTime() {
		if (isTimerOn()) {
			_clockTimer.start();
		}
	}

	function load() {
		if (!_isStorageAvailable) return false;
		let data = localStorage.getItem('data');

		if (data && data.length > 0) {
			let state = JSON.parse(data);
			debug('Data loaded: ' + data);
			_deck = [];
			for (let i = 0; i < state.deck.length; i++) {
				_deck.push(new Card(state.deck[i]));
			}
			_next = state.next;
			_cardsLeft = _deck.length - _next;
			_status = state.status;
			if (state.topResults) _topResults = state.topResults;

			loadPlayers(state.players);
			fillBoard(state.board);
			if (isSinglePlayer()) {
				if (_status == Status.active) {
					_clockTimer.start(state.timer);
				} else {
					_clockTimer.setTime(state.timer);
					updateTime(_clockTimer);
				}
				_clockWidget.show();
			} else {
				_clockWidget.hide();
			}

			if (_status == Status.over) {
				findWinners();
			}
			return true;
		}
		return false;
	}

	function saveTime(timer) {
		if (_isStorageAvailable) {
			localStorage.setItem('time', timer.getTime());
		}
	}

	function save() {
		if (!_isStorageAvailable) return;

		let deckArr = _deck.map((card) => card.toArray());

		let state = {
			'version': version,
			'deck': deckArr,
			'next': _next,
			'players': savePlayers(),
			'status': _status,
			'timer': _clockTimer.getTime(),
			'board': getBoard(),
			'topResults': _topResults
		};
		const data = JSON.stringify(state);
		//debug('Saving data: ' + data);
		localStorage.setItem('data', data);
		//saveTime(_clockTimer);
	}

	function copyPlayer(player) {
		let newObj = Object.assign({}, player);
		if (newObj.area) newObj.area = null;
		return newObj;
	}

	function savePlayers() {
		return _players.map(copyPlayer);
	}

	function buildPlayerWithArea(playerData) {
		let newPlayer = Object.assign(new Player(), playerData);
		createArea(newPlayer);
		return newPlayer;
	}

	function loadPlayers(players) {
		_players = players.map(buildPlayerWithArea);
		initPlayers();
	}

	function getBoard() {
		let board = [];
		$('.cardHolder', _board).each(function() {
			let cardElem = this.querySelector('.card');
			board.push(cardElem !== null? cardElem.card.toArray() : null);
		});
		return board;
	}

	function fillBoard(board) {
		let columns = $('.column', _board);
		if (board.length > (config.rows * columns.length)) {
			appendColumn();
		}
		$('.cardHolder', _board).each(function(index) {
			$(this).find('.card').remove();
			if (board[index] != null) {
				placeCard(this, new Card(board[index]), false);
			}
		});
	}

	function deal(animate = false) {
		let places = document.querySelectorAll('#gameBoard .cardHolder');
		let elem, card, count = 0;

		// remove animation
		cards().filter('.animate').removeClass('animate');

		for (let i = 0; i < places.length; i++) {
			elem = places[i].querySelector('.card');
			if (elem == null) {
				card = next();
				if (card != null) {
					count++;
					placeCard(places[i], card, animate);
				} else {
					break;
				}
			}
		}
		_cardsLeft = _deck.length - _next;
		debug("Added " + count + " cards, " + _cardsLeft + " left");
		if (_counter) {
			_counter.innerHTML = "" + _cardsLeft;
		}
	};

	function placeCard(place, card, animate) {
		let elem = document.createElement('div');
		elem.className = 'card';
		$(elem).css(cardCss());
		elem.card = card;
		card.render(elem);
		if (animate) {
			$(elem).addClass('animate')
		}
		place.appendChild(elem);
	}

	function checkForMore() {
		var setNotFound = (findSet() == null);
		if (setNotFound) {
			debug("checkForMore: set not found, " + _cardsLeft + " cards left");
			if (_cardsLeft > 0) {
				if (addMore()) {
					deal(true);
					setNotFound = findSet() == null;
				}
			}
		}

		if (setNotFound) {
			gameOver();
		}
	}

	function gameOver() {
		findWinners();
		_status = Status.over;
		_clockTimer.stop();
		updateTime(_clockTimer);
		// save top result if all cards played
		if (isSinglePlayer() && _cardsLeft == 0) {
			// get time in msec
			var time = _clockTimer.getTime();
			var position = checkTopResult(time);
			if (position !== -1) {
				showTopResults(position);
			}
		}
		save();
		if (_cardsLeft == 0) {
			instruction("Game over!", 'normal', 2000);
		} else {
			instruction("No more sets", 'normal', 2000);
		}
	}

	function findWinners() {
		let winners = [];
		let maxPoints = -999;

		_players.forEach((player) => {
			let points = player.points();
			if (points == maxPoints) {
				winners.push(player);
			} else if (points > maxPoints) {
				winners = [player];
				maxPoints = points;
			}
		});
		//debug("Max points " + maxPoints + ", winners = " + winners.length);
		winners.forEach((p) => p.area.addClass('winner'));
	}

	function newTopResult(time) {
		let formatted = '';
		if (toLocaleDateStringSupportsLocales()) {
			formatted = (new Date()).toLocaleDateString(navigator.language, {
				month: 'numeric', year: 'numeric', day: 'numeric'
			})
		} else {
			formatted = (new Date()).toISOString().substr(0, 10)
		}
		return {
			time: time,
			date: formatted
		}
	}

	function checkTopResult(time) {
		for (let i = 0; i < _topResults.length; i++) {
			if ( time < _topResults[i].time ) {
				_topResults.splice(i, 0, newTopResult(time));
				if (_topResults.length > 10) {
					// pop last result :(
					_topResults.pop();
				}
				return i;
			}
		}
		if (_topResults.length < 10) {
			_topResults.push(newTopResult(time));
			return _topResults.length-1;
		}
		return -1;
	}

	function showTopResults(current = -1) {
		var list = $('#topResults ol');
		list.empty();
		_topResults.forEach( function(_top, index) {
			var item = $('<li>');
			item.html(Timer.formatTime(_top.time));
			item.append('<span class="date">' + _top.date + '</span>');
			if (current == index) {
				item.addClass('current');
			}
			list.append(item);
		});
		showDialog('#topResults');
	}

	function clearTopResults() {
		_topResults = [];
		$('#topResults ol').empty();
	}
	/*
	 * Get next card from deck and move pointer
	 */
	function next() {
		let card = null;
		if (_next < _deck.length) {
			card = _deck[_next];
			_next++;
		}
		return card;
	}
	/*
	 * Shuffle cards in the deck
	 */
	function shuffle() {
		let count = _deck.length;
		let pos;
		let temp;
		while (count > 0) {
			pos = Math.floor(Math.random() * count);
			count -= 1;
			temp = _deck[count];
			_deck[count] = _deck[pos];
			_deck[pos] = temp;
		}
	}

	function findSet() {
		let cards = $('#gameBoard .card');
		// is board empty?
		if (cards.length == 0) return null;

		let combination = [0, 1, 2];
		let selection;
		let j, k, m, max = cards.length - 1;
		let n = combination.length - 1;

		do {

			selection = [];

			for (j = 0; j < combination.length; j++) {
				selection.push(cards.get(combination[j]));
			}
			if (checkSet(selection)) {
				debug("findSet - set found in " + cards.length + " cards");
				return selection;
			}
			for (k = n, m = max; k >= 0; k--,m--) {
				if (combination[k] < m) {
					combination[k]++;
					for (j = k+1; j < combination.length; j++) {
						combination[j] = combination[j-1] + 1;
					}
					break;
				}
			}
			if (k < 0) {
				break;
			}

		} while (true);
		debug("findSet - not found in " + cards.length + " cards");
		return null;
	}

	function nextCombination(p, max) {
		let pos = p.length - 1;

		while (pos >= 0) {
			if (p[pos] >= max) {
				p[pos] = 0;
				pos--;
			} else {
				p[pos] += 1;
				return true;
			}
		}

		return false;
	}

	function restart() {
		_next = 0;
		_cardsLeft = _deck.length;
		_status = Status.active;
		clear();
		shuffle();
		if (!config.keepScore) {
			resetScore();
		}
		_clockTimer.stop();
		if (_players.length > 1) {
			_clockWidget.hide();
		} else {
			_clockTimer.stop();
			_clockTimer.start();
			_clockWidget.show();
		}
		deal();
		checkForMore();
		save();
	}

	function resetScore() {
		_players.forEach((player) => player.resetScore());
		$('.win-counter,.fail-counter').html('0');
	}

	function clear() {
		clearTimers();
		$('.card', _board).remove();
		_player = null;
		$('.player-area').removeClass('clicked winner queue');
		let columnRemoved = false;
		$('#gameBoard .column').each(function(index) {
			if (index > config.columns-1) {
				$(this).remove();
				columnRemoved = true;
			}
		});
		if (columnRemoved) {
			onColumnNumberChange();
		}
	}

	function commandMore() {
		addMore();
		deal(true);
	}

	function addMore() {
		let columns = $('#gameBoard .column');
		if (columns.length == config.maxColumns) return false;
		appendColumn();
		onColumnNumberChange();
		debug("1 column added")
		return true;
	}

	function appendColumn() {
		let column = document.createElement("div");
		column.className = "column";
		column.style.width = config.cardWidth + 'px';
		for (let j = 0; j < config.rows; j++) {
			let cardHolder = document.createElement("div");
			cardHolder.className = "cardHolder";
			$(cardHolder).css(cardHolderCss());
			column.appendChild(cardHolder);
		}
		document.getElementById('columns').appendChild(column);
	}

	function calcHeight() {
		let h1 = Math.floor($(_board).height() * 0.9 / 3);
		let boardWidth = $(_board).width();
		let colCount = $('.column', _board).length;
		let colWidth = colCount == 5 ? 0.18 : 0.23;
		let w2 = Math.floor(boardWidth * colWidth);
		//var w2 = Math.floor(boardWidth * 0.18);
		w2 -= w2 % 2;
		h1 -= h1 % 3;
		let h2 = w2/2 * 3;
		if (h2 < h1) {
			//console.log('h1=' + h1 + ', h2=' + h2 + ', w2=' + w2 + ', width=' + boardWidth);
		}
		return Math.min(h1, h2);
	}

	function cardHolderCss() {
		let margin = Math.floor(config.cardHeight * 0.075);
		let totalHeight = config.cardHeight * 3 + margin * 4;
		debug("Card height=" + config.cardHeight + ', margin = ' + margin + ", Total height = " + totalHeight);
		return {
			'height': config.cardHeight,
			'margin-top': margin,
			'margin-bottom': margin
		};
	}

	function cardCss() {
		const r = Math.round(config.cardHeight * 0.06);
		return {
			'height': config.cardHeight + 'px',
			'width': config.cardWidth + 'px',
			'border-radius': r + 'px'
		};
	}

	function calcCardSize() {
		let h = calcHeight();
		if (h != config.cardHeight) {
			config.cardHeight = h;
			config.cardWidth = h / 3 * 2;
		}
	}

	function onColumnNumberChange() {
		resizeCards();
	}

	function resizeCards() {
		calcCardSize();
		$('.card', _board).css(cardCss());
		$('.cardHolder', _board).css(cardHolderCss());

		let bw = $(_board).width();
		let colMargin = Math.floor(bw * 0.01);

		$('.column', _board).css({
			'width': config.cardWidth,
			'margin-right': '' + colMargin + 'px',
			'margin-left': '' + colMargin + 'px',
		});
		let colCount = document.querySelectorAll('.column').length;
		let realWidth = (config.cardWidth + colMargin * 2) * colCount;
		$('#columns').width(realWidth);
	}

	function resize() {
		let playerPadding = '36pt';
		let noPadding = '0';

		// create paddings for player areas
		let css = {
			'padding-top':    playerPadding,
			'padding-right':  noPadding,
			'padding-bottom': noPadding,
			'padding-left':   noPadding
		};
		_players.map(player => 'padding-' + player.position).forEach(property => css[property] = playerPadding);
		// apply paddings
		$('#gameContainer').css(css);
		// recalculate cards
		let newHeight = calcHeight();
		if (config.cardHeight != newHeight) {
			resizeCards();
		}
		['top','bottom','right','left'].forEach((side) => resizePlayers('player-'+side));

	}

	function escape() {
		if (!_exit) {
			_clockTimer.pause();
			save();
			_exit = true;
		}
	}

	function clickPause(e) {

		if (_status != Status.active && _status != Status.pause) return;
		if (_clockTimer.isRunning()) {
			_clockTimer.pause();
			_clockWidget.html('Paused');
			$(_board).hide();
			_userPause = true;
			save();
		} else {
			_clockTimer.start();
			$(_board).show();
			_userPause = false;
		}
		e.preventDefault();
	}

	function init() {
		_board = document.getElementById("gameBoard");

		$('#gameInfo').html(version);

		let offset = $(_board).offset();
		boardPadding = offset.top;
		_isStorageAvailable = storageAvailable();

		for (let i = 0; i < config.columns; i++) {
			appendColumn();
		}
		//calcCardSize();

		const MAX_VAL = 2;

		//
		// event handlers
		//
		_eventName = 'click';
		if ('ontouchstart' in document.documentElement) {
			_eventName = 'touchstart';
		}

		_counter = document.getElementById('counter');
		_clockWidget = $('<div>').addClass('game-timer noselect');
		_clockWidget.appendTo($('body')).hide();
		_clockWidget.on(_eventName, clickPause);

		$(_board).on(_eventName, '.card', function() {
			onCardSelect(this);
		});

		$(_board).on('dblclick', '.card', function(event) {
			event.stopPropagation();
			event.preventDefault();
			return false;
		});

		$('#setupDialog .button').on(_eventName, function() {
			let count = parseInt(this.innerHTML);
			hideDialog('#setupDialog');
			createPlayers(count);
			runSetup();
		});

		$('#setupDialog #keepScore')
			.on(_eventName, function() {
				var newval = !this.checked;
				this.checked = newval;
				config.keepScore = newval;
				this.className = "check " + (this.checked ? 'check-on' : 'check-off');
			})
			.addClass(config.keepScore ? 'check-on' : 'check-off')
			.prop('checked', config.keepScore);


		$('#setupDialog .close').on(_eventName, function() {
			hideDialog('#setupDialog');
			if (!_userPause) {
				$(_board).show();
				if (_status == Status.active) {
					startTime();
				}
			}
			showTime();
		});

		$('#topResults #clearResults').on(_eventName, function() {
			clearTopResults();
		});

		window.addEventListener('unload', escape);
		window.addEventListener('pagehide', escape);
		window.addEventListener('beforeunload', escape);

		if (!load()) {
			let cardIndex = 0;
			let p = [0, 0, 0, 0];

			do {
				_deck[cardIndex++] = new Card(p);
			} while (nextCombination(p, MAX_VAL));

			// create 1 player
			createPlayers(1);
			_players[0].setPosition('bottom');
			createArea(_players[0]);
			initPlayers();

			// finally restart game
			restart();
		}
		resize();
	}

	function setup() {
		showDialog('#setupDialog');
		$(_board).hide();
		_clockWidget.hide();
		if (!_userPause) {
			_clockTimer.pause();
		}
		menuSwitch();
	}

	function setupPlayer() {
		instruction('Select area for player ' + (_setup.player + 1));
		let player = _players[_setup.player];
		$(document).one(_eventName, function(event){
			let wh = window.innerHeight;
			let ww = window.innerWidth;
			let clickX = _eventName == 'click' ? event.pageX : event.originalEvent.touches[0].pageX;
			let clickY = _eventName == 'click' ? event.pageY : event.originalEvent.touches[0].pageY;
			if (clickY < boardPadding) {
				player.setPosition('top');
			} else if (clickY > (wh - boardPadding)) {
				player.setPosition('bottom');
			} else if (clickX < boardPadding) {
				player.setPosition('left');
			} else if (clickX > (ww - boardPadding)) {
				player.setPosition('right');
			}
			if (!player.isValid() ||
					(isSinglePlayer() && player.isTopPosition())) {
				window.setTimeout(setupPlayer, 1000);
				instruction('Incorrect place', 'error');
				return;
			}

			if (player.isValid()) {
				createArea(player);
				if (_setup.next && _setup.player < _players.length-1) {
					_setup.player++;
					window.setTimeout(setupPlayer, 10);
				} else {
					finishSetup();
				}

			}
		});
	}

	function finishSetup() {
		$(_board).show();
		resize();
		$('#gameMessage').hide();
		initPlayers();
		restart();
	}

	function createArea(player) {
		let area = $('<div class="player-area noselect"></div>');
		let contents = $('<div class="player-contents"></div');
		area.addClass(player.class).appendTo($('body'));
		resizePlayers(player.class);
		if (player.position == 'bottom' || player.position == 'left') {
			contents.append('<div class="win-counter">' + player.wins + '</div>')
			contents.append('<div class="fail-counter">' + player.fails + '</div>')
		} else {
			contents.append('<div class="fail-counter">' + player.fails + '</div>')
			contents.append('<div class="win-counter">' + player.wins + '</div>')
		}
		area.append(contents);
		//area.append('<div>' + (_setup.player+1) + '</div>');
		player.area = area;
		area.data('player', player.id);
		return area;
	}

	function initPlayers() {
		$('.player-area').on(_eventName, onPlayerAreaClick);
	}

	function onPlayerAreaClick() {
		// do not react on user click if game is over
		// debug('Game status = ' + _status);
		if (_status == Status.over) return;
		if (isSinglePlayer()) return;
		// exit if not first :)
		let clicked = $(this);
		let clickedId = clicked.data('player');

		if (_player != null) {
			// current player cannot go to queue
			if (_player.id != clickedId) {
				addToQueue(_players[clickedId]);
			}
		} else {
			$('#gameMessage').hide();
			_player = _players[clickedId];
			clicked.addClass('clicked');
			// Ensure Queue is empty
			emptyQueue();
			// Timer
			startTimer(clicked);
		}
	}

	function emptyQueue() {
		if (_queue.length == 0) return;
		_queue.forEach(player => player.area.removeClass('queue'));
		_queue = [];
	}

	function addToQueue(player) {
		if (_queue.some(p => p.id === player.id)) return;
		_queue.push(player);
		debug('Player ' + player.id + ' added to queue');
		player.area.addClass('queue');
	}

	function nextInQueue() {
		if (_queue.length > 0) {
			_player = _queue.shift();
			debug('Player ' + _player.id + ' taken from queue');
			_player.area.removeClass('queue').addClass('clicked');
			startTimer(_player.area);
		}
	}

	function startTimer(area) {
		_countDown = config.maxTime + 1;
		$('<div class="player-timer"></div>').insertBefore(area[0].firstChild);
		timerEvent();
	}

	function clearTimers() {
		if (_timer != null) {
			window.clearTimeout(_timer);
			_timer = null;
		}
		$('.player-timer').remove();
	}


	function timerEvent() {
		_countDown--;
		const percent = 100 * (config.maxTime - _countDown) / config.maxTime;
		let t = _player.area.find('.player-timer');
		if (_player.layout == 'horizontal') {
			t.css('width', percent +'%');
		} else {
			t.css('height', percent +'%');
		}
		if (_countDown > 0) {
			_timer = window.setTimeout(timerEvent, 1000);
		} else {
			t.remove();
			playerFail();
			cards().removeClass('hint selected');
		}

	}

	function resizePlayers(playerClass) {
		// find same class players
		let same = $('.' + playerClass);
		let playerCount = same.length;
		let size = 0, pos = boardPadding;
		if (playerClass == 'player-top' || playerClass == 'player-bottom') {
			size = Math.floor((window.innerWidth - boardPadding*2) / playerCount);
			same.css('width', size).each(function(index){
				$(this).css('left', pos);
				pos += size;
			});
		} else if (playerClass == 'player-left' || playerClass == 'player-right') {
			size = Math.floor((window.innerHeight - boardPadding*2) / playerCount);
			same.css('height', size).each(function(index){
				$(this).css('top', pos);
				pos += size;
			});
		}
	}

	function runSetup() {
		_setup.player = 0;
		_setup.next = true;
		window.setTimeout(setupPlayer, 10);
	}

	function createPlayers(count) {
		_players = [];
		$('.player-area').remove();
		for (var id = 0; id < count; id++) {
			_players.push(Player(id));
		}
	}

	function instruction (html, style = 'normal', msec) {
		var delay = (typeof msec == "number")? msec : 0;
		var obj = $('#gameMessage');
		obj.children().remove();
		obj.html(html).attr('class', 'instruction ' + style).show();
		if (delay > 0) {
			window.setTimeout(instructionOff, delay);
		}
	}

	function instructionOff() {
		$('#gameMessage').hide();
	}

	function checkSet(selection) {
		if (selection.length < 3) return false;
		const c1 = selection[0].card;
		const c2 = selection[1].card;
		const c3 = selection[2].card;
		return checkAttribute(c1.color, c2.color, c3.color) &&
			checkAttribute(c1.fill, c2.fill, c3.fill) &&
			checkAttribute(c1.shape, c2.shape, c3.shape) &&
			checkAttribute(c1.quantity, c2.quantity, c3.quantity);
	}

	function checkAttribute(a1, a2, a3) {
		return ((a1 == a2 && a2 == a3) ||
			(a1 != a2 && a1 != a3 && a2 != a3));
	}

	function error(msg) {
		$('#errorMessage').parent().show();
		window.setTimeout(function(){
				$('#errorMessage').parent().hide();
			}, 1000);
	};

	function cards() {
		return $('.card', _board);
	}

	function hint(btn) {
		let set = findSet();

		if (config.showSetOnHint) cards().removeClass('hint selected');
		if (set) {
			//instruction('Set exists!', 'green', 2000);
			if (config.showSetOnHint) $(set).addClass('hint');
		} else {
			instruction('Not found!', 'error', 2000);
			//showMessage('No set found', 1000);
		}
	}

	function onCardSelect(card) {
		if (_selectionDone || _status == Status.over) return;
		if (_players.length > 1 && _player == null) {
			instruction('Select player first', 'error', 2000);
			return;
		}

		$(card).removeClass('hint').toggleClass('selected');
		let selection = $('.card.selected', _board);
		if (selection.length == 3) {
			_selectionDone = true;
			clearTimers();
			window.setTimeout(function(){
				checkSelection();
			}, 300);
		}
	}

	function checkSelection() {
		let check = [];
		let selection = $('.card.selected', _board);

		selection.each(function() { check.push(this) });
		cards().removeClass('hint selected');
		_selectionDone = false;

		if (checkSet(check)) {
			// correct SET
			selection.remove();
			let columns = $('#gameBoard .column');
			let movers = $('.column:last .card',_board);
			let moveIndex = 0;
			if (columns.length == config.maxColumns) {
				$('.column',_board).not(':last').find('.cardHolder').each(function(){
					if (!this.hasChildNodes()) {
						var card = movers.eq(moveIndex++);
						this.appendChild(card.get(0));
					}
				});
				$('.column:last', _board).remove();
				onColumnNumberChange();
				debug("1 column removed");
			} else {
				deal(true);
			}
			playerWins();

			// Check if we need more cards
			checkForMore();


		} else {

			// ERROR!
			error("Oops!");
			playerFail();
		}

		save();
	}

	function autoPlay(delay = 500) {
		let set = findSet();
		if (set != null) {
			$(set).addClass('selected');

			// select random player
			var index = Math.floor(Math.random() * _players.length);
			_player = _players[index];
			checkSelection();
			window.setTimeout(() => autoPlay(delay), delay);
		}
		return true;
	}

	function playerWins() {
		if (isSinglePlayer()) {
			_player = _players[0];
		}
		if (_player == null) return;

		_player.increaseWins();
		_player = null;
		// Queue
		emptyQueue();
	}

	function playerFail() {
		if (isSinglePlayer()) {
			_player = _players[0];
		}
		if (_player == null) return;

		_player.increaseFails();
		_player = null;
		// Queue
		nextInQueue();
		save();
	}

	return {
		init: init,
		hint: hint,
		more: commandMore,
		restart: restart,
		setup: setup,
		resize: resize,
		autoPlay: autoPlay,
		topResults: showTopResults,
		version: function () {return version; },
		debugOn: function() { _debug = true; }
	};
})();

function showTooltip(target, text, msec) {
	let tip = document.getElementById('toolbarTip');
	tip.style.visibility = 'hidden';
	tip.style.display = 'block';
	let tt = $(tip);
	tip.innerHTML = text;
	let pos = target.offset();
	let width = tt.get(0).clientWidth;
	tip.style.display = 'none';
	tip.style.visibility = 'visible';
	tt.css({
		top: pos.top,
		left: pos.left - width
	});
	tt.fadeIn(200);

	window.setTimeout(function(){
		tt.fadeOut(400);
		}, msec);

}

function showTopMessage(text, mseconds = 1000) {
	let m = $('#message');
	m.text(text);
	m.css('top','-' + m.css('height'));
	m.animate({"top":0}, 500);
	window.setTimeout(hideTopMessage, mseconds);
}

function hideTopMessage() {
	let m = $('#message');
	let top = '-' + m.css('height');
	m.animate({"top": top}, 500);
}

function showDialog(id) {
	const dlg = $(id);
	let wh = window.innerHeight;
	let ww = window.innerWidth;
	dlg.parent().show();
	let dw = dlg.width();
	let dh;
	let innerHeight = 0;
	dlg.children().each(function () {
		innerHeight += this.clientHeight;
	});
	dh = innerHeight;

	if (dw > ww) {
		dw = ww;
	}
	if (dh > wh) {
		dh = wh;
	}

	dlg.css({
		top: Math.max(Math.round((wh - dh)/2), 0),
		left: Math.max(Math.round((ww - dw)/2), 0),
		height: dh,
		width: dw
	});
}

function hideDialog(id) {
	$(id).parent().hide();
}

function toLocaleDateStringSupportsLocales() {
	try {
		new Date().toLocaleDateString('i');
	} catch (e) {
		return e.name === 'RangeError';
	}
	return false;
}

function storageAvailable() {
	try {
		let storage = window.localStorage;
		let x = '__storage_test__';
		storage.setItem(x, x);
		storage.removeItem(x);
		return true;
	}
	catch(e) {
		return false;
	}
}

/**
 * Document ready
 */
$(function(){


	let eventName = 'click';
	if ('ontouchstart' in document.documentElement) {
		eventName = 'touchstart';
	}

	/*
	 *   Delayed render fixes issue on Firefox
	 */
	window.setTimeout(function(){
		Game.init();
	}, 10);


	$('#btnHint').on(eventName, function(){
		Game.hint(this);
		menuSwitch();
	});

	$('#btnMore').on(eventName, function(){
		Game.more();
		menuSwitch();
	});

	$('#btnStart').on(eventName, function(){
		Game.restart();
		menuSwitch();
	});

	$('#menuSwitch').on(eventName, menuSwitch );

	$('#btnSetup').on(eventName, function() {
		Game.setup();
	});

	$('#topResults .close').on(eventName, function (){
		$(this).closest('.dialog').parent().hide();
	});

	$('#btnTop').on(eventName, function(){
		Game.topResults();
		menuSwitch();
	});

	$(window).on('resize', function(){
		Game.resize();
	});
});

function menuSwitch() {
	var menu = $('#controls');
	if (menu.is(':visible')) menu.hide();
	else menu.show(0);
}
return Game;
})(window.jQuery);
