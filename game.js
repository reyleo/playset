var _Game = (function($){

var version = "0.040";

function Card(p) {
    this.color = p[0];
    this.shape = p[1];
    this.quantity = p[2] + 1;
    this.fill = p[3];
	this.dom = null;
	this.orientation = 'vertical';
}

Card.prototype.toString = function() {
	return this.color + ', ' + this.shape + ', ' + this.quantity + ', ' + this.fill;
}
var svgNS = "http://www.w3.org/2000/svg";
var xlinkNS = "http://www.w3.org/1999/xlink";
Card.prototype._shapes = ["pill", "curve", "rhomb"];
Card.prototype._colors = ["red", "green", "purple"];
Card.prototype._fills = ["empty", "filled", "stripes"];

Card.prototype.render = function() {
	var svg, symbol;
	if (this.dom != null) {
		if (this.dom.hasChildNodes()) {
			this.dom.removeChild(this.dom.firstChild);
		}

		var group = document.createElement('div');
		group.className = 'group' + " group" + this.quantity;
		for (var i = 0; i < this.quantity; i++) {
			svg = document.createElementNS(svgNS, "svg");
			svg.setAttribute('class', "symbol");
			svg.setAttribute('viewBox','0 0 200 100');
			svg.style.width = "100%";
			//svg.setAttributeNS("http://www.w3.org/2000/xmlns", "xlink", "http://www.w3.org/1999/xlink");

			symbol = document.getElementById("symbol-" + this._shapes[this.shape]).cloneNode();
			symbol.removeAttribute('id');
			/*
			symbol = document.createElementNS(svgNS, "use");
			symbol.setAttribute('x', '0');
			symbol.setAttribute('y', '0');
			symbol.setAttributeNS(xlinkNS, 'href', "#" + this._shapes[this.shape]);
			*/
			symbol.setAttribute('class', this._colors[this.color] + " " + this._fills[this.fill]);


			svg.appendChild(symbol);
			group.appendChild(svg);
		}
		this.dom.appendChild(group);
	}
};

var Game = (function(){

    var _board = null;
    var _cardsLeft = 0;
    var _deck = [];
	var _next = 0;
	var _counter = null;
	var boardPadding = 0;
	var _players = [];
	var _player = null;
	var _queue = [];
	var _timer = null;
	var _countDown;
	var _setup = {
		player: 0,
		next: false
	};
	var _eventName = "";
    var _selectionDone = false;
	var config = {
		rows: 3,
		columns: 4,
		maxColumns: 5,
		cardHeight: 200,
		cardWidth: 300,
		keepScore: true,
		maxTime: 10,
        showSetOnHint: false,
		colors: ['#fea3aa', '#f8b88b', '#faf884', '#baed91', '#b2cefe', '#f2a2e8']
	};

    var _debug = true;
    var debug = function(str) {
        if (_debug) {
            window.console.log(str);
        }
    };

    function deal(animation) {
		var animate = animation || false;
        var places = document.querySelectorAll('#gameBoard .cardHolder');
		var elem, card, count = 0;

		for (var i = 0; i < places.length; i++) {
			elem = places[i].querySelector('.card');
			if (elem == null) {
				card = next();
				if (card != null) {
					elem = document.createElement('div');
					elem.className = 'card';
					$(elem).css(cardCss());
					places[i].appendChild(elem);
					elem.card = card;
					card.dom = elem;
					card.render();
                    count++;
					if (animate) {
						//elem.style.display = 'none';
						/*
						$(elem).css('width', 0);
						$(elem).animate({width: config.cardWidth + 'px'}, 500);
						*/
						$(elem).css('margin-left', '-25%');
						$(elem).css('opacity', 0);
						$(elem).animate({'margin-left': 0, 'opacity': 1}, 400);

					}
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

	function checkForMore() {
        var setNotFound = findSet() == null;
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
        instruction("Game over!", 'normal', 2000);
        var winners = [];
        var maxPoints = -999;
        var player, points, i;
        for (i = 0; i < _players.length; i++) {
            player = _players[i];
            points = player.wins - player.fails;
            if (points == maxPoints) {
                winners.push(player);
            } else if (points > maxPoints) {
                winners = [];
                winners.push(player);
                maxPoints = points;
            }
        }
        debug("Max points " + maxPoints + ", winners = " + winners.length);
        for (i = 0; i < winners.length; i++) {
            winners[i].area.addClass('winner');
        }

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

			if (combination[n] >= max) {
				for (k = n, m = max-1; k >=0; k--,m--) {
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

			} else {
				combination[n]++;
			}


		} while (true);
        debug("findSet - not found in " + cards.length + " cards");
		return null;
	}

	function nextCombination(p, max) {
		var pos = p.length - 1,
			pos2;

		if (p[pos] >= max) {
			p[pos] = 0;
			pos2 = pos - 1;
			while (pos2 >= 0) {
				if (p[pos2] >= max) {
					p[pos2] = 0;
					pos2--;
				} else {
					p[pos2]+= 1;
					break;
				}
			}

			if (pos2 < 0) return false;

		} else {
			p[pos] += 1;
		}
		return true;
	}

	function restart() {
		_next = 0;
		clear();
		shuffle();
		deal();
        checkForMore();
		if (!config.keepScore) {
			resetScore();
		}
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
		$('.player-area').removeClass('clicked winner');
		$('#gameBoard .column').each(function(index){
			if (index > config.columns-1) {
				$(this).remove();
			}
		});
	}

    function commandMore() {
        addMore();
        deal(true);
    }

	function addMore() {
		var columns = $('#gameBoard .column');
		if (columns.length == config.maxColumns) return false;
		appendColumn();
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
		var w2 = Math.floor(boardWidth * 0.18);
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

	function resize() {
		var newHeight = calcHeight();
		if (config.cardHeight != newHeight) {
			calcCardSize();
			$('.card', _board).css(cardCss());
			$('.cardHolder', _board).css(cardHolderCss());
			$('.column', _board).width(config.cardWidth);
		}
		resizePlayers('player-top');
		resizePlayers('player-bottom');
		resizePlayers('player-right');
		resizePlayers('player-left');

	}
	
	function maximize(on) {
		if (_players.length > 1) return;
		var property = 'padding-' + _players[0].position;
		var defaultPadding = '36pt'; 
		var padding = defaultPadding;
		if (on) {
			padding = '0';
		}
		var css = {
			'padding-top':    padding, 
			'padding-right':  padding,
			'padding-bottom': padding,
			'padding-left':   padding
		};
		if (on) {
			css[property] = defaultPadding;
			css['padding-top'] = defaultPadding;
		}
		
		$('#gameContainer').css(css);
		resize();
	}
	
    function init() {
		_board = document.getElementById("gameBoard");

        $('#gameInfo').html(version);

		var offset = $(_board).offset();
		boardPadding = offset.top;
		calcCardSize();

        var i;
        for (i = 0; i < config.columns; i++) {
			appendColumn();
        }

		var MAX_VAL = 2;
		// fill cards
		var p = [0, 0, 0, 0];

		var cardIndex = 0;
		do {
			_deck[cardIndex++] = new Card(p);
		} while (nextCombination(p, MAX_VAL));

		_counter = document.getElementById('counter');
		restart();

		// event handlers
		_eventName = 'click';
		if ('ontouchstart' in document.documentElement) {
			_eventName = 'touchstart';
		}

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
			.prop('checked', config.keepScore)
			

		$('#setupDialog .close').on(_eventName, function() {
			hideDialog('#setupDialog');
			$(_board).show();
			resize();
		});

		// create 1 player
		createPlayers(1);
		_players[0].area = createArea('player-bottom');
		_players[0].layout = 'horizontal';
		_players[0].class = "player-bottom";
		_players[0].position = "bottom";
		initPlayers();
    }

	function setup() {
		showDialog('#setupDialog');
		$(_board).hide();
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
			} else {
				area = null;
				window.setTimeout(setupPlayer, 1000);
				instruction('Incorrect place. Please try again', 'error');
				return;
			}
			if (playerClass != "") {
				player.area = createArea(playerClass);
				player.class = playerClass;
				if (_setup.next && _setup.player < _players.length-1) {
					_setup.player++;
					window.setTimeout(setupPlayer, 10);
				} else {
					$(_board).show();
					$('#gameMessage').hide();
					initPlayers();
				}

			}
		});
	}

	function createArea(playerClass) {
		var area = $('<div class="player-area"></div>');
		var contents = $('<div class="player-contents"></div');
		area.addClass(playerClass).appendTo($('body'));
		resizePlayers(playerClass);
		if (playerClass == 'player-bottom' || playerClass == 'player-left') {
			contents.append('<div class="win-counter">0</div><div class="fail-counter">0</div>')
		} else {
			contents.append('<div class="fail-counter">0</div><div class="win-counter">0</div>')
		}
		area.append(contents);
		//area.append('<div>' + (_setup.player+1) + '</div>');
		//area.css('backgroundColor', config.colors[_setup.player]);
		area.data('player', _setup.player);
		return area;
	}

	function initPlayers() {
		$('.player-area').on(_eventName, function(){
			// exit if not first :)
			var clicked = $(this);
			var clickedId = clicked.data('player');

			if (_player != null) {
				if (_player.id != clickedId) {
					_queue.push(_players[clickedId]);
					clicked.addClass('queue');
				}
				return;
			}

			$('#gameMessage').hide();
			_player = _players[clickedId];
			clicked.addClass('clicked');

			// Queue
			_queue = [];

			// Timer
			startTimer(clicked);
		});
	}

	function startTimer(area) {
		_countDown = config.maxTime + 1;
		area.append('<div class="player-timer"></div>');
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
		document.getElementById('audio-error').play();
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
			instruction('Set exists!', 'green', 2000);
			//showTooltip($(btn), 'Set exists!', 2000);
			if (config.showSetOnHint) $(set).addClass('hint');
		} else {
			instruction('Not found!', 'error', 2000);
			//showMessage('No set found', 1000);
			//showTooltip($(btn), 'No set found!', 2000);
		}
	}
	function onCardSelect(card) {
        if (_selectionDone) return;
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
		if (_queue.length > 0) {
			$('.player-area').removeClass('queue');
            _queue = [];
		}
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
		if (_queue.length > 0) {
			_player = _queue.shift();
			_player.area.removeClass('queue').addClass('clicked');
			startTimer(_player.area);
		}
	}

    return {
        init: init,
		hint: hint,
		more: commandMore,
		restart: restart,
		setup: setup,
		resize: resize,
        autoPlay: autoPlay,
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
	var dh = dlg.height();
	var position = {
		top: Math.round((wh - dh)/2),
		left: Math.round((ww - dw)/2)
	}
	dlg.css(position);
}
function hideDialog(id) {
	$('#setupDialog').parent().hide();
}
function updateReady() {
    //alert("Update available!");
    window.applicationCache.update();
    window.applicationCache.swapCache();
    alert("Version " + version + " installed");
}

$(document).ready(function(){
    /*
    if (window.applicationCache) {
        window.applicationCache.addEventListener('updateready', updateReady, false);
    }
    */

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
	
	$('#btnMax').on(eventName, function() {
		var on = $(this).data('on');
		if (typeof on === 'undefined') { 
			on = true;
		} else {
			on = !on;
		}
		Game.maximize(on);
		$(this).data('on', on);
		menuSwitch();
	});
	
	$(window).on('resize', function(){
		Game.resize();
	});
});

function menuSwitch() {
	var menu = $('#controls');
	if (menu.is(':visible')) menu.hide(300);
	else menu.show(300);
}
return Game;
})(window.jQuery);
