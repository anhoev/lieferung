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

const Source = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Source',
    label: 'Quelle',
    formatter: `<h4>{{model.name}}</h4>`,
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true
});

const Food = cms.registerSchema({
    name: {type: String},
    Id: String,
    price: {type: Number, label: 'Preis'},
    category: {
        type: String,
        label: 'Kategorie'
    },
    addition: {
        type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Addition', autopopulate: true}],
        label: 'Zusatzbelag'
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

const Addition = cms.registerSchema({
    name: {type: String},
    price: Number,
}, {
    name: 'Addition',
    label: 'Zusatzbelag',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['parent']}
    ]
});


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
        Id: String,
        Nr: Number,
        deleted: {type: Boolean, form: false},
        raw: {type: cms.mongoose.Schema.Types.Mixed, form: false},
        paymentOption: {type: String, form: makeSelect('EC', 'Barverkauf', 'Überweisung'), label: 'Zahlungsmethod'},
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
        itemRaw: {type: [cms.mongoose.Schema.Types.Mixed], form: false},
        item: {
            type: [{
                food: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Food',
                    autopopulate: {select: 'Id name price'},
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
                },
                position: {type: Number, form: false}
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
    },
    {
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

                        if (_export.customer.showUstId) {
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
        },
        controller: function ($scope, formService, cms, $uibModal, $timeout) {
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

            $scope.save = function () {
                cms.updateElement('Export', $scope.model, function (_model) {
                    $timeout(function () {
                        $scope.saved = true;
                        $timeout(function () {
                            $scope.saved = false;
                        }, 2000);
                    })
                })
            }
        }
    });

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
        controller: function (cms, $scope, $timeout) {
            $scope.data = {
                date: new Date(),
                list: []
            }
            $scope.$watch('data.date', function (n, o) {
                if (n) {
                    cms.execServerFn('Report', $scope.model, 'queryExport', $scope.data.date).then(function ({data}) {
                        $scope.data.list = [];
                        $timeout(function () {
                            $scope.data.list.push(...data.exports);
                            $scope.data.sum = data.sum;
                        })
                    })
                }
            }, true);

            $scope.importAuftrag = function () {
                cms.execServerFn('Report', $scope.model, 'importAuftrag').then(function () {
                    confirm('Import successful!');
                });
            }

            $scope.exportAuftrag = function () {
                cms.execServerFn('Report', $scope.model, 'exportAuftrag').then(function () {
                    confirm('Export successful!');
                });
            }

            $scope.filterFn = function (_export) {
                if (!$scope.data.nrs) return false;
                if (_export.deleted) return false;
                return _.includes($scope.data.nrs.split(' '), _export.Nr + '');
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
                _export.deleted = true;
            }

            $scope.type = 'Export';
        },
        serverFn: {
            importAuftrag: function *() {
                yield * importAuftrags();
            },
            exportAuftrag: function *() {
                yield * exportAuftrags();
            },
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

                const sum = _.reduce(exports, (sum, _export) => {
                    sum += _export.sumBrutto;
                    return sum;
                }, 0);

                return {
                    sum,
                    exports
                };
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
    },
    {
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
                if ($scope.data.customer.fromInternet) $scope.data.export.fromInternet = true;
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
                if (_.includes(cost15, parseInt(zipcode))) return 1.5;
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

var connection = require('node-adodb').open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=C:\\RestaurantExpress\\PExpress.dat;Jet OLEDB:Database Password=re!0890db;`);

function accessQuery(sql) {
    return new Promise(function (resolve, reject) {
        connection
            .query(sql)
            .on('done', function (data) {
                resolve(data);
            })
            .on('fail', function (data) {
                reject(data);
            });
    });
}

function accessExecute(sql) {
    return new Promise(function (resolve, reject) {
        connection
            .execute(sql)
            .on('done', function (data) {
                resolve(data);
            })
            .on('fail', function (data) {
                reject(data);
            });
    });
}

var md5 = require('md5');
var {Iconv}  = require('iconv');
var iconv = new Iconv('UTF-8', 'ISO-8859-1');

function updateFoods() {
    q.spawn(function *() {
        yield Food.find({}).remove().exec();
        connection
            .query('SELECT * FROM Artikel')
            .on('done', function ({records}) {
                q.spawn(function *() {
                    yield * importFoods(records);
                })
            });
    })
}

function * importFoods(records) {
    yield Food.find({}).remove().exec();
    for (const record of records) {
        const food = new Food({
            Id: record.Artikel_ID,
            name: record.Bezeichnung,
            category: record.Kategorie2
        });

        const save = function () {
            Food.findOneAndUpdate({_id: food._id}, food, {
                upsert: true,
                setDefaultsOnInsert: true
            }).exec();
        }

        save();

        connection
            .query(`SELECT * FROM Karte WHERE Artikel_ID = "${record.Artikel_ID}" AND PListe_ID = 1`)
            .on('done', function ({records}) {
                q.spawn(function *() {
                    if (records[0]) {
                        food.price = records[0].Preis;
                        save();
                    }
                })
            });

    }

}

//updateFoods();

function * importAuftrags() {
    yield Export.find({}).remove().exec();

    const {records} = yield accessQuery('SELECT * FROM Auftrag');

    for (const auftrag of records) {
        const {records} = yield accessQuery(`SELECT * FROM Bestellung WHERE Auftrag_ID = ${auftrag.Auftrag_ID}`);

        const Datum = moment(auftrag.Datum);
        const _export = new Export({
            Id: auftrag.Auftrag_ID,
            Nr: auftrag.TAufNr,
            date: moment(`${moment(auftrag.Datum).format('YYYY-MM-DD')}T${moment(auftrag.Zeit).format('HH:mm:ss')}`).toDate(),
            item: [],
            itemRaw: records,
            raw: auftrag
        });

        for (const bestellung of records) {
            _export.item.push({
                food: yield Food.findOne({Id: bestellung.Artikel_ID}),
                quantity: bestellung.Menge,
                price: bestellung.Preis,
                position: bestellung.Position
            })
        }

        yield Export.findOneAndUpdate({_id: _export._id}, _export, {
            upsert: true,
            setDefaultsOnInsert: true
        }).exec();
    }
}

function * exportAuftrags() {
    const exports = yield Export.find();
    // exports.sort((e1, e2) => e1.Nr - e2.Nr);
    for (var _export of exports) {
        yield * updateAuftragRaw(_export);
    }
}

function formatNumber(n) {
    return (n + '').replace(/\./g, ',');
}

function * updateAuftragRaw(_export) {

    const removeList = [], updateList = [];

    // remove items
    for (var item of _export.itemRaw) {
        if (!_.includes(_export.item.map(i => i.position), item.Position)) {
            removeList.push(_.find(_export.itemRaw, {Position: item.Position}));
        }
    }
    for (var item of removeList) {
        _.remove(_export.itemRaw, {Position: item.Position})
        const data = yield accessExecute(`DELETE FROM Bestellung WHERE Auftrag_ID = ${item.Auftrag_ID} AND Position = ${item.Position}`);
        if (data) console.log(`Delete Bestellung ${item.Auftrag_ID} - ${item.Position} successful !`)
    }

    // update items
    _.sortBy(_export.itemRaw, ['Position']);
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

            if (!_.isEqual(_update, _raw) || _Position !== raw.Position) {
                var input = `${raw.Artikel_ID} ${raw.Auftrag_ID} ${raw.Menge} ${formatNumber(raw.ZSumme)} ${formatNumber(raw.Preis)} ${formatNumber(raw.LSumme)} ${raw.Groesse} ${formatNumber(raw.ZSumme)}`;
                const _md5 = md5(iconv.convert(input)).toUpperCase();

                const data = yield accessExecute(`UPDATE Bestellung SET [Position] = ${raw.Position},MD5Hash = "${_md5}", Artikel_ID = "${raw.Artikel_ID}" , Menge = ${raw.Menge} , Preis = ${raw.Preis}, ZSumme = ${raw.ZSumme}, LSumme = ${raw.LSumme} WHERE Auftrag_ID = ${raw.Auftrag_ID} AND Position = ${_Position}`);
                if (data) console.log(`Update Item ${raw.Position} successful!`);
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

    const _md5 = `${_export.raw.TAufNr} ${_export.raw.Auftrag_ID} ${_export.raw.Lokal_ID} ${moment(_export.date).format('DD.MM.YYYY')} ${moment(_export.date).format('HH:mm:ss')} ${formatNumber(_export.raw.Lieferpreis)} ${formatNumber(_export.raw.Rabatt)} ${formatNumber(_export.raw.Summe)}`;

    _export.raw.MD5Hash = md5(iconv.convert(_md5)).toUpperCase();

    if (_Summe !== _export.raw.Summe) {
        const data = yield accessExecute(`UPDATE Auftrag SET Summe = ${_export.raw.Summe}, Lieferpreis = ${_export.raw.Lieferpreis}, MD5Hash = "${_export.raw.MD5Hash}" WHERE Auftrag_ID = ${_export.raw.Auftrag_ID}`);
        if (data) console.log(`Update Auftrag ${_export.raw.Auftrag_ID} successful!`);
    }
}

function * checkMD5Hash() {
    const exports = yield Export.find();
    for (var _export of exports) {
        const _md5 = `${_export.raw.TAufNr} ${_export.raw.Auftrag_ID} ${_export.raw.Lokal_ID} ${moment(_export.date).format('DD.MM.YYYY')} ${moment(_export.date).format('HH:mm:ss')} ${formatNumber(_export.raw.Lieferpreis)} ${formatNumber(_export.raw.Rabatt)} ${formatNumber(_export.raw.Summe)}`;
        console.log(_md5);
        const _MD5Hash = md5(iconv.convert(_md5)).toUpperCase();
        if (_export.raw.MD5Hash !== _MD5Hash) console.log('Not OK');
    }
}

var SerialPort = require('serialport');

SerialPort.list(function (err, ports) {
    ports.forEach(function (port) {
        if ((/usbmodem/i).test(port.comName)) {
            var sp = new SerialPort('/dev/tty.usbmodem12345671', {
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
        , printer: 'EPSON_TM_T20II'
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
