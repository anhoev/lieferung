'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(1234);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/kasse', {server: {reconnectTries: Number.MAX_VALUE}});
cms.data.webtype = cms.Enum.WebType.APPLICATION;

process.chdir(require('path').resolve(__dirname, '../'));

cms.use(require('./user'));

cms.use(require('cmsmon/mobile'));
require('./lieferung');
require('./kasse');
require('./reportSale');

// cms.data.online.autoOpenAdmin = true;

cms.menu = {
    top: '51px',
    bodyPaddingTop: '70px'
}

cms.server('backend/en', '');


// cms.data.online.wsAddress = 'ws://localhost:8888';
