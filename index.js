var nexe = require('nexe');
const path = require('path');

nexe.compile({
    input: path.resolve(__dirname, 'backend/index.js'),
    flags: true,
    jsFlags: "--use_strict --harmony_destructuring --harmony-proxies --harmony_default_parameters",
    framework: "node"
}, function (err) {
    if (err) {
        return console.log(err);
    }
    // do whatever
});
