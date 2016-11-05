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

q.spawn(function * () {
    const foods = yield cms.getModel('Food').find({});
    for (var food of foods) {
        if (!food.category || !food.category[0]) continue;
        if (food.category[0].name === 'Alkoholfreie' || food.category[0].name === 'Alkoholhaltige') {
            food.tax = '19%';
        } else {
            food.tax = '7%';
        }

        yield food.save();
    }
})
