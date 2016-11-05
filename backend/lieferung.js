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

const Print = require('printer');

var printer = require("node-thermal-printer");
printer.init({
    type: 'epson',
    interface: 'usb://EPSON/TM-T20II'
});

printer._println = printer.println;
printer.println = function (str) {
    if (str) {
        printer.print('   ');
        printer._println(str);
    }
}

const customerSchema = {
    name: {type: String, label: 'Name'},
    //Id: {type: Number},
    address: {
        name: {type: String, label: 'Firma'},
        streetObj: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Street',
            autopopulate: true,
            label: 'Straße Suchen',
            form: {
                templateOptions: {
                    async: true
                },
                controller: function ($scope, $timeout) {
                    $scope.$watch('model.streetObj', function (newVal, oldVal) {
                        if (!newVal) return;
                        if (oldVal && oldVal._id === newVal._id) return;

                        $timeout(function () {
                            $scope.model.street = newVal.name;
                            $scope.model.zipcode = newVal.zipcode;
                            $scope.model.city = 'Hamburg';
                        })
                    }, true);
                }
            }
        },
        houseNumber: {
            type: String, label: 'Hausnummer', form: {
                controller: function ($scope, $http) {
                    $scope.$watch('model.houseNumber', function (newVal) {
                        if (!$scope.model.streetObj) return;
                        $scope.model.street = `${$scope.model.streetObj.name} ${newVal}`;
                        if (!$scope.model.zipcode) {
                            $http.get(`https://maps.googleapis.com/maps/api/geocode/json?address=${$scope.model.street},${$scope.model.city}&key=AIzaSyCMkI_vyp8ZJTW1-udo7dUR0-R180zWwms`).then(function ({data}) {
                                const zipcode = _.find(data.results[0].address_components, function (c) {
                                    try {
                                        if (c.types[0] === "postal_code") return true;
                                    } catch (e) {
                                    }
                                })
                                if (zipcode) $scope.model.zipcode = zipcode.long_name;
                            })
                        }
                    })
                }
            }
        },
        street: {type: String, label: 'Straße'},
        floor: {type: String, label: 'Etage'},
        zipcode: {type: String, label: 'PLZ'},
        city: {type: String, label: 'Stadt'},
    },
    phone: {type: String, label: 'Telefon'},
    fax: String,
    email: {
        type: String,
        form: {
            type: 'input',
            templateOptions: {
                type: 'email',
                label: 'Email'
            }
        }
    },
    note: {type: String, label: 'Notiz'}
}

const Customer = cms.registerSchema(merge(customerSchema, {
    /*Id: {
     form: {
     controller: function ($scope, $http, cms) {
     if (!$scope.model[$scope.options.key]) {
     $http.get('api/customerId').then(function ({data}) {
     $scope.model[$scope.options.key] = data.maxId;
     });
     }
     }
     }
     },*/
    fromInternet: {type: Boolean, label: 'Von Internet'},
    showUstId: {type: Boolean, label: 'Ust-IdNr anzeigen'}
}), {
    name: 'Customer',
    label: 'Kunden',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'title',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: false,
    initSchema: function (schema) {
        schema.virtual('title').get(function () {
            return `${this.name}   *${this.phone}, ${this.address.street}, ${this.address.zipcode}  ${this.address.city}`;
        })
    },
    lean: false
});

cms.app.get('/api/customerId', function*(req, res) {
    const result = yield Customer.aggregate().group({
        _id: "",
        maxID: {$max: "$Id"}
    }).exec();
    res.send({maxId: result[0].maxID + 1});
})

const Category = cms.registerSchema({
    name: {type: String},
    parent: {type: mongoose.Schema.Types.ObjectId, ref: 'Category', autopopulate: true, label: 'Eltern'}
}, {
    name: 'Category',
    label: 'Kategorie',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true
});

