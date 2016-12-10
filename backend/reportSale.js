'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const cms = require('cmsmon').instance;
const moment = require('moment-timezone');
const q = require('q');
const fs = require('fs');
moment.tz.setDefault("Europe/Berlin");
const _merge = require('extend');
function merge() {
    return _merge(true, ...arguments);
}

cms.app.use('/shortcut.js', cms.express.static(path.resolve(__dirname, 'shortcut.js')));

const notifier = require('node-notifier');

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const Category = cms.getModel('Category');
const Food = cms.getModel('Food');
const Export = cms.getModel('Export');
const Protokoll = cms.getModel('Protokoll');
const RemovableOrder = cms.getModel('RemovableOrder');

const ReportSale = cms.registerSchema({
        name: {type: String}
    },
    {
        name: 'ReportSale',
        label: 'VerkaufBericht',
        formatterUrl: 'backend/report-sale.html',
        title: 'name',
        isViewElement: true,
        autopopulate: true,
        alwaysLoad: true,
        controller: function (cms, $scope, $timeout, Notification, $uibModal) {
            $scope.data = {

            };
        },
        serverFn: {
        }
    });

q.spawn(function *() {
    yield ReportSale.findOneAndUpdate({}, {name: 'VerkaufBericht'}, {
        upsert: true,
        setDefaultsOnInsert: true
    }).exec();
})