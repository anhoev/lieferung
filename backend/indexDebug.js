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

cms.app.get('/debug', function *(req, res) {
    process.chdir(require('path').resolve(__dirname, '../'));
    let _out = '';
    try {
        var out = require('child_process').execSync('git pull', 'utf-8');
        _out += out.toString() + '\n';
        console.log(out.toString());
        return _out;
        out = require('child_process').execSync('npm test', 'utf-8');
        _out += out.toString();
        console.log(out.toString());
    } catch (e) {
        console.warn(e);
    }

})

// cms.data.online.wsAddress = 'ws://localhost:8888';