const Food = cms.registerSchema({
    name: {type: String},
    Id: {
        type: Number, form: {
            template: `
                    <div class="col-xs-6" style="padding: 0px">
                        <input class="form-control" ng-model="model[options.key]">
                    </div>
                    <div class="col-xs-6">
                        <button type="button" class="btn btn-white btn-xs" style="margin-top: 3px;margin-right: 3px" ng-repeat="id in ids" 
                            ng-click="model[options.key] = id.id" ng-class="{'text-success':id.last}">{{ id.id }}</button>
                    </div>
                `,
            controller: function ($scope, $http, cms) {
                if (!$scope.model[$scope.options.key]) {
                    $http.get('api/foodId').then(function ({data}) {
                        $scope.ids = data.ids;
                    });
                }
            }
        },
        query: {
            form: {type: 'input', templateOptions: {label: 'Id'}}
        }
    },
    price: {type: Number, label: 'Preis'},
    tax: {type: String, form: makeSelect('19%', '7%'), label: 'Steuer'},
    category: {
        type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Category', autopopulate: {select: 'name _id'}}],
        label: 'Kategorie'
    },
    picture: {
        type: String, form: {
            type: 'image', controller: function ($scope) {
                $scope.w = '500';
                $scope.$watch(['model.name', 'model.picture'], function () {
                    try {
                        $scope.filename = `${$scope.model.name.split(' ').join('_')}.${$scope.model.picture.split('.').pop()}`;
                    } catch (e) {
                    }
                }, true);
            }
        }, label: 'Bild'
    },
}, {
    name: 'Food',
    label: 'Speise',
    formatterUrl: 'backend/food.html',
    title: 'title',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true,
    initSchema: function (schema) {
        schema.virtual('title').get(function () {
            return `${this.name}   ${this.Id}`;
        })

    },
    info: {
        elementClass: 'col-sm-4',
        editorIcon: {
            top: '49px',
            right: '-14px'
        }
    }
});


cms.app.get('/api/foodId', function*(req, res) {
    const foods = yield Food.find();
    const ids = [];
    for (var i = 100; i < 1000; i += 100) {
        var _ids = foods.filter(p => p.Id < i && p.Id > i - 100).map(p => p.Id);
        if (_ids.length > 0) {
            ids.push({id: Math.max(..._ids) + 1, last: false});
        }
    }

    const last = (yield Food.find({})).pop();
    if (last) {
        const id = last.Id + 1;
        if (!_.find(ids, {id})) {
            ids.push({id, last: true});
        } else {
            _.find(ids, {id}).last = true;
        }
    }

    res.send({ids});
})

const PersonalInformation = cms.registerSchema(_.assign(customerSchema, {
    owner: {type: String, label: 'Inhaber'},
    mobile: {type: String},
    bank: {
        name: String,
        iban: String,
        bic: String
    },
    ustId: {type: String, label: 'Ust-IdNr'}
}), {
    name: 'PersonalInformation',
    formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    alwaysLoad: true,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['address', 'location']}
    ]
});

const idFormExport = {
    controller: function ($scope, $http, cms) {
        if (!$scope.model[$scope.options.key]) {
            $http.get('api/exportId').then(function ({data}) {
                $scope.model[$scope.options.key] = data.maxId;
            });
        }
    }
};

cms.app.use('/rechnung.html', cms.express.static(path.resolve(__dirname, 'rechnung.html')));
cms.app.use('/lieferschein.html', cms.express.static(path.resolve(__dirname, 'lieferschein.html')));

