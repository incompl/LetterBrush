// https://github.com/incompl/super-inherit/
window.inherit = function(parent, o) {
    var result;
    function F() {}
    F.prototype = parent;
    result = new F();
    if (o) {
        for (var key in o) {
            if (o.hasOwnProperty(key)) {
                result[key] = o[key];
            }
        }
    }
    return result;
};