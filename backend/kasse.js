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

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const oledb = require('./oledb');

const Food = cms.getModel('Food');
const Export = cms.getModel('Export');
const RemovableOrder = cms.getModel('RemovableOrder');

const Report = cms.registerSchema({
        name: {type: String}
    },
    {
        name: 'Report',
        label: 'Kassenbericht',
        formatterUrl: 'backend/report.html',
        title: 'name',
        isViewElement: false,
        autopopulate: true,
        alwaysLoad: true,
        //nav: Report Controller
        controller: function (cms, $scope, $timeout, Notification) {
            cms.execServerFn('Report', $scope.model, 'openConnection').then();

            $scope.updateSoftware = function () {
                cms.execServerFn('Report', $scope.model, 'updateSoftware').then(function (result) {
                    Notification.primary(result.data);
                });
            }

            $scope.data = {
                date: new Date(),
                list: []
            }

            $scope.$watch('data.date', function (n, o) {
                if (n) {
                    $scope.refresh();
                }
            }, true);

            $scope.refresh = function () {
                cms.execServerFn('Report', $scope.model, 'queryExport', $scope.data.date).then(function ({data}) {
                    $scope.data.list = [];
                    $timeout(function () {
                        $scope.data.list.push(...data.exports);
                        $scope.data.sum = data.sum;
                        $scope.data.modifiedSum = data.modifiedSum;
                    })
                })
            }

            $scope.importAuftrag = function () {
                cms.execServerFn('Report', $scope.model, 'importAuftrag', $scope.data.date).then(function ({data}) {
                    if (data) $scope.data.nrs = data.nrs;
                    $scope.refresh();
                });
            }

            $scope.importFoods = function () {
                cms.execServerFn('Report', $scope.model, 'importFoods').then(function () {
                    confirm('Import successful!');
                });
            }

            $scope.exportAuftrag = function () {
                cms.execServerFn('Report', $scope.model, 'exportAuftrag', $scope.data.date).then(function () {
                    confirm('Export successful!');
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
                });
            }

            $scope.reduce = function () {
                cms.execServerFn('Report', $scope.model, 'reduce', $scope.data.date, $scope.data.sum - $scope.data.total, $scope.data.nrs.split(' ')).then(function () {
                    confirm('Reduzieren erfolgreich !');
                    $scope.refresh();
                });
            }

            $scope.type = 'Export';
        },
        serverFn: {
            openConnection: function *() {
                yield accessOpen();
            },
            updateSoftware: function *() {
                process.chdir(require('path').resolve(__dirname, '../'));
                var cmd = 'git pull';
                try {
                    var out = require('child_process').execSync(cmd, 'utf-8');
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
            },
            //nav: export Auftrag 1
            exportAuftrag: function *(date) {
                let exports = yield Export.find({
                    date: {
                        $gte: moment(date).hour(4).toDate()
                    }
                });

                // get first id

                const removableOrder = yield RemovableOrder.findOne({date: moment(date).startOf('date').toDate()}).lean();
                const firstId = removableOrder.firstId;
                const firstItemId = removableOrder.firstItemId;

                // delete all + recounter

                yield accessQuery(`Delete From Rechnungen WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);
                yield accessQuery(`Alter Table Rechnungen Alter Column id Autoincrement(${firstId},1)`);

                yield accessQuery(`delete from Umsaetze WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);
                yield accessQuery(`Alter table Umsaetze alter column id Autoincrement(${firstItemId},1)`);


                // filter

                exports = _.filter(exports, e => !e.deleted);
                _.sortBy(exports.itemRaw, ['Rechnungsnummer']);

                // Renumber

                for (let i = 0; i < exports.length; i++) {
                    const _export = exports[i];

                    const __export = merge(_.pickBy(_export.raw, k => ['ID'].indexOf(k) === -1, true), {Rechnungsnummer: i + firstId});
                    const columns = Object.keys(__export).join(',');

                    const values = Object.keys(__export).map(k => {
                        if (typeof __export[k] === 'string') return `"${__export[k]}"`;
                        if (__export[k] instanceof Date) return `${moment(date).format('YYYY-MM-DD HH:mm:ss')}`;
                        return __export[k];
                    }).join(',');

                    yield accessQuery(`insert into Rechnungen (${columns}) values (${values})`);
                }


                // renumber for rechnungen

                exports = yield Export.find({
                    date: {
                        $gte: moment(date).hour(4).toDate(),
                        $lte: moment(date).add(1, 'day').hour(4).toDate()
                    }
                });

                exports.sort((e1, e2) => e1.Id - e2.Id);
                for (let i = 0; i < exports.length; i++) {
                    const _export = exports[i];
                    if (_export.Id !== i + firstId) {
                        const id = i + firstId;
                        _export.Id = id;
                        yield _export.save();
                        yield accessQuery(`UPDATE Rechnungen SET Rechnungsnummer = ${id} WHERE Buchungsnummer = "${_export.raw.Buchungsnummer}"`);
                        yield accessQuery(`UPDATE Umsaetze SET Rechnungsnummer = ${id} WHERE Buchungsnummer = "${_export.raw.Buchungsnummer}"`);
                    }
                }

                yield * exportAuftrags2(date);
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
                    if (!_export.storno) sum += _export.modifiedSumBrutto;
                    return sum;
                }, 0);

                exports.sort((e1, e2) => e1.Id - e2.Id);

                return {
                    modifiedSum,
                    sum,
                    exports
                };
            },
            reduce: function *(date, sTotal, nrs) {
                let exports = yield Export.find({
                    date: {
                        $gte: moment(date).startOf('day').toDate(),
                        $lte: moment(date).endOf('day').toDate()
                    },
                    Nr: {
                        $in: nrs
                    }
                });

                const _exports = _.shuffle(exports);

                const progress = function () {
                    for (let _export of _exports) {
                        let _item = _.find(_export.item, i => i.food.category === 'Hauptspeise');
                        if (!_item) _item = _export.item[0];

                        if (_item.food.removable) {
                            _item.modifiedQuantity = _item.quantity;
                            for (let i = 0; i < _item.quantity - 1; i++) {
                                _item.modifiedQuantity -= 1;
                                sTotal -= _item.price;
                                if (sTotal < 0) return;
                            }
                        }

                        for (var item of _export.item) {
                            if (item !== _item && item.food.removable) {
                                item.modifiedQuantity = item.quantity;
                                for (let i = 0; i < item.quantity; i++) {
                                    item.modifiedQuantity -= 1;
                                    sTotal -= item.price;
                                    if (sTotal < 0) {
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }

                progress();

                for (let _export of exports) {
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
    yield Food.find({}).remove().exec();
    console.time('access');
    const {records} = yield accessQuery('SELECT * FROM Artikel');
    console.timeEnd('access');
    yield * _importFoods(records);
}

function * _importFoods(records) {
    yield Food.find({}).remove().exec();
    for (const record of records) {
        const food = new Food({
            Id: record.Artikel_ID,
            name: record.Bezeichnung,
            category: record.Kategorie2,
            removable: record.EANcode !== 'X'
        });

        const save = function *() {
            console.time('mongo-save');
            yield Food.findOneAndUpdate({_id: food._id}, food, {
                upsert: true,
                setDefaultsOnInsert: true
            }).exec();
            console.timeEnd('mongo-save');
        }

        yield * save();

        console.time('access');
        const data = yield accessQuery(`SELECT * FROM Karte WHERE Artikel_ID = "${record.Artikel_ID}" AND PListe_ID = 1`);
        console.timeEnd('access');
        if (data) {
            if (data.records[0]) {
                food.price = data.records[0].Preis;
                yield * save();
            }
        }

    }

}

//updateFoods();
//nav: importAuftrag
function * importAuftrags(date) {
    yield Export.find({}).remove().exec();

    let {records} = yield accessQuery(`SELECT * FROM Rechnungen WHERE Datum >= #${moment(date).format('YYYY-MM-DD')} 04:00:00# `);

    if (!records || records.length === 0) return;

    records.sort((r1, r2) => r1.Rechnungsnummer - r2.Rechnungsnummer);

    let firstItemId;

    for (const auftrag of records) {
        const {records} = yield accessQuery(`SELECT * FROM Umsaetze WHERE Rechnungsnummer = ${auftrag.Rechnungsnummer}`);
        records.sort((r1, r2) => r1.Rechnungsnummer - r2.Rechnungsnummer);

        if (!firstItemId) firstItemId = records[0].ID;

        const Datum = moment(auftrag.Datum);
        const _export = new Export({
            Id: auftrag.Rechnungsnummer,
            date: auftrag.Datum,
            item: [],
            itemRaw: records,
            raw: auftrag
        });

        for (const bestellung of records) {
            _export.item.push({
                food: bestellung.Bezeichnung,
                quantity: bestellung.Menge,
                price: bestellung.Verkaufspreis,
                Id: bestellung.ID,
                raw: bestellung
            })
        }

        yield Export.findOneAndUpdate({_id: _export._id}, _export, {
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
}

//nav: export auftrag 2
function * exportAuftrags2(date) {
    const exports = yield Export.find();
    for (var _export of exports) {
        // yield * updateAuftragRaw(_export);
    }

    // change all Ids for the next days

    try {
        exports.sort((e1, e2) => e1.Id - e2.Id);
        const _export = exports.pop();
        const maxId = parseInt(_export.Id);

        const {records} = yield accessQuery(`SELECT * FROM Rechnungen WHERE Datum > #${moment(date).add(1, 'day').format('YYYY-MM-DD')} 04:00:00#`);
        records.sort((r1, r2) => r1.Rechnungsnummer - r2.Rechnungsnummer);

        for (let i = maxId + 1; i < maxId + records.length + 1; i++) {
            const _record = records[i - maxId - 1];
            if (_record.Rechnungsnummer > i) {
                yield accessQuery(`UPDATE Rechnungen SET [Rechnungsnummer] = ${i} WHERE Buchungsnummer = "${_record.Buchungsnummer}"`);
                yield accessQuery(`UPDATE Umsaetze SET [Rechnungsnummer] = ${i} WHERE Buchungsnummer = "${_record.Buchungsnummer}"`);
            }
        }

    } catch (e) {
    }

}

function formatNumber(n) {
    return (n + '').replace(/\./g, ',');
}

function * updateAuftragRaw(_export) {

    const removeList = [], updateList = [];

    // remove items
    for (var item of _export.itemRaw) {
        if (!_.includes(_export.item.map(i => i.Id), item.Id)) {
            removeList.push(_.find(_export.itemRaw, {Id: item.Id}));
        }
    }

    for (var item of removeList) {
        _.remove(_export.itemRaw, {ID: item.Id});
        const data = yield accessQuery(`DELETE FROM Umsaetze WHERE ID = ${item.Id}`);
        if (data) console.log(`Delete Bestellung ${item.Id} successful !`)
    }

    // update items
    _.sortBy(_export.itemRaw, ['ID']);
    for (var i = 0; i < _export.item.length; i++) {
        const item = _export.item[i];
        const raw = _.find(_export.itemRaw, {Position: item.position});
        const _raw = _.pick(raw, ['Artikel_ID', 'Menge', 'Preis', 'ZSumme', 'LSumme']);
        const _Position = raw.Position;
        if (raw.Position !== parseInt(i) + 1) raw.Position = parseInt(i) + 1;
        if (raw) {
            var _update = {
                Artikel_ID: item.food.Id,
                Menge: item.quantity,
                Preis: item.price,
                ZSumme: item.price * item.quantity,
                LSumme: raw.Belagart === 'voll' ? item.price * item.quantity : 0
            };
            _.assign(raw, _update);

            // MD5

            if (!_.isEqual(_update, _raw) || _Position !== raw.Position || _export.Id !== raw.ID) {
                var input = `${raw.Artikel_ID} ${_export.Id} ${raw.Menge} ${formatNumber(raw.ZSumme)} ${formatNumber(raw.Preis)} ${formatNumber(raw.LSumme)} ${raw.Groesse} ${formatNumber(raw.ZSumme)}`;
                const _md5 = md5(iconv.convert(input)).toUpperCase();

                if (raw.Menge === 0) {
                    const data = yield accessQuery(`DELETE FROM Bestellung WHERE ID = ${_export.Id} AND Position = ${_Position}`);
                    if (data) console.log(`Delete Item ${raw.Position} successful!`);
                } else {
                    const data = yield accessQuery(`UPDATE Bestellung SET [Position] = ${raw.Position},MD5Hash = "${_md5}", Artikel_ID = "${raw.Artikel_ID}" , Menge = ${raw.Menge} , Preis = ${raw.Preis}, ZSumme = ${raw.ZSumme}, LSumme = ${raw.LSumme} WHERE ID = ${_export.Id} AND Position = ${_Position}`);
                    if (data) console.log(`Update Item ${raw.Position} successful!`);
                }
            }
        }
    }

    //updateAuftrag
    const _Summe = _export.raw.Summe;
    _export.raw.Summe = _.reduce(_export.itemRaw, function (sum, item) {
        sum += item.ZSumme;
        return sum;
    }, 0);

    _export.raw.Lieferpreis = _.reduce(_export.itemRaw, function (sum, item) {
        sum += item.LSumme;
        return sum;
    }, 0);

    const _md5 = `${_export.raw.TAufNr} ${_export.raw.ID} ${_export.raw.Lokal_ID} ${moment(_export.date).format('DD.MM.YYYY')} ${moment(_export.date).format('HH:mm:ss')} ${formatNumber(_export.raw.Lieferpreis)} ${formatNumber(_export.raw.Rabatt)} ${formatNumber(_export.raw.Summe)}`;

    _export.raw.MD5Hash = md5(iconv.convert(_md5)).toUpperCase();

    if (_Summe !== _export.raw.Summe || _export.Id !== _export.raw.ID) {
        const data = yield accessQuery(`UPDATE Auftrag SET Summe = ${_export.raw.Summe}, Lieferpreis = ${_export.raw.Lieferpreis}, MD5Hash = "${_export.raw.MD5Hash}" WHERE ID = ${_export.raw.ID}`);
        if (data) console.log(`Update Auftrag ${_export.raw.ID} successful!`);
    }
}

function * checkMD5Hash() {
    const exports = yield Export.find();
    for (var _export of exports) {
        const _md5 = `${_export.raw.TAufNr} ${_export.raw.ID} ${_export.raw.Lokal_ID} ${moment(_export.date).format('DD.MM.YYYY')} ${moment(_export.date).format('HH:mm:ss')} ${formatNumber(_export.raw.Lieferpreis)} ${formatNumber(_export.raw.Rabatt)} ${formatNumber(_export.raw.Summe)}`;
        console.log(_md5);
        const _MD5Hash = md5(iconv.convert(_md5)).toUpperCase();
        if (_export.raw.MD5Hash !== _MD5Hash) console.log('Not OK');
    }
}

var _accessPath = `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=C:\\BONitFlexX\\Umsaetze.mdb;Jet OLEDB:Database Password=213819737111;`;

function accessQuery(sql) {
    return new Promise(function (resolve, reject) {
        oledb({
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
        oledb({
            dsn: _accessPath,
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
        oledb({
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

q.spawn(function *() {
    yield accessOpen();
})

// delete last bestellung

var gkm = require('gkm');
const notifier = require('node-notifier');

let _keys = 0;

gkm.events.on('key.*', function (data) {
    const str = data.pop();
    if (str === 'Left Alt') {
        _keys = 1;
    } else if (str === 'Left Control' && _keys === 1) {
        _keys = 2;
    } else if (str === 'Left Shift' && _keys === 2) {
        _keys = 3;
    } else if (str === 'O' && _keys === 3) {
        _run();
        _keys = 0;
    } else {
        _keys = 0;
    }
});

function _run() {
    q.spawn(function *() {
        try {
            const {records} = yield accessQuery(`SELECT Max(ID) FROM Auftrag`);
            const maxId = records.pop().Expr1000;
            yield accessQuery(`DELETE FROM Auftrag WHERE ID = ${maxId}`);
            notifier.notify('Delete successful');
        } catch (e) {
        }
    })
}


// printer

var Printer = require('ipp-printer')

var printer = new Printer({name: 'Nodejs', port: 65261})

printer.on('job', function (job) {
    console.log('[job %d] Printing document: %s', job.id, job.name)

    var data = '';
    var chunk;

    job.on('readable', function () {
        while ((chunk = job.read()) != null) data += chunk;
    });

    job.on('end', function () {
        console.log('[job %d] Document saved as %s', job.id, job.name)
    })
})

cms.app.get('/key', function *(req, res) {
    res.send('true');
})
