function next(p, max) {
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
var comb = [0, 0, 0, 0]
var iter = 1;
do {
    console.log('' + iter + ':' + comb.toString());
    iter++;
} while (next(comb, 2));

