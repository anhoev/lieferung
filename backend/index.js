'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(8888);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/store-manager');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

cms.use(require('cmsmon/mobile'));
require('./store-manager');

cms.data.online.autoOpenAdmin = true;

cms.server('backend/en', '');

// cms.data.online.wsAddress = 'ws://192.168.1.5:8886';