const Export = cms.registerSchema({
    date: {
        type: Date, default: Date.now(), label: 'Tag',
        query: {
            form: {type: 'input', defaultValue: new Date(), templateOptions: {type: 'date', label: 'Tag'}},
            fn: date => ({
                $gte: moment(date).clone().startOf('day').toDate(),
                $lte: moment(date).clone().endOf('day').toDate()
            })
        }
    },
    shipDate: {type: Date, default: Date.now(), label: 'Lieferdatum'},
    Id: {type: Number, label: 'Rechnung Nummer', form: idFormExport},
    paymentOption: {type: String, form: makeSelect('Unbar', 'Barverkauf'), label: 'Zahlungsmethod'},
    status: {type: String, form: makeSelect('BestellungErhalten', 'Bezahlt', 'Geliefert'), label: 'Zustand'},
    //provider: {type: mongoose.Schema.Types.ObjectId, ref: 'Provider', autopopulate: true},
    note: {type: String, label: 'Notiz'},
    shippingCost: {type: Number, label: 'Lieferungskosten'},
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        autopopulate: true,
        label: 'Kunden',
        form: {
            templateOptions: {
                async: true
            }
        }
    },
    fromInternet: {type: Boolean, label: 'Von Internet'},
    showUstId: {type: Boolean, label: 'Ust-IdNr anzeigen'},
    discount: {type: Number, form: makeSelect(5, 10, 15, 20, 25), label: 'Rabatt'},
    item: {
        type: [{
            food: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Food',
                autopopulate: {select: 'Id name price tax'},
                label: 'Speise',
                form: {
                    controller: function ($scope, $timeout) {

                        $scope.$watch('model.food', (newVal, oldVal) => {
                            if (!newVal) return;
                            if (oldVal && oldVal._id === newVal._id) return;
                            $scope.model.price = $scope.model.food.price;
                            $scope.model.quantity = 1;
                            if (!oldVal) $scope.formState.model.item.push({});
                            $('#left-panel').animate({scrollTop: $('#left-panel').height()}, 10);
                        })
                    },
                    templateOptions: {
                        sortField: 'Id'
                    }
                }
            },
            quantity: {
                type: Number, label: 'Anzahl'
            },
            price: {
                type: Number, label: 'Preis', form: {
                    link: function (scope, element, attrs) {
                        setTimeout(function () {
                            $(element).find('input').attr('tabIndex', '-1');
                        }, 100)
                    }
                }
            }
        }],
        form: {
            type: 'tableSection',
            templateOptions: {
                class: 'col-sm-12',
                widths: '70 15 15'
            },
            defaultValue: [{}],
            link: function (scope, element, attrs) {
                setTimeout(function () {
                    $(element).find('label').css('display', 'none');
                    window._focus = function () {
                        $(element).find('.selectize-input').find('input').focus();
                    }
                    window._focus();
                }, 100)
            }
        },
        label: 'Speise'
    }
}, {
    name: 'Export',
    label: 'Bestellung',
    formatterUrl: 'backend/export.html',
    title: 'date',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['item']}
    ],
    info: {
        elementClass: 'col-sm-12',
        editorIcon: {
            top: '14px',
            right: '-14px'
        }
    },
    serverFn: {
        getPersonalInformation: function*() {
            return yield PersonalInformation.findOne();
        },
        printQuitung: function *() {
            const _export = this;
            const _print = function*(forKitchen = false) {
                const info = yield PersonalInformation.findOne().lean();

                printer.bold(true);
                if (!forKitchen) {
                    printer.alignCenter();
                    printer.setTextQuadArea();
                    printer.println(info.name);
                    printer.setTextNormal();
                    printer.bold(true);

                    printer.alignLeft();
                    printer.newLine();
                    printer.println(info.address.street);
                    printer.println(`${info.address.zipcode} ${info.address.city}`);
                    printer.println(`Telefon: ${info.phone}`);
                    printer.newLine();
                    printer.newLine();
                    printer.println('KD');
                } else {
                    printer.setTextDoubleWidth();
                }

                printer.println(_export.customer.name);
                if (_export.customer.address.name && _export.customer.address.name !== _export.customer.name) printer.println(_export.customer.address.name);
                printer.print('   ' + _export.customer.address.street);
                if (_export.customer.address.houseNumber) {
                    printer._println(' ' + _export.customer.address.houseNumber);
                } else {
                    printer.newLine();
                }
                if (_export.customer.address.floor) printer.println(`Etage: ${_export.customer.address.floor}`);
                printer.println(`${_export.customer.address.zipcode} ${_export.customer.address.city}`);
                if (_export.customer.phone) printer.println(`Telefon: ${_export.customer.phone}`);
                printer.newLine();
                printer.newLine();
                printer.newLine();

                if (!forKitchen) {
                    printer.println('RECHNUNG');
                    printer.newLine();

                    printer.println(`Rechnung Nr : ${_export.Id}`);

                    printer.newLine();

                    printer.println(`                            ${moment(_export.date).format("DD.MM.YYYY hh:mm")}`);
                    printer.newLine();

                    printer.drawLine();

                    printer.leftRight("Menge Beschreibung", "Summe");

                    printer.drawLine();
                    printer.newLine();
                    printer.alignLeft();
                } else {
                    printer.println(`Rechnung Nr : ${_export.Id}`);
                    printer.newLine();
                }


                for (const item of _export.item) {
                    if (!forKitchen) {
                        printer.tableCustom([                               // Prints table with custom settings (text, align, width, bold)
                            {
                                text: `${item.quantity} x ${item.food.name} (${item.food.Id})`,
                                align: "LEFT",
                                width: 0.85
                            },
                            {text: `  ${(item.quantity * item.price).toFixed(2)}`, align: "LEFT", width: 0.15}
                        ]);

                    } else {

                        printer._println(`  ${item.quantity} x [${item.food.Id}]`);
                        printer._println(`  ${item.food.name}`);
                        printer.newLine();
                    }
                }

                if (!forKitchen) {
                    printer.drawLine();
                    printer.leftRight(' ', _export.sumBrutto.toFixed(2));
                    printer.leftRight(' ', '------------');
                    printer.leftRight(' ', '------------');

                    printer.newLine();

                    printer.println(`Entsprich = ${_export.sumBrutto.toFixed(2)} EUR`);
                    printer.newLine();

                    if (_export.shippingCost && _export.shippingCost > 0) {
                        printer.println(`Anfahrtkosten: ${_export.shippingCost.toFixed(2)} EUR`);
                        printer.newLine();
                    }

                    printer.println(`MwSt 07,00% = ${_export.vat7.toFixed(2)} EUR`);
                    printer.println(`MwSt 19,00% = 0,00 EUR`);

                    printer.newLine();

                    if (_export.showUstId) {
                        printer.newLine();
                        printer.println(`StNr: ${info.ustId}`);
                        printer.println(`Anlass der Bewirtung:`);
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();

                        printer.newLine();
                    }

                    printer.println(`Vielen Dank für Ihre Bestellung`);
                    printer.println(`Wir wünschen ihnen einen guten Appetit `);
                    printer.println(`Ihr Kim Chi Team`);
                }

                printer.cut();
            }

            yield * _print();
            yield * _print(true);

            setTimeout(function () {
                print();
            }, 300);

        }
    },
    initSchema: function (schema) {
        schema.virtual('vat7').get(function () {
            return _.reduce(this.item, (sum, item) => {
                sum += item.quantity * item.price * 0.07;
                return sum;
            }, 0);
        })

        schema.virtual('sumBrutto').get(function () {
            return _.reduce(this.item, (sum, item) => {
                sum += item.quantity * item.price;
                return sum;
            }, 0);
        })

        schema.virtual('sum7Brutto').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.food.tax === '7%') sum += item.quantity * item.price;
                return sum;
            }, 0);
        })

        schema.virtual('sum19Brutto').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.food.tax === '19%') sum += item.quantity * item.price;
                return sum;
            }, 0);
        })
    },
    controller: function ($scope, formService, cms, $uibModal) {
        $scope.openLieferschein = function () {
            cms.execServerFn('Export', $scope.model, 'getPersonalInformation').then(({data:info}) => {
                $uibModal.open({
                    templateUrl: 'lieferschein.html',
                    controller: function ($scope, $uibModalInstance, formService, model) {
                        $scope.info = info;
                        $scope.model = model
                        $scope.data = {};
                        $scope.instance = $uibModalInstance;

                        $scope.cancel = ()=>$uibModalInstance.dismiss('cancel');
                        $scope.print = () => {
                            $('#rechnung').printThis({debug: true});
                        };

                        $scope.showItem = function (item) {
                            if (item.billQuantity === 0) return false;
                            return true;
                        }
                    },
                    size: 'lg',
                    resolve: {
                        model: $scope.model
                    }
                    //windowClass: 'cms-window',
                });
            });
        }

        $scope.openRechnung = function () {
            cms.execServerFn('Export', $scope.model, 'getPersonalInformation').then(({data:info}) => {
                $uibModal.open({
                    templateUrl: 'rechnung.html',
                    controller: function ($scope, $uibModalInstance, formService, model) {
                        $scope.info = info;
                        $scope.model = model
                        $scope.data = {};
                        $scope.instance = $uibModalInstance;

                        $scope.cancel = ()=>$uibModalInstance.dismiss('cancel');
                        $scope.print = () => {
                            $('#rechnung').printThis({debug: true});
                        };

                        $scope.showItem = function (item) {
                            if (item.billQuantity === 0) return false;
                            return true;
                        }
                    },
                    size: 'lg',
                    resolve: {
                        model: $scope.model
                    }
                    //windowClass: 'cms-window',
                });
            });
        }

        $scope.printQuitung = function () {
            cms.execServerFn('Export', $scope.model, 'printQuitung');
        }
    }
});

