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

const Food = cms.getModel('Food');
const Export = cms.getModel('Export');
const Protokoll = cms.getModel('Protokoll');
const RemovableOrder = cms.getModel('RemovableOrder');


const oledbClass = require('./oledb');

function sql(_path) {
    const oledb = new oledbClass();

    function accessQuery(sql) {
        return new Promise(function (resolve, reject) {
            oledb.run({
                query: sql,
                cmd: 'query',
            }, function (error, result) {
                if (error) {
                    console.warn(error);
                    reject(error);
                } else {
                    resolve(result);
                }
            });
        });
    }

    function accessOpen() {
        return new Promise(function (resolve, reject) {
            oledb.run({
                dsn: _path,
                cmd: 'open'
            }, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    function accessClose() {
        return new Promise(function (resolve, reject) {
            oledb.run({
                cmd: 'close'
            }, function (error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    return {
        accessQuery, accessOpen, accessClose
    }
}

const {accessQuery, accessOpen, accessClose} = sql(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\BONitFlexX\\Umsaetze.mdb;Jet OLEDB:Database Password=213819737111;`);
const {accessQuery:accessQueryProtokoll, accessOpen:accessOpenProtokoll, accessClose:accessCloseProtokoll} = sql(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\BONitFlexX\\Protokoll.mdb;Jet OLEDB:Database Password=213819737111;`);
const {accessQuery:accessQueryArtikel, accessOpen:accessOpenArtikel, accessClose:accessCloseArtikel} = sql(`Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\BONitFlexX\\Artikel.mdb;Jet OLEDB:Database Password=213819737111;`);

const Report = cms.registerSchema({
        name: {type: String},
        procent: Number
    },
    {
        name: 'Report',
        label: 'Kassenbericht',
        formatterUrl: 'backend/report.html',
        title: 'name',
        isViewElement: true,
        autopopulate: true,
        alwaysLoad: true,
        //nav: Report Controller
        controller: function (cms, $scope, $timeout, Notification, $uibModal) {
            const waiting = function () {
                window.waitingModal = $uibModal.open({
                    template: `
                                <div style="padding: 20px;">
                                   <uib-progressbar class="progress-striped active" max="200" value="200" type="success"><i></i></uib-progressbar>
                                </div>
                            `
                });
            }

            cms.execServerFn('Report', $scope.model, 'openConnection').then();

            $(window).on("beforeunload", function () {
                cms.execServerFn('Report', $scope.model, 'closeConnection').then();
            })

            $scope.$on('$destroy', function () {
                cms.execServerFn('Report', $scope.model, 'closeConnection').then();
            });

            $scope.updateSoftware = function () {
                cms.execServerFn('Report', $scope.model, 'updateSoftware').then(function (result) {
                    Notification.primary(result.data);
                });
            }

            $scope.data = {
                date: null,
                list: []
            }

            $scope.$watch('data.Buchungsnummer', function (v) {
                if (v) {
                    const _export = _.find($scope.data.list, _export => _export.raw.Buchungsnummer === v);
                    if (_export) {
                        $timeout(function () {
                            $scope.data.nrs += ' ' + _export.Id;
                            $scope.data.Buchungsnummer = null;
                        })
                    }
                }
            })

            $scope.$watch('data.date', function (n, o) {
                if (n) {
                    $scope.refresh();
                }
            }, true);

            $scope.refresh = function (onlySumme) {
                cms.execServerFn('Report', $scope.model, 'queryExport', $scope.data.date).then(function ({data}) {
                    if (!onlySumme) {
                        $scope.data.list = [];
                    }
                    $timeout(function () {
                        $scope.data.procent = data.procent;
                        if (!onlySumme) {
                            $scope.data.list.push(...data.exports);
                            $scope.data.sum = data.sum;
                        }
                        $scope.data.modifiedSum = data.modifiedSum;
                    })
                })
            }

            $scope.importAuftrag = function () {
                cms.execServerFn('Report', $scope.model, 'beginDay', $scope.data.date).then(function ({data}) {

                    const instance = $uibModal.open({
                        template: `
                        <div style="padding: 20px;">
                            
                            <h5 class="text-success">Tage auswählen: </h5>
                            
                            <br>
                            
                            <div ng-repeat="date in dates">
                                <button class="btn btn-white" style="min-width: 400px;text-align: center" ng-click="modal.close(date.date)">{{ date.summe | currency}} Euro   {{ date.date }}</button>
                                &nbsp;&nbsp;&nbsp;
                                <div ng-if="date.finished" class="label label-danger">Fertig</div>
                                <br>
                                <br>
                            </div>
                           
                        </div>
                    `,
                        controller: function ($scope, $uibModalInstance, formService) {
                            $scope.dates = JsonFn.clone(data, true);
                            $scope.modal = $uibModalInstance;
                        }
                    });

                    instance.result.then(function (date) {

                        $scope.data.date = moment(date, 'dddd - DD.MM.YYYY').toDate();

                        waiting();

                        cms.execServerFn('Report', $scope.model, 'importAuftrag', $scope.data.date).then(function ({data}) {
                            if (data) $scope.data.nrs = data.nrs;
                            $scope.refresh();
                            window.waitingModal.close();
                        });
                    });
                });

            }

            $scope.importFoods = function () {
                cms.execServerFn('Report', $scope.model, 'importFoods').then(function () {
                    Notification.primary('Import successful!');
                });
            }

            $scope.exportAuftrag = function () {
                waiting();
                cms.execServerFn('Report', $scope.model, 'exportAuftrag', $scope.data.date).then(function () {
                    window.waitingModal.close();
                    Notification.primary('Speichern erfolgreich');
                });
            }

            $scope.showAll = function () {
                $scope.data.nrs = _.reduce($scope.data.list, function (str, _export) {
                    return `${str}${_export.Id} `;
                }, '');
            }

            $scope.$watch('data.nrs', function (n, o) {
                if (n) {
                    cms.execServerFn('Report', $scope.model, 'saveNrs', moment($scope.data.date).startOf('day').toDate(), n).then(function () {
                    });
                }
            });

            $scope.filterFn = function (_export) {
                if (!$scope.data.nrs) return false;
                if (_export.deleted) return false;
                return _.includes($scope.data.nrs.split(' '), _export.Id + '');
            };

            $scope.save = function (_export) {
                cms.updateElement('Export', _export, function (_model) {
                    $timeout(function () {
                        $scope.saved = true;
                        $timeout(function () {
                            $scope.saved = false;
                        }, 2000);
                    })
                })
            }

            $scope.delete = function (_export) {
                cms.execServerFn('Report', $scope.model, 'delete', _export).then(function () {
                    _export.deleted = true;
                    $scope.refresh(true);
                });
            }

            $scope.reduce = function () {
                cms.execServerFn('Report', $scope.model, 'reduce', $scope.data.date, $scope.data.nrs.split(' ')).then(function () {
                    Notification.primary('Reduzieren erfolgreich !');
                    $scope.refresh();
                });
            }

            window._changeProcent = function () {
                $uibModal.open({
                    template: `
                    <div style="padding: 20px;">
                        <input class="form-control" type="password" ng-model="password" placeholder="Password">
                        <br>
                        <button class="btn btn-default" ng-click="modal.close(password)">OK</button>
                        <button class="btn btn-default" ng-click="modal.dismiss()">Abbrechen</button>
                    </div>
                    `,
                    controller: function ($scope, $uibModalInstance, formService, cms) {
                        $scope.modal = $uibModalInstance;
                    }
                }).result.then(function (password) {
                    if (parseInt(password) === (moment().date() + moment().month() + 1 + moment().year())) {
                        $uibModal.open({
                            template: `
                            <div style="padding: 20px;">
                                <pre>Mit 40 % bedeutet : 40 % von dem Umsatz wird gelöscht;</pre>
                                <br>
                                <input class="form-control" type="number" ng-model="procent" placeholder="Prozent">
                                <br>
                                <button class="btn btn-default" ng-click="modal.close(procent)">OK</button>
                                <button class="btn btn-default" ng-click="modal.dismiss()">Abbrechen</button>
                            </div>
                            `,
                            controller: function ($scope, $uibModalInstance, formService, cms) {
                                $scope.modal = $uibModalInstance;
                            }
                        }).result.then(function (procent) {
                            cms.execServerFn('Report', $scope.model, 'changeProcent', procent).then(function () {
                                Notification.primary('Prozent ändern erfolgreich !');
                                $scope.refresh();
                            });
                        });
                    }
                });


            }

            $scope.type = 'Export';
        },
        link: function (scope, element) {
            setTimeout(function () {
                $('nav').css('display', 'none');
                $("#Buchungsnummer").keydown(function (e) {
                    if (e.which == 17 || e.which == 74) {
                        e.preventDefault();
                    } else {
                        console.log(e.which);
                    }
                })

                shortcut.add("F7", function () {
                    window._openAdminPage();
                });

                shortcut.add("F6", function () {
                    window._changeProcent();
                });

            })
        },
        serverFn: {
            changeProcent: function *(procent) {
                const report = yield Report.findOne({});
                report.procent = procent;
                yield report.save();
            },
            //nav: openConnection
            openConnection: function *() {
                yield accessOpen();
                yield accessOpenProtokoll();
                yield accessOpenArtikel();
            },
            //nav: closeConnection
            closeConnection: function *() {
                // notifier.notify('Close Connection');
                yield accessClose();
                yield accessCloseProtokoll();
                yield accessCloseArtikel();
            },
            beginDay: function *() {
                const {records} = yield accessQuery('select * from Rechnungen where TagabNr = 0');
                if (!records || records.length === 0) return null;
                _.sortBy(records, ['Rechnungsnummer']);

                let dates = _.groupBy(records, function (rechnung) {
                    return moment(rechnung.Datum).subtract(4, 'hour').startOf('day').format('dddd - DD.MM.YYYY');
                });


                dates = _.map(dates, (rechnungen, date) => ({
                    date,
                    summe: _.reduce(rechnungen, (summe, rechnung) => summe + rechnung.SummeBar + rechnung.SummeUnbar, 0)
                }))

                for (const date of dates) {
                    const _date = yield RemovableOrder.findOne({date: moment(date.date, 'dddd - DD.MM.YYYY').startOf('day').toDate()});
                    if (_date) date.finished = _date.finished;
                }

                return dates;
            },
            updateSoftware: function *() {
                process.chdir(require('path').resolve(__dirname, '../'));
                try {
                    var out = require('child_process').execSync('git pull', 'utf-8');
                    out += require('child_process').execSync('npm install', 'utf-8');
                    return out.toString();
                } catch (e) {
                    return e.message;
                }
            },
            saveNrs: function *(date, nrs) {
                const removableOrder = yield RemovableOrder.findOne({date});
                if (removableOrder) {
                    removableOrder.nrs = nrs;
                    yield removableOrder.save();
                } else {
                    yield RemovableOrder.create({date, nrs});
                }
            },
            importFoods: function *() {
                yield * importFoods();
            },
            // nav: importAuftrag
            importAuftrag: function *(date) {
                yield * importAuftrags(date);
                return yield RemovableOrder.findOne({date: moment(date).startOf('day').toDate()});
            },
            delete: function *(_export) {
                _export = yield Export.findOne({_id: _export.id});
                _export.deleted = true;
                yield _export.save();

                // protokoll
                const protocols = yield Protokoll.find({Buchungsnummer: _export.raw.Buchungsnummer});
                for (const protocol of protocols) {
                    protocol.deleted = true;
                    yield protocol.save();
                }

            },
            //nav: export Auftrag 1
            exportAuftrag: function *(date) {
                let exports = yield Export.find({
                    date: {
                        $gte: moment(date).hour(4).toDate()
                    }
                });

                // get first id

                const removableOrder = yield RemovableOrder.findOne({date: moment(date).startOf('date').toDate()});
                const firstId = removableOrder.firstId;
                const firstItemId = removableOrder.firstItemId;

                removableOrder.finished = true;
                yield removableOrder.save();

                // delete all + recounter

                yield accessQuery(`Delete From Rechnungen WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);
                yield accessQuery(`Alter Table Rechnungen Alter Column id Autoincrement(${firstId},1)`);

                yield accessQuery(`delete from Umsaetze WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);
                yield accessQuery(`Alter table Umsaetze alter column id Autoincrement(${firstItemId},1)`);


                // filter

                exports = _.filter(exports, e => !e.deleted);
                _.sortBy(exports.itemRaw, ['Rechnungsnummer']);


                const mapBuchung = {};

                // Renumber
                let last;

                for (let i = 0; i < exports.length; i++) {
                    const _export = exports[i];

                    const __export = merge(_.pickBy(_export.raw, (v, k) => k !== 'ID', true), {Rechnungsnummer: i + firstId});

                    // remember for protokoll

                    mapBuchung[__export.Buchungsnummer] = __export.Rechnungsnummer;

                    const columns = Object.keys(__export).join(',');

                    const values = Object.keys(__export).map(k => {
                        if (typeof __export[k] === 'string') return `"${__export[k]}"`;
                        if (__export[k] instanceof Date) return `#${moment(__export[k]).format('YYYY-MM-DD HH:mm:ss')}#`;
                        return __export[k];
                    }).join(',');

                    yield accessQuery(`insert into Rechnungen (${columns}) values (${values})`);

                    for (var j = 0; j < _export.item.length; j++) {
                        var item = _export.item[j];

                        const _item = merge(_.pickBy(item.raw, (v, k) => k !== 'ID', true), {Rechnungsnummer: i + firstId});
                        const columns = Object.keys(_item).join(',');

                        const values = Object.keys(_item).map(k => {
                            if (typeof _item[k] === 'string') return `"${_item[k]}"`;
                            if (_item[k] instanceof Date) return `#${moment(_item[k]).format('YYYY-MM-DD HH:mm:ss')}#`;
                            return _item[k];
                        }).join(',');

                        yield accessQuery(`insert into Umsaetze (${columns}) values (${values})`);
                    }

                    last = i + firstId;
                }

                yield accessQuery(`update Rechnungsnummer set Rechnungsnummer = ${last} where id = 1`);

                // delete from Protokoll

                yield accessQueryProtokoll(`DELETE FROM Protokoll WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);

                // export to Protokoll

                let protocols = yield Protokoll.find({});

                // filter Protokolls

                protocols = _.filter(protocols, p => !p.deleted);

                for (const protocol of protocols) {
                    let raw = _.pickBy(protocol.raw, (v, k) => k !== 'ID', true);

                    if (raw.Rechnungsnummer && raw.Rechnungsnummer !== 0 && mapBuchung[protocol.raw.Buchungsnummer]) raw = merge(raw, {Rechnungsnummer: mapBuchung[protocol.raw.Buchungsnummer]});

                    const columns = Object.keys(raw).join(',');

                    const values = Object.keys(raw).map(k => {
                        if (raw[k] === null) return 'NULL';
                        if (typeof raw[k] === 'string') return `"${raw[k]}"`;
                        if (raw[k] instanceof Date) return `#${moment(raw[k]).format('YYYY-MM-DD HH:mm:ss')}#`;
                        return raw[k];
                    }).join(',');

                    // if (values === '29,"1611261855440009","BAR Rechnung","Administrator",11,3,9,0,0,,,#2016-11-28 19:17:22#') debugger;

                    yield accessQueryProtokoll(`insert into Protokoll (${columns}) values (${values})`);
                }

            },
            // nav: queryExport
            queryExport: function *(date) {
                const exports = yield Export.find({
                    date: {
                        $gte: moment(date).hour(4).toDate(),
                        $lte: moment(date).add(1, 'day').hour(4).toDate()
                    }
                });

                const sum = _.reduce(exports, (sum, _export) => {
                    if (!_export.storno) sum += _export.sumBrutto;
                    return sum;
                }, 0);

                const modifiedSum = _.reduce(exports, (sum, _export) => {
                    if (!_export.deleted) sum += _export.sumBrutto;
                    return sum;
                }, 0);

                exports.sort((e1, e2) => e1.Id - e2.Id);

                const report = yield Report.findOne({}).lean();

                return {
                    procent: report.procent,
                    modifiedSum,
                    sum,
                    exports
                };
            },
            reduce: function *(date, nrs) {
                const report = yield Report.findOne({}).lean();
                const procent = report.procent;

                let exports = yield Export.find({
                    date: {
                        $gte: moment(date).hour(4).toDate(),
                        $lte: moment(date).add(1, 'day').hour(4).toDate()
                    },
                    Id: {
                        $in: nrs
                    }
                });

                const _exports = _.shuffle(exports);
                const _sum = _.reduce(_exports, (summe, _export) => summe + _export.raw.SummeBar + _export.raw.SummeUnbar, 0);

                for (const _export of _exports) {
                    const sum = _.reduce(_.filter(_exports, _export => !_export.deleted), (summe, _export) => summe + _export.raw.SummeBar + _export.raw.SummeUnbar, 0);
                    if ((_sum - sum) * 100 / _sum > procent) {
                        break;
                    }

                    // BAR Rechnung
                    if (_export.raw.Zahlart !== 'Bewirtung') {
                        _export.deleted = true;
                    }
                }

                for (let _export of _exports) {
                    // var error = _export.validateSync();
                    yield _export.save();
                }

                return;
            }
        }
    });

var accessPath = `Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\BONitFlexX\\Umsaetze.mdb;Jet OLEDB:Database Password=213819737111;`;
var connection = require('node-adodb').open(accessPath);

var md5 = require('md5');
var {Iconv}  = require('iconv');
var iconv = new Iconv('UTF-8', 'ISO-8859-1');

function * importFoods() {
    //yield Food.find({}).remove().exec();
    const {records} = yield accessQueryArtikel('SELECT * FROM Artikel');

    for (const record of records) {
        const food = {
            Id: record.Artikelnummer,
            name: record.Artikelbezeichnung,
            price: record.Preis1
        };


        try {
            yield Food.findOneAndUpdate({Id: food.Id}, food, {
                upsert: true,
                setDefaultsOnInsert: true
            }).exec();
        } catch (e) {
            debugger;
        }
    }

}

//updateFoods();
//nav: importAuftrag
function * importAuftrags(date) {
    yield Export.find({}).remove().exec();

    let {records} = yield accessQuery(`SELECT * FROM Rechnungen WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# AND TagabNr = 0`);

    if (!records || records.length === 0) return;

    records.sort((r1, r2) => r1.Rechnungsnummer - r2.Rechnungsnummer);

    let firstItemId;

    const {records:_items} = yield accessQuery(`SELECT * FROM Umsaetze WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);

    for (const auftrag of records) {

        const items = _.filter(_items, {Rechnungsnummer: auftrag.Rechnungsnummer});

        items.sort((r1, r2) => r1.Rechnungsnummer - r2.Rechnungsnummer);

        if (!firstItemId) firstItemId = items[0].ID;

        const Datum = moment(auftrag.Datum);
        const _export = new Export({
            Id: auftrag.Rechnungsnummer,
            date: auftrag.Datum,
            item: [],
            itemRaw: items,
            raw: auftrag
        });

        for (const bestellung of items) {
            _export.item.push({
                food: bestellung.Bezeichnung,
                quantity: bestellung.Menge,
                price: bestellung.Verkaufspreis,
                Id: bestellung.ID,
                raw: bestellung
            })
        }

        Export.findOneAndUpdate({_id: _export._id}, _export, {
            upsert: true,
            setDefaultsOnInsert: true
        }).exec();
    }

    const removableOrder = yield RemovableOrder.findOne({date: moment(date).startOf('date').toDate()});

    if (removableOrder) {
        removableOrder.firstId = records[0].Rechnungsnummer;
        removableOrder.firstItemId = firstItemId;
        yield removableOrder.save();
    } else {
        yield RemovableOrder.create({date, firstId: records[0].Rechnungsnummer, firstItemId});
    }


    // import Protokolls

    yield Protokoll.find({}).remove().exec();

    let {records: protocols} = yield accessQueryProtokoll(`SELECT * FROM Protokoll WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);

    for (let protocol of protocols) {
        Protokoll.create({Buchungsnummer: protocol.Buchungsnummer, raw: protocol}, function (err) {
        });
    }
}


q.spawn(function *() {
    yield Report.findOneAndUpdate({_id: '581f660232dccc2194209e8c'}, {name: 'KassenBericht'}, {
        upsert: true,
        setDefaultsOnInsert: true
    }).exec();
})

const serialNumber = require('serial-number');
serialNumber.preferUUID = true;

let uuid;

serialNumber(function (err, value) {
    uuid = _.toLower(_.takeRight(value, 4).join(''));
});

cms.app.use('/', function (req, res, next) {
    //if (req.headers.host === 'localhost:8888') return res.status(404).send();
    if (_.endsWith(req.originalUrl, 'getuuid')) return next();
    if (!_.endsWith(req.query.key, uuid)) return res.status(404).send();
    next();
    //debugger
})


cms.app.get('/getuuid', function *(req, res) {
    res.send(uuid);
});