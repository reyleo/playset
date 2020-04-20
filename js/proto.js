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
var created = Player(1222);
console.log(loaded);
console.log('Player %s has %d points', loaded.name, loaded.points());
console.log('\nCreated: ');
console.log(created);
