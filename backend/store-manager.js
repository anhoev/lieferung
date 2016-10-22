'use strict';
const JsonFn = require('json-fn');
const _ = require('lodash');
const path = require('path');
const cms = require('cmsmon').instance;
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/Berlin");

const {mongoose, utils:{makeSelect, makeMultiSelect, makeTypeSelect, makeStyles, makeCustomSelect}} = cms;

const ConvertType = [{
    unit1: {type: mongoose.Schema.Types.ObjectId, ref: 'Unit', autopopulate: true, label: 'Einheit1'},
    quantity: {type: Number, label: 'Anzahl'},
    unit2: {type: mongoose.Schema.Types.ObjectId, ref: 'Unit', autopopulate: true, label: 'Einheit2'}
}];

const Brand = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Brand',
    label: 'Marke',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    alwaysLoad: false
});

const Reason = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Reason',
    label: 'Grund',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    alwaysLoad: true
});

const Unit = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Unit',
    label: 'Einheit',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    alwaysLoad: true
});

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

const {convertTo, Inventory} = require('./inventory')

const Product = cms.registerSchema({
        name: {type: String},
        Id: {
            type: Number, form: {
                template: `
                    <div class="col-xs-9" style="padding: 0px">
                        <input class="form-control" ng-model="model[options.key]">
                    </div>
                    <div class="col-xs-3">
                        <button type="button" class="btn btn-white btn-xs" style="margin-top: 3px;margin-right: 3px" ng-repeat="id in ids" ng-click="model[options.key] = id">{{ id }}</button>
                    </div>
                `,
                controller: function ($scope, $http, cms) {
                    if (!$scope.model[$scope.options.key]) {
                        $http.get('api/productId').then(function ({data}) {
                            $scope.ids = data.ids;
                        });
                    }
                }
            }
        },
        brand: {type: mongoose.Schema.Types.ObjectId, ref: 'Brand', autopopulate: true, label: 'Marke'},
        picture: {
            type: String, form: {
                type: 'image', controller: function ($scope) {
                    $scope.w = '500';
                    $scope.$watch(['model.name', 'model.picture'], function () {
                        $scope.filename = `${$scope.model.name.split(' ').join('_')}.${$scope.model.picture.split('.').pop()}`;
                    }, true);
                }
            }, label: 'Bild'
        },
        minStockQuantity: {type: Number, label: 'mindest Lagerbestand'},
        importVat: {type: Number, default: 7, label: 'Import MwSt'},
        importUnit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Unit',
            autopopulate: true,
            label: 'Import Einheit'
        },
        importPrice: {type: Number, label: 'Importspreis'},
        exportVat: {type: Number, default: 7, label: 'Export MwSt'},
        exportUnit: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Unit',
            autopopulate: true,
            label: 'Export Einheit'
        },
        exportPrice: {type: Number, label: 'Exportspreis'},
        convert: {type: ConvertType, label: 'Umwandeln'},
        category: {
            type: [{type: mongoose.Schema.Types.ObjectId, ref: 'Category', autopopulate: {select: 'name _id'}}],
            label: 'Kategorie'
        },

    },
    {
        name: 'Product',
        label: 'Produkt',
        formatterUrl: 'backend/product.html',
        title: 'title',
        isViewElement: false,
        fn: {},
        serverFn: {
            getInventory: function*() {
                const inventory = new Inventory(cms, this);
                yield* inventory.init();
                return inventory.getSum();
            }
        },
        autopopulate: true,
        alwaysLoad: false,
        tabs: [
            {title: 'basic'},
            {
                title: 'detail',
                fields: ['importPrice', 'exportPrice', 'importVat', 'exportVat', 'importUnit', 'exportUnit']
            },
            {
                title: 'convert',
                fields: ['convert']
            }
        ],
        initSchema: function (schema) {
            schema.virtual('inventory').get(cms.async(function*() {
                const inventory = new Inventory(cms, this);
                yield* inventory.init();
                return inventory.getSum();
            }))

            schema.virtual('title').get(function () {
                return `${this.name}   ${this.Id}`;
            })
        },
        controller: function ($scope, cms, formService) {
            $scope.createAdjustment = function () {
                cms.createElement('Adjustment', {
                    item: [
                        {
                            product: $scope.model._id,
                            unit: $scope.model.importUnit
                        }
                    ]
                }, model => {
                    formService.edit(model._id, 'Adjustment', () => {
                    });
                })
            }
        },
        info: {
            editorIcon: {
                top: '56px'
            }
        }
    });

