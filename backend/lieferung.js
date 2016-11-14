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
    name: {
        type: String, label: 'Name',
        form: {
            link: function (scope, element) {
                setTimeout(function () {
                    $(element).find('input').keydown(function (e) {
                        var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                        if (key == 13) {
                            e.preventDefault();
                            var inputs = $(this).closest('form').find(':input:visible');
                            inputs.eq(inputs.index(this) + 1).focus();
                        }
                    });

                    window._focusName = function () {
                        $(element).find('input').focus();
                    }

                })
            }
        }
    },
    //Id: {type: Number},
    address: {
        name: {
            type: String, label: 'Firma',
            form: {
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 1).focus();
                            }
                        });
                    })
                }
            }
        },
        streetObj: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Street',
            autopopulate: true,
            label: 'Straße Suchen',
            form: {
                templateOptions: {
                    async: true,
                    makeRegex: function (query) {
                        if (!query || query === '') return '';
                        return new RegExp(`^${query}`, 'ig')
                    }
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
                },
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 1).focus();
                            }
                        });
                    })
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
                },
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 2).focus();
                            }
                        });
                    })
                }
            }
        },
        street: {type: String, label: 'Straße'},
        floor: {
            type: String, label: 'Etage',
            form: {
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 3).focus();
                            }
                        });
                    })
                }
            }
        },
        zipcode: {
            type: String, label: 'PLZ',
            form: {
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 1).focus();
                            }
                        });
                    })
                }
            }
        },
        city: {
            type: String, label: 'Stadt', form: {
                link: function (scope, element) {
                    setTimeout(function () {
                        $(element).find('input').keydown(function (e) {
                            var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                            if (key == 13) {
                                e.preventDefault();
                                var inputs = $(this).closest('form').find(':input:visible');
                                inputs.eq(inputs.index(this) + 1).focus();
                            }
                        });
                    })
                }
            }
        },
    },
    phone: {
        type: String, label: 'Telefon', form: {
            link: function (scope, element) {
                setTimeout(function () {
                    $(element).find('input').keydown(function (e) {
                        var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                        if (key == 13) {
                            e.preventDefault();
                            var inputs = $(this).closest('form').find(':input:visible');
                            cms.sendWs({
                                    path: `get/api/v1/Customer`,
                                    params: {query: {phone: $(this).val()}}
                                }, ({result}) => {
                                    if (result && result.length > 0) {
                                        scope.$apply(function () {
                                            _.assign(scope.model, result[0]);
                                        })
                                        if (window._focus) window._focus();
                                    } else {
                                        inputs.eq(inputs.index(this) + 1).focus();
                                    }
                                }
                            );
                        }
                    });

                    window._focusTelefon = function () {
                        $(element).find('input').focus();
                    }
                })
            }
        }
    },
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
    note: {
        type: String, label: 'Notiz',
        form: {
            link: function (scope, element) {
                setTimeout(function () {
                    $(element).find('input').keydown(function (e) {
                        var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                        if (key == 13) {
                            e.preventDefault();
                            window._focus();
                        }
                    });
                })
            }
        }
    }
}