const Report = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Report',
    label: 'Kassenbericht',
    formatterUrl: 'backend/report.html',
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true,
    controller: function (cms, $scope, $timeout) {
        $scope.data = {
            date: new Date()
        }

        $scope.refresh = function () {
            cms.execServerFn('Report', $scope.model, 'queryExport', $scope.data.date).then(function ({data}) {
                $scope.data.list = [];
                $timeout(function () {
                    $scope.data.list.push(...data.exports);
                    $scope.data.sum = data.sum;
                })
            })
        }

        $scope.$watch('data.date', function (n, o) {
            if (n) $scope.refresh();
        }, true);

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
            cms.removeElement('Export', _export._id, () => $scope.refresh());
        }

        $scope.print = function (date) {
            cms.execServerFn('Report', $scope.model, 'print', date);
        }

        $scope.printQuitung = function (_export) {
            cms.execServerFn('Export', _export, 'printQuitung');
        }

        $scope.changeBewirtung = function (_export) {
            _export.showUstId = !_export.showUstId;
            $scope.save(_export);
        }
    },
    serverFn: {
        queryExport: function *(date) {
            const exports = yield Export.find({
                date: {
                    $gte: moment(date).startOf('day').toDate(),
                    $lte: moment(date).endOf('day').toDate()
                },
                fromInternet: {
                    $ne: true
                },
                showUstId: {
                    $ne: true
                }
            });

            const exportsAll = yield Export.find({
                date: {
                    $gte: moment(date).startOf('day').toDate(),
                    $lte: moment(date).endOf('day').toDate()
                }
            });

            const sum = _.reduce(exportsAll, (sum, _export) => {
                sum += _export.sumBrutto;
                return sum;
            }, 0);

            return {
                sum,
                exports
            };
        },
        print: function *(date) {
            const exports = yield Export.find({
                date: {
                    $gte: moment(date).startOf('day').toDate(),
                    $lte: moment(date).endOf('day').toDate()
                }
            });

            const sum7 = _.reduce(exports, (sum, _export) => sum + _export.sum7Brutto, 0);
            const sum19 = _.reduce(exports, (sum, _export) => sum + _export.sum19Brutto, 0);

            const sum7Bar = _.reduce(_.filter(exports, {paymentOption: 'Barverkauf'}), (sum, _export) => sum + _export.sum7Brutto, 0);
            const sum7Kredit = sum7 - sum7Bar;

            const sum19Bar = _.reduce(_.filter(exports, {paymentOption: 'Barverkauf'}), (sum, _export) => sum + _export.sum19Brutto, 0);
            const sum19Kredit = sum19 - sum19Bar;

            printer.bold(true);
            printer.println('KASSENBERICHT (LIEFERSERVICE)');
            printer.bold(false);
            printer.println(`für ${moment(date).format('DD.MM.YYYY')}`);
            printer.newLine();
            printer.println('Vorgang / Summe');
            printer.drawLine();

            printer.newLine();
            printer.println('Einnahme 7,0 % (Außer Haus/Speisen)');
            printer.println(`Summe = ${sum7.toFixed(2)} Euro`);
            printer.newLine();

            printer.newLine();
            printer.println('Einnahme 19,0 %  (Außer Haus/Getränk)');
            printer.println(`Summe = ${sum19.toFixed(2)} Euro`);
            printer.newLine();

            printer.drawLine();
            printer.println(`TOTAL = ${(sum7 + sum19).toFixed(2)} Euro`);

            printer.newLine();

            printer.tableCustom([
                {text: `   MWST`, align: "LEFT", width: 0.25},
                {text: `Wert`, align: "LEFT", width: 0.25},
                {text: `Netto`, align: "LEFT", width: 0.25},
                {text: `Brutto`, align: "LEFT", width: 0.25}
            ]);

            printer.tableCustom([
                {text: `   7%`, align: "LEFT", width: 0.25},
                {text: `${(sum7 * 0.07).toFixed(2)}`, align: "LEFT", width: 0.25},
                {text: `${(sum7 * 0.93).toFixed(2)}`, align: "LEFT", width: 0.25},
                {text: `${sum7.toFixed(2)}`, align: "LEFT", width: 0.25}
            ]);

            printer.tableCustom([
                {text: `   19%`, align: "LEFT", width: 0.25},
                {text: `${(sum19 * 0.07).toFixed(2)}`, align: "LEFT", width: 0.25},
                {text: `${(sum19 * 0.93).toFixed(2)}`, align: "LEFT", width: 0.25},
                {text: `${sum19.toFixed(2)}`, align: "LEFT", width: 0.25}
            ]);

            printer.newLine();

            printer.newLine();

            printer.leftRight(' ', `Summe Netto = ${((sum7 + sum19) * 0.93).toFixed(2)}`);
            printer.leftRight(' ', `Summe MwSt = ${((sum7 + sum19) * 0.07).toFixed(2)}`);
            printer.leftRight(' ', `Summe Brutto = ${(sum7 + sum19).toFixed(2)}`);

            printer.cut();
            print();
        }
    }
});

