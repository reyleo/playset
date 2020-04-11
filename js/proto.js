function Player(id) {
    this.id = id;
    this.name = "";
    this.wins = 0;
    this.fails = 0;
    this.layout = '';
    this.class = '';
    this.position = '';
    this.area = null;
}
Player.prototype.points = function() {
    return this.wins - this.fails;
};

function loadPlayer(jsObj) {
    return Object.assign(new Player(), jsObj);
}

var obj = {
    id: 2,
    name: 'Andrei',
    wins: 3,
    fails: 1,
    layout: 'a',
    class: 'left',
    position: 'top'
}

var loaded = loadPlayer(obj);
console.log(loaded);
console.log('Player %s has %d points', loaded.name, loaded.points());