cms.app.get('/api/productId', function*(req, res) {
    const products = yield Product.find();
    const id1 = Math.max(...products.filter(p => p.Id < 200).map(p => p.Id)) + 1;
    const id2 = Math.max(...products.filter(p => p.Id >= 200).map(p => p.Id)) + 1;
    res.send({ids: [id1, id2]});
})

const Location = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Location',
    label: 'Standort',
    formatter: `
            <h4>{{model.name}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true
});

const AddressType = {
    name: String,
    street: String,
    zipcode: Number,
    city: String
}

const customerSchema = {
    name: {type: String},
    contactPerson: {type: String, label: 'Gesprächspartner'},
    Id: String,
    address: {
        name: String,
        street: {type: String, label: 'Straße'},
        zipcode: {type: Number, label: 'PLZ'},
        city: {type: String, label: 'Stadt'}
    },
    location: {type: mongoose.Schema.Types.ObjectId, ref: 'Location', autopopulate: true, label: 'Standort'},
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
};

const Customer = cms.registerSchema(customerSchema, {
    name: 'Customer',
    label: 'Kunde',
    formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    alwaysLoad: false,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['address', 'location']}
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


const Provider = cms.registerSchema({
    name: {type: String},
    Id: String,
    address: AddressType,
    phone: {type: Number, label: 'Telefon'},
    fax: Number,
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
}, {
    name: 'Provider',
    label: 'Anbieter',
    formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    alwaysLoad: false
});

// todo: when to use import


const unitFormImport = {
    templateManipulators: {
        preWrapper: [
            function (template, options, scope) {

                scope.$watch('model.product', (newVal, oldVal) => {
                    if (!newVal) return;
                    if (oldVal && oldVal._id === newVal._id) return;

                    scope.model.unit = scope.model.product.importUnit;
                    scope.model.price = scope.model.product.importPrice;

                })

                return template;
            }
        ]
    }
};
const Import = cms.registerSchema({
        date: {
            type: Date, default: Date.now(), label: 'Datum', query: {
                default: new Date(),
                form: {type: 'input', templateOptions: {type: 'month', label: 'Monate'}},
                fn: month => ({
                    $gte: moment(month).clone().startOf('month').toDate(),
                    $lte: moment(month).clone().endOf('month').toDate()
                })
            }
        },
        Id: String,
        status: {type: String, form: makeSelect('Bestellt', 'Erhalten'),},
        provider: {type: mongoose.Schema.Types.ObjectId, ref: 'Provider', autopopulate: true, label: 'Anbieter'},
        note: {type: String, label: 'Notiz'},
        shippingCost: {type: Number, label: 'Lieferungskosten'},
        item: {
            type: [{
                product: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', autopopulate: true, label: 'Produkt'},
                quantity: {type: Number, label: 'Anzahl'},
                unit: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: 'Unit',
                    autopopulate: true,
                    form: unitFormImport,
                    label: 'Einheit'
                },
                price: {type: Number, label: 'Preis'},
                // convert: ConvertType,
            }],
            form: {
                type: 'tableSection',
                templateOptions: {class: 'col-sm-12', widths: '35 15 35 15'}
            },
            label: 'Ware'
        }
    },
    {
        name: 'Import',
        formatterUrl: 'backend/import.html',
        title: 'date',
        isViewElement: false,
        fn: {},
        autopopulate: true,
        tabs: [
            {title: 'basic'},
            {title: 'detail', fields: ['item']}
        ],
        info: {
            elementClass: 'col-sm-6',
            editorIcon: {
                top: '49px',
                right: '-14px'
            }
        },
        initSchema: function (schema) {
            schema.virtual('sumBrutto').get(function () {
                return _.reduce(this.item, (sum, item) => {
                    sum += item.quantity * item.price * (1 + item.product.importVat / 100);
                    return sum;
                }, 0);
            })
        }
    });

const unitFormExport = {
    templateManipulators: {
        preWrapper: [
            function (template, options, scope) {
                scope.$watch('model.product', (newVal, oldVal) => {
                    if (!newVal) return;
                    if (oldVal && oldVal._id === newVal._id) return;

                    scope.model.unit = scope.model.product.exportUnit;
                    scope.model.price = scope.model.product.exportPrice;

                })

                return template;
            }
        ]
    }
};

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
            default: new Date(),
            form: {type: 'input', templateOptions: {type: 'month', label: 'Monate'}},
            fn: month => ({
                $gte: moment(month).clone().startOf('month').toDate(),
                $lte: moment(month).clone().endOf('month').toDate()
            })
        }
    },
    shipDate: {type: Date, default: Date.now(), label: 'Lieferdatum'},
    Id: {type: Number, label: 'Rechnung Nummer', form: idFormExport},
    paymentOption: {type: String, form: makeSelect('EC', 'Barverkauf', 'Überweisung'), label: 'Zahlungsmethod'},
    status: {type: String, form: makeSelect('BestellungErhalten', 'Bezahlt', 'Geliefert'), label: 'Zustand'},
    //provider: {type: mongoose.Schema.Types.ObjectId, ref: 'Provider', autopopulate: true},
    note: {type: String, label: 'Notiz'},
    shippingCost: {type: Number, label: 'Lieferungskosten'},
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Customer',
        autopopulate: {select: 'Id name'},
        label: 'Kunden'
    },
    item: {
        type: [{
            product: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Product',
                autopopulate: {select: 'Id name exportVat exportUnit exportPrice exportVat'},
                label: 'Produkt'
            },
            quantity: {type: Number, label: 'Anzahl'},
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Unit',
                autopopulate: true,
                form: unitFormExport,
                label: 'Einheit'
            },
            price: {type: Number, label: 'Preis'},
            billQuantity: {type: Number, label: 'Rechnungsanzahl'},
            billPrice: {type: Number, label: 'Rechnungspreis'},

        }],
        form: {
            type: 'tableSection',
            templateOptions: {
                class: 'col-sm-12',
                widths: '25 15 15 15 15 15'
            }
        },
        label: 'Ware'
    },
    returnItem: {
        type: [{
            disposal: {type: Boolean, default: true, label: 'Kaputt'},
            quantity: {type: Number, label: 'Anzahl'},
            product: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', autopopulate: true, label: 'Produkt'},
        }],
        form: {
            type: 'tableSection',
            templateOptions: {class: 'col-sm-12'}
        },
        label: 'Zurückgegebene Ware'
    }
}, {
    name: 'Export',
    formatterUrl: 'backend/export.html',
    title: 'date',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['item']},
        {title: 'return', fields: ['returnItem']}
    ],
    info: {
        elementClass: 'col-sm-6',
        editorIcon: {
            top: '49px',
            right: '-14px'
        }
    },
    serverFn: {
        getPersonalInformation: function*() {
            return yield PersonalInformation.findOne();
        }
    },
    initSchema: function (schema) {
        schema.virtual('sumNetto').get(function () {
            return _.reduce(this.item, (sum, item) => {
                sum += item.quantity * item.price;
                return sum;
            }, 0);
        })

        schema.virtual('sumBrutto').get(function () {
            return _.reduce(this.item, (sum, item) => {
                sum += item.quantity * item.price * (1 + item.product.exportVat / 100);
                return sum;
            }, 0);
        })

        schema.virtual('vat19').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.product.exportVat === 19) sum += item.quantity * item.price * (item.product.exportVat / 100);
                return sum;
            }, 0);
        })

        schema.virtual('vat7').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.product.exportVat === 7) sum += item.quantity * item.price * (item.product.exportVat / 100);
                return sum;
            }, 0);
        })

        // rechnung

        schema.virtual('sumNettoBill').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.billQuantity !== 0) sum += (item.billQuantity || item.quantity) * (item.billPrice || item.price);
                return sum;
            }, 0);
        })

        schema.virtual('sumBruttoBill').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.billQuantity !== 0)
                    sum += (item.billQuantity || item.quantity) * (item.billPrice || item.price) * (1 + item.product.exportVat / 100);
                return sum;
            }, 0);
        })

        schema.virtual('vat19Bill').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.product.exportVat === 19 && item.billQuantity !== 0)
                    sum += (item.billQuantity || item.quantity) * (item.billPrice || item.price) * (item.product.exportVat / 100);
                return sum;
            }, 0);
        })

        schema.virtual('vat7Bill').get(function () {
            return _.reduce(this.item, (sum, item) => {
                if (item.product.exportVat === 7 && item.billQuantity !== 0)
                    sum += (item.billQuantity || item.quantity) * (item.billPrice || item.price) * (item.product.exportVat / 100);
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
    }
});

cms.app.get('/api/exportId', function*(req, res) {
    const result = yield Export.aggregate().group({
        _id: "",
        maxID: {$max: "$Id"}
    }).exec();
    res.send({maxId: result[0].maxID + 1});
})

const unitFormAdjustment = {
    templateManipulators: {
        preWrapper: [
            function (template, options, scope) {
                scope.$watch('model.product', () => {
                    if (scope.model.product) {
                        scope.model.unit = scope.model.product.exportUnit;
                        scope.model.price = scope.model.product.exportPrice;
                    }
                })

                return template;
            }
        ]
    }
};

const Adjustment = cms.registerSchema({
    date: {type: Date, default: Date.now(), label: 'Datum'},
    adjustBy: {type: mongoose.Schema.Types.ObjectId, ref: 'Employee', autopopulate: true, label: 'Bei'},
    reason: {type: mongoose.Schema.Types.ObjectId, ref: 'Reason', autopopulate: true, label: 'Grund'},
    picture: {type: String, form: {type: 'image'}, label: 'Bild'},
    item: {
        type: [{
            product: {type: mongoose.Schema.Types.ObjectId, ref: 'Product', autopopulate: true, label: 'Produkt'},
            quantity: {type: Number, label: 'Anzahl'},
            unit: {
                type: mongoose.Schema.Types.ObjectId,
                ref: 'Unit',
                autopopulate: true,
                form: unitFormAdjustment,
                label: 'Einheit'
            },
        }],
        form: {
            type: 'tableSection',
            templateOptions: {class: 'col-sm-12'}
        },
        label: 'Ware'
    }
}, {
    name: 'Adjustment',
    label: 'Korrektur',
    formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
    title: 'date',
    isViewElement: false,
    fn: {},
    autopopulate: true,
    tabs: [
        {title: 'basic'},
        {title: 'detail', fields: ['item']}
    ]
});

cms.app.use('/list.html', cms.express.static(path.resolve(__dirname, 'list.html')));

const ListProduct = cms.registerSchema({
    name: {type: String}
}, {
    name: 'ListProduct',
    formatterUrl: 'backend/ListProduct.html',
    title: 'name',
    isViewElement: false,
    fn: {},
    serverFn: {
        getProducts: function*() {
            const products = yield Product.aggregate().match({}).sort('Id');
            return products;
        }
    },
    autopopulate: true,
    controller: function ($scope, $uibModal, cms) {
        cms.execServerFn('ListProduct', $scope.model, 'getProducts').then(function ({data}) {

            $uibModal.open({
                templateUrl: 'list.html',
                controller: function ($scope, $uibModalInstance, formService) {
                    $scope.products = data;
                    $scope.modal = $uibModalInstance;

                    $scope.print = () => {
                        $('#list').printThis({printDelay: 3000});
                    };
                },
                size: 'lg'
                //windowClass: 'cms-window',
            });
        });
    }
});

const Employee = cms.registerSchema({
    name: {type: String},
    Id: String,
    position: {type: String, form: makeSelect('waiter', 'chef', 'manager')}
}, {
    name: 'Employee',
    formatter: `
            <h4>{{model.name}} - {{model.position}} - {{model.maxHour}}</h4>
        `,
    title: 'name',
    isViewElement: false,
    fn: {},
    autopopulate: true

});

cms.app.get('/api/phone', function*(req, res) {
    const a = 5;
})


