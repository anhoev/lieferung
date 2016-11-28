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

cms.app.get('/debug', function *(req, res) {
    process.chdir(require('path').resolve(__dirname, '../'));
    let _out = '';
    try {
        var out = require('child_process').execSync('git pull', 'utf-8');
        _out += out.toString() + '\n';
        console.log(out.toString());
        nodeServer = require('child_process').exec('npm test');
        console.log(out.toString());
    } catch (e) {
        console.warn(e);
    }
    return _out;
})

cms.app.get('/kill', function *(req, res) {
    if (nodeServer) nodeServer.kill();
})

// cms.data.online.wsAddress = 'ws://localhost:8888';
