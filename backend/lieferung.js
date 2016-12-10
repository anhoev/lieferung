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

const Food = cms.registerSchema({
    name: {type: String},
    Id: String,
    price: {type: Number, label: 'Preis'},
    category: {
        type: String,
        label: 'Kategorie'
    },
    removable: {type: Boolean, form: false}
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
    finished: Boolean,
    firstId: Number,
    firstItemId: Number
}, {
    name: 'RemovableOrder',
    label: 'RemovableOrder',
    formatter: '<h2>RemovableOrder</h2>',
    title: 'date',
    isViewElement: true,
    alwaysLoad: true
});

cms.app.use('/rechnung.html', cms.express.static(path.resolve(__dirname, 'rechnung.html')));
cms.app.use('/lieferschein.html', cms.express.static(path.resolve(__dirname, 'lieferschein.html')));


const Material = cms.registerSchema({
    name: {type: String}
}, {
    name: 'Material',
    formatter: `<h4></h4>`,
    title: 'name',
    isViewElement: false,
    alwaysLoad: true
});

const Benutzen = cms.registerSchema({
    food: {type: mongoose.Schema.Types.ObjectId, ref: 'Food', autopopulate: true, label: 'Speise'},
    inhalt: [{
        material: {type: mongoose.Schema.Types.ObjectId, ref: 'Material', autopopulate: true, label: 'Material'},
        quantity: {type: Number, label: 'Menge'},
    }]
}, {
    name: 'Benutzen',
    label: 'Benutzen',
    formatterUrl: 'backend/inhalt.html',
    title: 'food',
    isViewElement: false,
    autopopulate: true,
    alwaysLoad: true,
    info: {
        elementClass: 'col-sm-4',
        editorIcon: {
            top: '49px',
            right: '-14px'
        }
    }
});


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
        storno: Boolean,
        deleted: {type: Boolean, form: false},
        raw: {type: cms.mongoose.Schema.Types.Mixed, form: false},
        paymentOption: {type: String, form: makeSelect('EC', 'BAR Rechnung', 'Bewirtung'), label: 'Zahlungsmethod'},
        status: {type: String, form: makeSelect('BestellungErhalten', 'Bezahlt', 'Geliefert'), label: 'Zustand'},
        //provider: {type: mongoose.Schema.Types.ObjectId, ref: 'Provider', autopopulate: true},
        note: {type: String, label: 'Notiz'},
        shippingCost: {type: Number, label: 'Lieferungskosten'},
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
                Id: {type: Number, form: false},
                raw: {type: cms.mongoose.Schema.Types.Mixed, form: false},
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
        isViewElement: true,
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
        serverFn: {},
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
    });


const Protokoll = cms.registerSchema({
    Buchungsnummer: Number,
    deleted: Boolean,
    raw: {type: cms.mongoose.Schema.Types.Mixed, form: false},
}, {
    name: 'Protokoll',
    label: 'Protokoll',
    formatter: `
            <h4></h4>
        `,
    title: 'Buchungsnummer',
    isViewElement: true,
    autopopulate: true,
    alwaysLoad: false
});