cms.app.get('/api/exportId', function*(req, res) {

    const result = yield Export.aggregate().match({
        date: {
            $gte: moment().startOf('day').toDate(),
            $lte: moment().endOf('day').toDate()
        }
    }).group({
        _id: "",
        maxID: {$max: "$Id"}
    }).exec();

    var maxID = result[0] ? result[0].maxID : 0;
    res.send({maxId: maxID + 1});
})

cms.app.get('/api/phone', function*(req, res) {
    console.log(`callid: ${req.query.number}`)
    const clients = cms.ews.getWss().clients;
    for (const client of clients) {
        client.send({
            path: 'phone',
            phone: req.query.number
        })
    }
})

const OrderView = cms.registerSchema({
    name: String
}, {
    name: 'OrderView',
    formatterUrl: 'backend/order-view.html',
    title: 'name',
    isViewElement: true,
    autopopulate: true,
    alwaysLoad: true,
    controller: function ($scope, cms, formService, $timeout, $http) {
        $('#left-panel').css('height', $('#left-panel').height() + 'px');
        $scope.data = {
            waitCustomers: [],
            free: true
        };

        $scope.clear = function () {
            $scope.data.phone = '';
            $scope.data.export = {
                paymentOption: 'Barverkauf',
                item: []
            };

            $timeout(function () {
                $scope.data.export.item.push({});
            }, 100)

            $scope.data.customer = {address: {city: 'Hamburg'}};

            $http.get('api/customerId').then(function ({data}) {
                $scope.data.customer.Id = data.maxId;
            });

            $http.get('api/exportId').then(function ({data}) {
                $scope.data.export.Id = data.maxId;
            });

            $timeout(function () {
                $scope.data.free = true;
            }, 200);
        }

        $scope.$watch('data.export.customer', function (customer) {
            if (customer) $scope.data.customer = customer;
        })

        $scope.clear();

        $scope.newCustomer = function (cb) {
            cms.createElement('Customer', $scope.data.customer, function (model) {
                $timeout(function () {
                    $scope.data.export.customer = $scope.data.customer = _.find(cms.types.Customer.list, {_id: model._id});
                    if (cb) cb();
                    if (!cb) window._focus();
                }, 100)
            }, false);
        }

        const cArr = ['data.customer.fromInternet', 'data.customer.showUstId', 'data.customer.address', 'data.customer.name', 'data.customer.phone', 'data.customer.note'];
        for (const p of cArr) {
            $scope.$watch(p, function (newVal, oldVal) {
                if (newVal) $scope.data.free = false;
                if (oldVal && oldVal.city && !oldVal.street) return;
                if (oldVal != undefined && !angular.equals(newVal, oldVal) && $scope.data.customer && $scope.data.customer._id) {
                    $scope.saveCustomer(false);
                }
            }, true);
        }

        $scope.$watch('data.customer.address.zipcode', function (newVal, oldVal) {
            if (newVal) {
                try {
                    $timeout(function () {
                        $scope.data.export.shippingCost = $scope.shippingCostCalculate(newVal);
                    })
                } catch (e) {
                }
            }
        })

        $scope.$watch('data.export.item', function (newVal, oldVal) {
            if (newVal && newVal.length > 0) {
                const items = $scope.data.export.item;
                $scope.data.sum = _.reduce(items, (sum, item) => {
                    if (item.quantity && item.price)
                        sum += item.quantity * item.price;
                    return sum;
                }, 0)
            }
        }, true);

        $scope.saveCustomer = function (notify = true) {
            if (!$scope.data.customer._id) {
                $scope.newCustomer();
                return;
            }
            delete $scope.data.customer.$order;
            cms.updateElement('Customer', $scope.data.customer, function (model) {
                // if (notify) confirm('Speichern erfolgreich!');
                // $scope.clear();
                $timeout(function () {
                    if (notify) $scope.data.export.customer = $scope.data.customer = _.find(cms.types.Customer.list, {_id: model._id});
                }, 100)
            });
        }

        $scope.newCustomerFromInternet = function () {
            $scope.data.customer.fromInternet = true;
            $scope.newCustomer();
        }

        $scope.order = function () {
            if ($scope.data.customer.fromInternet) {
                $scope.data.export.fromInternet = true;
                $scope.data.export.paymentOption = 'Unbar';
            }
            if ($scope.data.customer.showUstId) $scope.data.export.showUstId = true;
            $scope.data.export.item = _.filter($scope.data.export.item, item => item.food);
            function _order() {
                cms.createElement('Export', $scope.data.export, function (_export) {
                    cms.execServerFn('Export', _export, 'printQuitung');
                    $scope.clear();
                }, false)
            }

            if (!$scope.data.customer._id) {
                $scope.newCustomer(function () {
                    _order();
                })
            } else {
                _order();
            }

        }

        $scope.orderFromInternet = function () {
            $scope.data.export.fromInternet = true;
            $scope.order();
        }

        $scope.shippingCostCalculate = function (zipcode) {
            const free = [
                22393,
                22159, 22393,
                22393,
                22047, 22159, 22175, 22177, 22179, 22309, 22393,
                22145, 22159,
                22177, 22309,
                22297, 22303, 22305, 22307, 22309,
                22081, 22083, 22085, 22305,
                22041, 22043, 22045, 22047, 22159,
                22143, 22145, 22147
            ];

            const cost1 = [
                22399, 22149, 22337
            ]

            const cost15 = [
                22339, 22391, 22415, 22417,
                22397,
                22359, 22395
            ]

            if (_.includes(free, parseInt(zipcode))) return 0;
            if (_.includes(cost1, parseInt(zipcode))) return 1;
            if (_.includes(ost15, parseInt(zipcode))) return 1.5;
            return 2;
        }

        $scope.setCustomer = function (customer) {
            if (!$scope.data.free) return;
            if (customer._id) {
                $scope.data.export.customer = customer;
                $scope.data.customer = $scope.data.export.customer;
                window._focus();
            } else {
                $scope.data.customer.phone = customer.phone;
            }
        }

        $scope._setCustomer = function (customer, $index) {
            $scope.setCustomer(customer);
            if ($scope.data.free) {
                $scope.data.waitCustomers.splice($index, 1);
            }
        }

        cms.socket.on('message', event => {
            const _data = JsonFn.parse(event, true);
            if (_data.path !== 'phone') return;
            var customer = _data.customer;

            if (customer) {
                if ($scope.data.free) {
                    $scope.setCustomer(customer);
                } else {
                    $scope.data.waitCustomers.push(customer);
                }
            } else {
                if ($scope.data.free) {
                    $scope.setCustomer({
                        phone: _data.phone
                    });
                } else {
                    $scope.data.waitCustomers.push({
                        phone: _data.phone
                    });
                }
            }
            $scope.data.phone = _data.phone;

            $scope.$digest();

        })

    },
    serverFn: {}
});


