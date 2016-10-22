'use strict';
const _ = require('lodash');
const cms = require('cmsmon');
cms.data.security = false;
cms.listen(8888);
cms.resolvePath = (p) => `backend/${p}`;
cms.mongoose.connect('mongodb://localhost/lieferung');
cms.data.webtype = cms.Enum.WebType.APPLICATION;

cms.use(require('cmsmon/mobile'));
require('./lieferung');

// cms.data.online.autoOpenAdmin = true;

cms.menu = {
    top: '51px',
    bodyPaddingTop: '70px'
}

cms.server('backend/en', '');

cms.data.online.wsAddress = 'ws://localhost:8888';

var md5 = require('md5');

var {Iconv}  = require('iconv');
var iconv = new Iconv('UTF-8','ISO-8859-1');
var label = iconv.convert('2 1 1 7,2 7,2 7,2 * Groß 7,2');

console.log(md5(label));

const path = require('path');
var source = path.join(__dirname, 'express.mdb');

var ADODB = require('node-adodb'),
    connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${source};`);

connection
    .query('SELECT * FROM Bestellung')
    .on('done', function (data){
        console.log();
    })
    .on('fail', function (data){
    });