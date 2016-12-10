'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(4444);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/kasse');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

process.chdir(require('path').resolve(__dirname, '../'));

cms.use(require('cmsmon/mobile'));

cms.data.online.autoOpenAdmin = true;

cms.menu = {
    top: '51px',
    bodyPaddingTop: '70px'
}

cms.server('backend/en', '');

let nodeServer;
var psTree = require('ps-tree');

const runServer = function () {
    nodeServer = require('child_process').exec('node --debug-brk=5555 --expose-debug-as=v8debug --harmony_destructuring --harmony-proxies --harmony_default_parameters ./backend/index.js');

    nodeServer.stdout.pipe(process.stdout);
};

var treeKill = require('tree-kill');
cms.app.get('/debug', function *(req, res) {
    process.chdir(require('path').resolve(__dirname, '../'));
    let _out = '';
    try {
        var out = require('child_process').execSync('git pull', 'utf-8');
        _out += out.toString() + '\n';

        console.log(out.toString());

        require('child_process').execSync('cp', 'utf-8');

        console.log('debug beginning');
        if (nodeServer) {
            treeKill(nodeServer.pid, 'SIGKILL', function () {
                runServer();
                res.send('begin');
            });
        } else {
            runServer();
            res.send('begin');
        }
    } catch (e) {
        console.warn(e);
    }
})

cms.app.get('/kill', function *(req, res) {
    console.log('debug stop');
    if (nodeServer) nodeServer.kill();
    setTimeout(function () {
        res.send('stop');
    }, 1000)
})

// cms.data.online.wsAddress = 'ws://localhost:8888';