const Street = cms.registerSchema({
        name: {type: String},
        zipcode: {type: String},
    },
    {
        name: 'Street',
        label: 'Straße',
        formatter: `<h4>{{model.name}}</h4>`,
        title: 'title',
        isViewElement: false,
        alwaysLoad: false,
        initSchema: function (schema) {
            schema.virtual('title').get(function () {
                return `${this.name}   ${this.zipcode ? this.zipcode : ''}`;
            })

        },
    }
);

/*q.spawn(function*() {
 yield Street.find({}).remove().exec();
 const content = JsonFn.parse(fs.readFileSync(`backend/hamburg.json`, 'utf8'));
 let i = 0;
 for (const element of content.elements) {
 const {tags, id} = element;
 const street = {
 name: tags.name,
 zipcode: tags.postal_code,
 _id: new Street()._id
 };

 const _street = yield Street.findOne({name: tags.name});
 let save = true;
 if (_street && !_street.zipcode && street.zipcode) {
 street._id = _street._id
 } else if (_street && _street.zipcode && !street.zipcode) {
 save = false;
 } else if (_street && !_street.zipcode && !street.zipcode) {
 save = false;
 } else if (_street && _street.zipcode && street.zipcode && _street.zipcode === street.zipcode) {
 save = false;
 }

 // if (tags.name === 'Horner Weg') debugger

 if (save) {
 yield Street.findOneAndUpdate({_id: street._id}, street, {
 upsert: true,
 setDefaultsOnInsert: true
 }).exec();
 }

 }
 debugger
 })*/

