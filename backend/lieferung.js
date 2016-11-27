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
        fromInternet: {type: Boolean, label: 'Von Internet'},
        showUstId: {type: Boolean, label: 'Ust-IdNr anzeigen'}
    }),
    {
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

cms.app.use('/', function (req, res, next) {
    // if (req.headers.host === 'localhost:8888') return res.status(404).send();
    next();
    //debugger
})

const Food = cms.registerSchema({
    name: {type: String},
    Id: String,
    price: {type: Number, label: 'Preis'},
    category: {
        type: String,
        label: 'Kategorie'
    },
    removable: Boolean,
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

//nav: removableOrder
const RemovableOrder = cms.registerSchema({
    date: {type: Date},
    nrs: String,
    firstId: Number
}, {
    name: 'RemovableOrder',
    label: 'RemovableOrder',
    formatter: '<h2>RemovableOrder</h2>',
    title: 'date',
    isViewElement: false,
    alwaysLoad: true
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

cms.app.use('/rechnung.html', cms.express.static(path.resolve(__dirname, 'rechnung.html')));
cms.app.use('/lieferschein.html', cms.express.static(path.resolve(__dirname, 'lieferschein.html')));

// nav: Export
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
        Id: Number,
        storno : Boolean,
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
                food: String,
                quantity: {
                    type: Number, label: 'Anzahl'
                },
                modifiedQuantity: {
                    type: Number, label: 'Anzahl', form: false
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
                Id: {type: Number, form: false}
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
        },
        initSchema: function (schema) {
            schema.virtual('sumBrutto').get(function () {
                return _.reduce(this.item, (sum, item) => {
                    sum += item.quantity * item.price;
                    return sum;
                }, 0);
            })

            schema.virtual('modifiedSumBrutto').get(function () {
                return _.reduce(this.item, (sum, item) => {
                    if (item.modifiedQuantity === undefined) {
                        sum += item.quantity * item.price;
                    } else {
                        sum += item.modifiedQuantity * item.price;
                    }
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
