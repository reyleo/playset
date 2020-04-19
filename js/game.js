var _Game = (function($){

var version = "0.110";

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
	var p = [];
	p[0] = this.color;
	p[1] = this.shape;
	p[2] = this.quantity - 1;
	p[3] = this.fill;
	return p;
}

var svgNS = "http://www.w3.org/2000/svg";
var xlinkNS = "http://www.w3.org/1999/xlink";
Card.prototype._shapes = ["pill", "curve", "rhomb"];
Card.prototype._colors = ["red", "green", "purple"];
Card.prototype._fills = ["empty", "filled", "stripes"];

Card.prototype.render = function(cardElem) {
	if (cardElem != null) {
		if (cardElem.hasChildNodes()) {
			cardElem.removeChild(cardElem.firstChild);
		}

		var group = document.createElement('div');
		group.className = 'group' + " group" + this.quantity;
		for (var i = 0; i < this.quantity; i++) {
			group.appendChild(this.createSymbol());
		}
		cardElem.appendChild(group);
	}
};
Card.prototype.createSymbol = function() {
	svg = document.createElementNS(svgNS, "svg");
	svg.setAttribute('class', "symbol");
	svg.setAttribute('viewBox','0 0 200 100');
	svg.style.width = "100%";

	symbol = document.getElementById("symbol-" + this._shapes[this.shape]).cloneNode();
	symbol.removeAttribute('id');
	symbol.setAttribute('class', this._colors[this.color] + " " + this._fills[this.fill]);
	svg.appendChild(symbol);
	return svg;
};


var Status = {active: 0, pause: 1, over: 2};

var Game = (function(){

    var _board = null;
    var _cardsLeft = 0;
    var _deck = [];
	var _next = 0;
	var _counter = null;
	var _players = [];
	var _player = null;
	var _queue = [];
	var _timer = null;
	var _countDown;
	var _setup = {
		player: 0,
		next: false
	};
	var _status = Status.active;
	var _eventName = "";
    var _selectionDone = false;
	var _clockTimer = new Timer(updateTime);
	var _clockWidget = null;
	var _exit = false;
	var _userPause = false;
	var _topResults = [];

	var config = {
		rows: 3,
		columns: 4,
		maxColumns: 5,
		cardHeight: 200,
		cardWidth: 300,
		keepScore: false,
		maxTime: 10,
        showSetOnHint: true
	};
	var boardPadding = 0;

	var _isStorageAvailable = false;

    var _debug = false;
    var debug = function(str) {
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
		var data = localStorage.getItem('data');
		var timeValue = 0;
		/*
		var timeStr = localStorage.getItem('time');
		if (timeStr) {
			timeValue = parseInt(timeStr);
		}
		*/
		if (data && data.length > 0) {
			var state = JSON.parse(data);
			debug('Data loaded: ' + data);
			/*
			if (state.version != version) {
				debug('Data from previous version');
				return false;
			}
			*/
			_deck = [];
			for (var i = 0; i < state.deck.length; i++) {
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

		var deckArr = _deck.map((card) => card.toArray());

		var state = {
			'version': version,
			'deck': deckArr,
			'next': _next,
			'players': savePlayers(),
			'status': _status,
			'timer': _clockTimer.getTime(),
			'board': getBoard(),
			'topResults': _topResults
		};
		var data = JSON.stringify(state);
		//debug('Saving data: ' + data);
		localStorage.setItem('data', data);
		//saveTime(_clockTimer);
	}

	function copyPlayer(player) {
		var newObj = Object.assign({}, player);
		if (newObj.area) newObj.area = null;
		return newObj;
	}

	function savePlayers() {
		return _players.map(copyPlayer);
	}

	function loadPlayers(players) {
		_players = [];
		for (var i = 0; i < players.length; i++) {
			createArea(players[i]);
			_players.push(players[i]);
		}
		initPlayers();
	}

	function getBoard() {
		var board = [];
		$('.cardHolder', _board).each(function() {
			var cardElem = this.querySelector('.card');
			board.push(cardElem !== null? cardElem.card.toArray() : null);
		});
		return board;
	}

	function fillBoard(board) {
		var columns = $('.column', _board);
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

    function deal(animation) {

		var animate = animation || false;
        var places = document.querySelectorAll('#gameBoard .cardHolder');
		var elem, card, count = 0;

		// remove animation
		cards().filter('.animate').removeClass('animate');

		for (var i = 0; i < places.length; i++) {
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
		var elem = document.createElement('div');
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
        var winners = [];
        var maxPoints = -999;

        _players.forEach( function(player) {
            var points = player.wins - player.fails;
            if (points == maxPoints) {
                winners.push(player);
            } else if (points > maxPoints) {
                winners = [];
                winners.push(player);
                maxPoints = points;
            }
        });
        debug("Max points " + maxPoints + ", winners = " + winners.length);
        for (i = 0; i < winners.length; i++) {
            winners[i].area.addClass('winner');
        }
	}

	function newTopResult(time) {
		var formatted;
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
		var i;
		for (i = 0; i < _topResults.length; i++) {
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

	function showTopResults(current) {
		if (typeof current === 'undefined') current = -1;
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
		var card = null;
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
		var count = _deck.length, pos, temp;
		while (count > 0) {
			pos = Math.floor(Math.random() * count);
			count -= 1;
			temp = _deck[count];
			_deck[count] = _deck[pos];
			_deck[pos] = temp;
		}
	}

	function findSet() {
		var cards = $('#gameBoard .card');
		// is board empty?
		if (cards.length == 0) return null;

		var combination = [0, 1, 2];
		var selection;
		var j, k, m, max = cards.length - 1;
		var n = combination.length - 1;

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
        var pos = p.length - 1;

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
		var p;
		for (var i = 0; i < _players.length; i++) {
			p = _players[i];
			p.wins = 0;
			p.fails = 0;
		}
		$('.win-counter,.fail-counter').html('0');
	}

	function clear() {
		clearTimers();
		$('.card', _board).remove();
		_player = null;
		$('.player-area').removeClass('clicked winner queue');
		var columnRemoved = false;
		$('#gameBoard .column').each(function(index){
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
		var columns = $('#gameBoard .column');
		if (columns.length == config.maxColumns) return false;
		appendColumn();
		onColumnNumberChange();
        debug("1 column added")
		return true;
	}

	function appendColumn() {
		var column = document.createElement("div");
		var cardHolder;
		column.className = "column";
		column.style.width = config.cardWidth + 'px';
		for (var j = 0; j < config.rows; j++) {
			cardHolder = document.createElement("div");
			cardHolder.className = "cardHolder";
			$(cardHolder).css(cardHolderCss());
			column.appendChild(cardHolder);
		}
		_board.appendChild(column);
	}

	function calcHeight() {
		var h1 = Math.floor($(_board).height() * 0.9 / 3);
		var boardWidth = $(_board).width();
		var colCount = $('.column', _board).length;
		var colWidth = colCount == 5 ? 0.18 : 0.23;
		var w2 = Math.floor(boardWidth * colWidth);
		//var w2 = Math.floor(boardWidth * 0.18);
		w2 -= w2 % 2;
		h1 -= h1 % 3;
		var h2 = w2/2 * 3;
		if (h2 < h1) {
			//console.log('h1=' + h1 + ', h2=' + h2 + ', w2=' + w2 + ', width=' + boardWidth);
		}
		return Math.min(h1, h2);
	}

	function cardHolderCss() {
		var margin = Math.floor(config.cardHeight * 0.075);
		var totalHeight = config.cardHeight * 3 + margin * 4;
		debug("Card height=" + config.cardHeight + ', margin = ' + margin + ", Total height = " + totalHeight);
		return {
			'height': config.cardHeight,
			'margin-top': margin,
			'margin-bottom': margin
		};
	}
	function cardCss() {
		var r = Math.round(config.cardHeight * 0.06);
		return {
			'height': config.cardHeight + 'px',
			'width': config.cardWidth + 'px',
			'border-radius': r + 'px'
		};
	}

	function calcCardSize() {
		var h = calcHeight();
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
		$('.column', _board).width(config.cardWidth);
	}

	function resize() {
		var newHeight = calcHeight();
		if (config.cardHeight != newHeight) {
			resizeCards();
		}
		resizePlayers('player-top');
		resizePlayers('player-bottom');
		resizePlayers('player-right');
		resizePlayers('player-left');

	}

	function maximize() {
		var property;
		var defaultPadding = '36pt';
		var padding = '0';

		var css = {
			'padding-top':    defaultPadding,
			'padding-right':  padding,
			'padding-bottom': padding,
			'padding-left':   padding
		};
		for (let i = 0; i < _players.length; i++) {
			property = 'padding-' + _players[i].position;
			css[property] = defaultPadding;
		}

		$('#gameContainer').css(css);

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

		var offset = $(_board).offset();
		boardPadding = offset.top;
		_isStorageAvailable = storageAvailable();

        var i;
        for (i = 0; i < config.columns; i++) {
			appendColumn();
        }
		//calcCardSize();

		var MAX_VAL = 2;
		// fill cards
		var p = [0, 0, 0, 0];

		//
		// event handlers
		//
		_eventName = 'click';
		if ('ontouchstart' in document.documentElement) {
			_eventName = 'touchstart';
		}

		_counter = document.getElementById('counter');
		_clockWidget = $('<div>').addClass('game-timer');
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
			var count = parseInt(this.innerHTML);
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
			var cardIndex = 0;
			do {
				_deck[cardIndex++] = new Card(p);
			} while (nextCombination(p, MAX_VAL));

			// create 1 player
			createPlayers(1);
			_players[0].layout = 'horizontal';
			_players[0].class = "player-bottom";
			_players[0].position = "bottom";
			createArea(_players[0]);
			initPlayers();

			// finally restart game
			restart();
		}
		maximize();
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
		instruction('Click on player area');
		var player = _players[_setup.player];
		$(document).one(_eventName, function(event){
			var wh = window.innerHeight;
			var ww = window.innerWidth;
			var area;
			var playerClass = "";
			var clickX = _eventName == 'click' ? event.pageX : event.originalEvent.touches[0].pageX;
			var clickY = _eventName == 'click' ? event.pageY : event.originalEvent.touches[0].pageY;
			if (clickY < boardPadding) {
				playerClass = 'player-top';
				player.layout = 'horizontal';
				player.position = 'top';
			} else if (clickY > (wh - boardPadding)) {
				playerClass = 'player-bottom';
				player.layout = 'horizontal';
				player.position = 'bottom';
			} else if (clickX < boardPadding) {
				playerClass = 'player-left';
				player.layout = 'vertical';
				player.position = 'left';
			} else if (clickX > (ww - boardPadding)) {
				playerClass = 'player-right';
				player.layout = 'vertical';
				player.position = 'right';
			}
			if ( playerClass == "" ||
					(isSinglePlayer() && playerClass == 'player-top')) {
				area = null;
				window.setTimeout(setupPlayer, 1000);
				instruction('Incorrect place', 'error');
				return;
			}

			if (playerClass != "") {
				player.class = playerClass;
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

		maximize();
		resize();

        $('#gameMessage').hide();
        initPlayers();
        restart();
    }

	function createArea(player) {
		var area = $('<div class="player-area"></div>');
		var contents = $('<div class="player-contents"></div');
		area.addClass(player.class).appendTo($('body'));
		resizePlayers(player.class);
		if (player.class == 'player-bottom' || player.class == 'player-left') {
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
		debug('Game status = ' + _status);
		if (_status == Status.over) return;
		if (isSinglePlayer()) return;
		// exit if not first :)
		var clicked = $(this);
		var clickedId = clicked.data('player');

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
		var i;
		for (i = 0; i < _queue.length; i++) {
			_queue[i].area.removeClass('queue');
		}
		_queue = [];
	}

	function addToQueue(player) {
		var i;
		for (i = 0; i < _queue.length; i++) {
			if (_queue[i].id == player.id) return;
		}
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
		var percent = 100 * (config.maxTime - _countDown) / config.maxTime;
		var t = _player.area.find('.player-timer');
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
		var same = $('.' + playerClass);
		var playerCount = same.length;
		var size = 0, pos = boardPadding;
		if (playerClass == 'player-top' || playerClass == 'player-bottom') {
			size = Math.floor((window.innerWidth - boardPadding*2)/playerCount);
			same.css('width', size).each(function(index){
				$(this).css('left', pos);
				pos += size;
			});
		} else if (playerClass == 'player-left' || playerClass == 'player-right') {
			size = Math.floor((window.innerHeight - boardPadding*2)/playerCount);
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
		for (var i = 0; i < count; i++) {
			_players.push({
				id: i,
				name: "",
				wins: 0,
				fails: 0,
				layout: '',
				class: '',
				position: '',
				area: null
			});
		}
		/*
		if (count == 1) {
			$(_board).show();
			return;
		}
		*/

	}
	function instruction (html, style, msec) {
		var my = style || 'normal';
		var delay = (typeof msec == "number")? msec : 0;
		var obj = $('#gameMessage');
		obj.children().remove();
		obj.html(html).attr('class', 'instruction ' + my).show();
		if (delay > 0) {
			window.setTimeout(instructionOff, delay);
		}
	}
	function instructionOff() {
		$('#gameMessage').hide();
	}
	function checkSet(selection) {
		if (selection.length < 3) return false;
		var c1 = selection[0].card;
		var c2 = selection[1].card;
		var c3 = selection[2].card;
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
		//document.getElementById('audio-error').play();
		$('#errorMessage').parent().show();
		window.setTimeout(function(){
				$('#errorMessage').parent().hide();
			}, 1000);
	};

	function cards() {
		return $('.card', _board);
	}
	function hint(btn) {
		var set = findSet();

		if (config.showSetOnHint) cards().removeClass('hint selected');
		if (set) {
			//instruction('Set exists!', 'green', 2000);
			//showTooltip($(btn), 'Set exists!', 2000);
			if (config.showSetOnHint) $(set).addClass('hint');
		} else {
			instruction('Not found!', 'error', 2000);
			//showMessage('No set found', 1000);
			//showTooltip($(btn), 'No set found!', 2000);
		}
	}
	function onCardSelect(card) {
        if (_selectionDone || _status == Status.over) return;
		if (_players.length > 1 && _player == null) {
			instruction('Select player first', 'error', 2000);
			return;
		}

		$(card).removeClass('hint').toggleClass('selected');
		var selection = $('.card.selected', _board);
		if (selection.length == 3) {
            _selectionDone = true;
			clearTimers();
			window.setTimeout(function(){
				checkSelection();
			}, 300);
		}
	}

	function checkSelection() {
		var check = [];
		var selection = $('.card.selected', _board);

		selection.each(function() { check.push(this) });
		cards().removeClass('hint selected');
        _selectionDone = false;

		if (checkSet(check)) {
			// correct SET
			selection.remove();
			var columns = $('#gameBoard .column');
			var movers = $('.column:last .card',_board);
			var moveIndex = 0;
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
    function autoPlay() {
        var set;

        set = findSet();
        if (set != null) {
            $(set).addClass('selected');

            // select random player
            var max = _players.length;
            var index = Math.floor(Math.random() * max);
            _player = _players[index];
            checkSelection();
            window.setTimeout(autoPlay, 500);
        }
        return true;
    }

	function playerWins() {
		if (_players.length < 2) {
			_player = _players[0];
		}
		if (_player == null) return;

		_player.wins++;
		var area = _player.area;
		area.find('.win-counter').html(_player.wins);
		area.removeClass('clicked');
		_player = null;
		// Queue
		emptyQueue();
	}

	function playerFail() {
		if (_players.length < 2) {
			_player = _players[0];
		}
		if (_player == null) return;
		_player.fails++;
		var area = _player.area;
		area.find('.fail-counter').html(_player.fails);
		area.removeClass('clicked');
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
		maximize: maximize
    };
})();

function showTooltip(target, text, msec) {
	var tip = document.getElementById('toolbarTip');
	tip.style.visibility = 'hidden';
	tip.style.display = 'block';
	var tt = $(tip);
	tip.innerHTML = text;
	var pos = target.offset();
	var width = tt.get(0).clientWidth;
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
function showMessage(text, mseconds) {
	var m = $('#message');
	m.text(text);
	m.css('top','-' + m.css('height'));
	m.animate({"top":0}, 500);
	window.setTimeout(hideMessage, mseconds);
}
function hideMessage() {
	var m = $('#message');
	var top = '-' + m.css('height');
	m.animate({"top": top}, 500);
}
function showDialog(id) {
	var wh = window.innerHeight;
	var ww = window.innerWidth;
	var dlg = $(id);
	dlg.parent().show();
	var dw = dlg.width();
	var dh;
	var innerHeight = 0;
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

	var css = {
		top: Math.max(Math.round((wh - dh)/2), 0),
		left: Math.max(Math.round((ww - dw)/2), 0),
		height: dh,
		width: dw
	}

	dlg.css(css);
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
		var storage = window.localStorage,
			x = '__storage_test__';
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


	var eventName = 'click';
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