/*q.spawn(function*() {
 const content = fs.readFileSync(`backend/k8.txt`, 'utf8');
 const arr = content.split('\r\n \r\n \r\n \r\n \r\n \r\n ');
 for (const raw of arr) {
 let raws = raw.split('\r\n');
 raws = raws.map(r => _.trim(r.replace('|', '')));
 const phone = raws[0][0] !== '0' ? `040${raws[0]}` : raws[0];
 const ort = raws[4];
 let plz = ort.match(/[0-9]{5}/);
 let city;
 let zipcode;
 if (plz && plz[0]) {
 zipcode = plz[0];
 city = _.trim(ort.replace(plz[0], ''));
 } else {
 city = _.trim(ort);
 }

 const customer = {
 name: raws[1],
 phone,
 address: {
 name: raws[1],
 street: raws[3],
 floor: raws[2],
 zipcode,
 city
 },
 note: raws[5]
 }
 Customer.findOneAndUpdate(customer, customer, {
 upsert: true,
 setDefaultsOnInsert: true
 }).exec();
 }
 })*/

/*q.spawn(function*() {
 yield Customer.find({$or: [{name: ''}, {name: null}, {phone: ''}, {phone: null}]}).remove().exec();
 })*/

/*q.spawn(function *() {
 const foods = yield Food.find({name: /ﬂ/i});
 for (const food of foods) {
 food.name = food.name.replace('ﬂ', 'fl');
 Food.findOneAndUpdate({_id: food._id}, food, {
 upsert: true,
 setDefaultsOnInsert: true
 }).exec();
 }
 })*/

