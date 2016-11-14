'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(8888);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/lieferung');
cms.data.webtype = cms.Enum.WebType.APPLICATION;
const path = require('path');

if (process.cwd().indexOf('lieferung') === -1) {
    try {
        process.chdir(path.resolve(__dirname, '../'));
        console.log('New directory: ' + process.cwd());
    } catch (err) {
    }
}

cms.use(require('cmsmon/mobile'));
require('./lieferung');
//require('./steuer');

// cms.data.online.autoOpenAdmin = true;

cms.menu = {
    top: '51px',
    bodyPaddingTop: '70px'
}

cms.server('backend/en', '');

// cms.data.online.wsAddress = 'ws://192.168.1.11:8888';