const Customer = cms.registerSchema(merge(customerSchema, {
        fromInternet: {type: Boolean, label: 'Von Internet'},
        showUstId: {type: Boolean, label: 'Bewirtung'}
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
    onlyText: Boolean,
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
        label: 'Kunden Suchen',
        form: {
            templateOptions: {
                async: true
            },
            link: function (scope, element) {
                window._customerSearch = function () {
                    $(element).find('input').focus();
                }
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
                autopopulate: {select: 'Id name price tax onlyText'},
                label: 'Speise',
                form: {
                    controller: function ($scope, $timeout) {
                        $scope.$watch('model.food', (newVal, oldVal) => {
                            if (!newVal) return;
                            if (oldVal && oldVal._id === newVal._id) return;
                            $scope.model.price = $scope.model.food.price;
                            if (!oldVal) $scope.formState.model.item.push({});
                            $('#left-panel').animate({scrollTop: $('#left-panel').height()}, 10);
                        })
                    },
                    link: function (scope, element, attrs) {
                        setTimeout(function () {
                            $(element).find('input').keydown(function (e) {
                                var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                                if (key == 13) {
                                    e.preventDefault();
                                    var inputs = $(this).closest('form').find(':input:visible');
                                    inputs.eq(inputs.index(this) + 1).focus();
                                }
                            });
                        })
                    },
                    templateOptions: {
                        sortField: 'Id'
                    }
                }
            },
            quantity: {
                type: Number, label: 'Anzahl',
                form: {
                    link: function (scope, element, attrs) {
                        setTimeout(function () {
                            $(element).find('input').keydown(function (e) {
                                var key = e.charCode ? e.charCode : e.keyCode ? e.keyCode : 0;
                                if (key == 13) {
                                    e.preventDefault();
                                    var inputs = $(this).closest('form').find(':input:visible');
                                    inputs.eq(inputs.index(this) + 3).focus();
                                }
                            });
                            $(element).find('input').on('focus', function () {
                                if (!$(this).val()) {
                                    $(this).val(1);
                                    scope.model[scope.options.key] = 1;
                                }
                                $(this).select();
                            });

                        })
                    }
                }
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
                        $(element).find('.selectize-input:last').find('input').focus();
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
                    printer.println(`Fax: 040563012${_export.Id}`);
                    printer.newLine();
                    printer.newLine();
                    printer.println('KD');
                } else {
                    printer.setTextDoubleWidth();
                }

                printer.println(_export.customer.name);
                if (_export.customer.address.name && _export.customer.address.name !== _export.customer.name) printer.println(_export.customer.address.name);
                printer.print('   ' + _export.customer.address.street);

                if (_export.customer.address.floor) printer.println(`Etage: ${_export.customer.address.floor}`);
                printer.println(`${_export.customer.address.zipcode} ${_export.customer.address.city}`);
                if (_export.customer.phone) printer.println(`Telefon: ${_export.customer.phone}`);
                printer.newLine();
                printer.println(_export.customer.note);
                printer.newLine();
                printer.newLine();
                printer.newLine();

                if (!forKitchen) {
                    printer.println('RECHNUNG');
                    printer.newLine();

                    printer.println(`Rechnung Nr : ${_export.Id}`);

                    printer.newLine();

                    printer.println(`                            ${moment(_export.date).format("DD.MM.YYYY HH:mm")}`);
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
                        const id = (item.food.onlyText ? '' : `${item.food.Id}`);
                        printer.tableCustom([
                            {
                                text: `${item.quantity} x ${id} ${item.food.name} `,
                                align: "LEFT",
                                width: 0.85
                            },
                            {text: `  ${(item.quantity * item.price).toFixed(2)}`, align: "LEFT", width: 0.15}
                        ]);
                    } else {

                        if (item.food.onlyText) {
                            printer._println(`  ${item.quantity} x ${item.food.name}`);
                        } else {
                            printer._println(`  ${item.quantity} x ${item.food.Id}`);
                            printer.setTextNormal();
                            printer._println(`    ${item.food.name}`);
                            printer.setTextDoubleWidth();
                        }


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

                    printer.println(`MwSt 07,00% = ${(_export.sum7Brutto * 0.07).toFixed(2)} EUR`);
                    printer.println(`MwSt 19,00% = ${(_export.sum19Brutto * 0.19).toFixed(2)} EUR`);

                    printer.newLine();

                    if (_export.showUstId) {

                        printer.newLine();
                        printer.println(`StNr: ${info.ustId}`);
                        printer.newLine();
                        printer.println(`Bewirtete Personen:`);
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.println(`Anlass der Bewirtung:`);
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.drawLine();
                        printer.newLine();
                        printer.println('Ort, Datum:______________________________');
                        printer.newLine();
                        printer.newLine();
                        printer.println('Unterschrift:____________________________');
                        printer.newLine();
                    }

                    printer.println(`Vielen Dank für Ihre Bestellung`);
                    printer.println(`Wir wünschen ihnen einen guten Appetit `);
                    printer.println(`Ihr Kim Chi Team`);
                }

                printer.newLine();
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

            const info = yield PersonalInformation.findOne().lean();

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

            printer.bold(true);
            printer.println('KASSENBERICHT (LIEFERSERVICE)');
            printer.newLine();

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

cms.app.use('/shortcut.js', cms.express.static(path.resolve(__dirname, 'shortcut.js')));

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
    controller: function ($scope, cms, formService, $timeout, $http, $uibModal) {
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

            $timeout(function () {
                $scope.data.free = true;
            }, 200);
        }

        $scope.$watch('data.export.customer', function (customer) {
            if (customer) $scope.data.customer = customer;
        })

        $scope.clear();

        window._clear = function () {
            $scope.clear();
        }

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

        window._fromInternet = function () {
            $scope.data.customer.fromInternet = !$scope.data.customer.fromInternet;
        }

        $scope.order = function () {
            if (!$scope.data.customer.phone || !$scope.data.export.item[0].food) return;

            const _order = function () {
                if ($scope.data.customer.fromInternet) {
                    $scope.data.export.fromInternet = true;
                    $scope.data.export.paymentOption = 'Unbar';
                }

                if ($scope.data.customer.showUstId) $scope.data.export.showUstId = true;
                $scope.data.export.item = _.filter($scope.data.export.item, item => item.food);

                if (!$scope.data.export.customer) $scope.data.export.customer = $scope.data.customer;

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

            if ($scope.data.export.Id) {
                return _order();
            }

            $http.get('api/exportId').then(function ({data}) {
                $scope.data.export.Id = data.maxId;
                $scope.data.export.date = new Date();

                _order();
            });
        }

        window._order = function () {
            $scope.order();
        }

        window._showUstId = function () {
            $scope.data.customer.showUstId = !$scope.data.customer.showUstId;
        }


        $scope.orderFromInternet = function () {
            $scope.data.export.fromInternet = true;
            $scope.order();
        }

        $scope.shippingCostCalculate = function (zipcode) {
            const free = [
                22171, 22179, 22175, 22159, 22145, 22147, 22177, 22391, 22393, 22047, 22309, 22049
            ];

            const cost1 = [
                22399, 22149, 22337
            ]

            const cost15 = [
                22359, 22395
            ]

            const cost2 = [
                22037, 22397
            ]

            if (_.includes(cost1, parseInt(zipcode))) return 1;
            if (_.includes(cost15, parseInt(zipcode))) return 1.5;
            if (_.includes(cost2, parseInt(zipcode))) return 2;

            return 0;
        }

        $scope.setCustomer = function (customer) {
            if (!$scope.data.free) return;
            if (customer._id) {
                $scope.data.export.customer = customer;
                $scope.data.customer = $scope.data.export.customer;
                window._focus();
            } else {
                $scope.data.customer.phone = customer.phone;
                window._focusName();
            }
        }

        $scope._setCustomer = function (customer, $index) {
            $scope.setCustomer(customer);
            if ($scope.data.free) {
                $scope.data.waitCustomers.splice($index, 1);
            }
        }

        window._nextCustomer = function () {
            $scope._setCustomer($scope.data.waitCustomers[0], 0);
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
                    window._focusName();
                } else {
                    $scope.data.waitCustomers.push({
                        phone: _data.phone
                    });
                }
            }
            $scope.data.phone = _data.phone;

            $scope.$digest();

        })

        window._openAdmin = function () {
            $timeout(function () {
                const modal = $uibModal.open({
                    template: `
                            <div style="padding: 20px;">
                                <form class="form">
                                    <input placeholder="password" type="password" ng-model="password" class="form-control">
                                    <br>
                                    <button ng-click="close(password)" class="btn btn-success btn-sm">OK</button>
                                    <button ng-click="cancel()" class="btn btn-success btn-sm">Cancel</button>
                                </form>
                            </div>
                        `,
                    controller: function ($scope, $uibModalInstance) {
                        $scope.close = function (password) {
                            if (password === 'KimChi1111') {
                                $uibModalInstance.close();
                            }
                        }
                        $scope.cancel = function () {
                            $uibModalInstance.dismiss();
                        }
                    }
                });

                modal.result.then(function () {
                    window._openAdminPage();
                })

                // window._openAdminPage();
            })
        }

        window._changeExport = function () {
            $timeout(function () {
                const modal = $uibModal.open({
                    template: `
                            <div style="padding: 20px;">
                                <form class="form">
                                    <input placeholder="Rechnung Nr" type="number" ng-model="nr" class="form-control">
                                    <br>
                                    <button ng-click="close(nr)" class="btn btn-success btn-sm">OK</button>
                                    <button ng-click="cancel()" class="btn btn-success btn-sm">Cancel</button>
                                </form>
                            </div>
                        `,
                    controller: function ($scope, $uibModalInstance) {
                        $scope.close = function (nr) {
                            $uibModalInstance.close(nr);
                        }
                        $scope.cancel = function () {
                            $uibModalInstance.dismiss();
                        }
                    }
                });

                modal.result.then(function (nr) {
                    cms.execServerFn('OrderView', $scope.model, 'getRechnung', new Date(), nr).then(function ({data: [_export]}) {
                        $scope.data.export = _export;
                        $scope.data.customer = $scope.data.export.customer;
                        $scope.data.export.item.push({});
                        $timeout(function () {
                            window._focus();
                        })
                    });
                })
            })
        }

    },
    link: function (scope, element) {
        setTimeout(function () {
            $('nav').css('display', 'none');

            shortcut.add("F1", function () {
                window._focusTelefon();
            });

            shortcut.add("F2", function () {
                window._focus();
            });

            shortcut.add("F3", function () {
                window._customerSearch();
            });

            shortcut.add("F8", function () {
                window._clear();
            });

            shortcut.add("F6", function () {
                window._changeExport();
            });

            shortcut.add("F7", function () {
                window._openAdmin();
            });

            shortcut.add("F12", function () {
                window._order();
            });


            shortcut.add("End", function () {
                scope.$apply(function () {
                    window._fromInternet();
                })
            });
            shortcut.add("Page_down", function () {
                scope.$apply(function () {
                    window._showUstId();
                })
            });
            shortcut.add("Page_up", function () {
                scope.$apply(function () {
                    window._nextCustomer();
                })
            });
        })
    },
    serverFn: {
        getRechnung: function *(date, nr) {
            return yield Export.find({
                date: {
                    $gte: moment(date).startOf('day').toDate(),
                    $lte: moment(date).endOf('day').toDate()
                },
                Id: nr
            });
        }
    }
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
                return `${this.name}`;
            })
        },
    }
);

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