/*q.spawn(function*() {
 const customer = yield Customer.findOne({_id: '58060b2701ee07bd99f8944b'});
 })*/

var SerialPort = require('serialport');

SerialPort.list(function (err, ports) {
    ports.forEach(function (port) {
        if ((/COM3/i).test(port.comName)) {
            var sp = new SerialPort('COM3', {
                parser: SerialPort.parsers.readline("\n")
            });

            sp.on("open", function () {
                console.log("Listening on port: ");
                //Send command to modem to show caller-id in nice format.
                sp.write("AT+VCID=1\r", function (err, results) {
                    sp.drain(console.log('Enabling CallerId nice format: ' + results));
                });

                //Respond to data received from modem
                sp.on('data', function (data) {
                    console.log('Data received: ' + data);
                    //If data contains a number extract it and activate the current caller.
                    if (data.indexOf("NMBR = ") > -1) {
                        var phoneNumber = data.substring(7);
                        phoneNumber = phoneNumber.substring(0, phoneNumber.length - 1);
                        console.log('Callers number: ' + phoneNumber);

                        q.spawn(function *() {
                            const customer = yield Customer.findOne({phone: phoneNumber});
                            cms.io.emit('message', JsonFn.stringify({
                                path: 'phone',
                                phone: phoneNumber,
                                customer
                            }));
                        })
                    }
                });
            });
        }
    });
});

function print() {
    Print.printDirect({
        data: printer.getBuffer() // or simple String: "some text"
        , printer: 'EPSON TM-T20II Receipt'
        , type: 'RAW' // type: RAW, TEXT, PDF, JPEG, .. depends on platform
        , success: function (jobID) {
            console.log("sent to printer with ID: " + jobID);
        }
        , error: function (err) {
            console.log(err);
        }
    });
    printer.clear();
}
