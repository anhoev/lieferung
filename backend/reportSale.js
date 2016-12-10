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
const Material = cms.getModel('Material');
const Benutzen = cms.getModel('Benutzen');

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
            const waiting = function () {
                window._waitingModal = $uibModal.open({
                    template: `
                                <div style="padding: 20px;">
                                   <uib-progressbar class="progress-striped active" max="200" value="200" type="success"><i></i></uib-progressbar>
                                </div>
                            `
                });
            }

            $scope.data = {
                type: 'Artikel',
                month: new Date()
            };

            $scope.$watch('data.month', (month) => {
                $scope.data.from = moment(month).clone().subtract(1, 'months').date($scope.model.beginDate).hour(4).toDate();
                $scope.data.to = moment(month).clone().date($scope.model.beginDate).hour(4).toDate();
            })

            $scope.report = function () {
                waiting();
                cms.execServerFn('ReportSale', $scope.model, 'report', $scope.data.from, $scope.data.to, $scope.data.type).then(function ({data}) {
                    window._waitingModal.close();
                    $scope.groups = data;
                })
            }
        },
        serverFn: {
            report: function *(from, to, type) {
                const {records: buchungen} = yield accessQuery(`SELECT * FROM Umsaetze WHERE Datum Between #${moment(from).format('YYYY-MM-DD HH:00:00')}# And #${moment(to).format('YYYY-MM-DD HH:00:00')}#`);

                if (type === 'Artikel') {
                    const foods = yield Food.find({}).lean();

                    for (const buchung of buchungen) {
                        const food = _.find(foods, f => f.name === buchung.Bezeichnung);
                        if (!food) continue;
                        if (!food.quantity) food.quantity = 0;
                        food.quantity++;
                    }

                    const groups = _.groupBy(foods, food => food.category.name);

                    return groups;
                } else {
                    const Benutzens = yield Benutzen.find({}).lean();
                    const materials = yield Material.find({}).lean();

                    for (const buchung of buchungen) {
                        const benutzen = _.find(Benutzens, m => m.food.name === buchung.Bezeichnung);
                        if (!benutzen) continue;
                        if (!benutzen.quantity) benutzen.quantity = 0;
                        benutzen.quantity ++ ;
                    }

                    materials
                }
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