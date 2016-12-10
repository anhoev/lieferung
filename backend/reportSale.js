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

const {
    accessQuery, accessOpen, accessClose,
    accessQueryProtokoll, accessOpenProtokoll, accessCloseProtokoll,
    accessQueryArtikel, accessOpenArtikel, accessCloseArtikel
} = cms.utils.access;

const Category = cms.getModel('Category');
const Food = cms.getModel('Food');
const Export = cms.getModel('Export');
const Protokoll = cms.getModel('Protokoll');
const RemovableOrder = cms.getModel('RemovableOrder');

const ReportSale = cms.registerSchema({
        name: {type: String},
        beginDate: Number
    },
    {
        name: 'ReportSale',
        label: 'VerkaufBericht',
        formatterUrl: 'backend/report-sale.html',
        title: 'name',
        isViewElement: false,
        autopopulate: true,
        alwaysLoad: true,
        controller: function (cms, $scope, $timeout, Notification, $uibModal) {
            $scope.data = {
                month: new Date()
            };

            $scope.$watch('data.month', (month) => {
                $scope.data.from = moment(month).clone().subtract(1, 'months').date($scope.model.beginDate).hour(4).toDate();
                $scope.data.to = moment(month).clone().date($scope.model.beginDate).hour(4).toDate();
            })

            $scope.report = function () {
                cms.execServerFn('ReportSale', $scope.model, 'report', $scope.data.from, $scope.data.to, $scope.data.type).then(function (data) {

                })
            }
        },
        serverFn: {
            report: function *(from, to, type) {
                const {records: buchungen} = yield accessQuery(`SELECT * FROM Umsaetze WHERE Datum Between #${moment(from).format('YYYY-MM-DD HH:00:00')}# And #${moment(to).format('YYYY-MM-DD HH:00:00')}#`);
                for (const buchung of buchungen) {
                    
                }
                debugger
            }
        }
    });

q.spawn(function *() {
    const reportSale = yield ReportSale.findOne({});

    if (!reportSale) {
        yield ReportSale.findOneAndUpdate({}, {name: 'VerkaufBericht'}, {
            upsert: true,
            setDefaultsOnInsert: true
        }).exec();
    }
})