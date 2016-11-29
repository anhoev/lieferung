/*!
 * edge-oledb
 * Copyright(c) 2015 Brian Taber
 * MIT Licensed
 */

"use strict";

/**
 * Module dependencies.
 * @private
 */

var util = require('util');
var edge = require('edge');
var adodb = edge.func(__dirname + '/lib/oledb.cs');

/**
 * Module exports.
 */

module.exports = oledb;

class oledb {
    constructor() {
        this.adodb = edge.func(__dirname + '/lib/oledb.cs');
    }

    run(options, callback) {
        this.adodb(options, function (error, result) {
            var data = {}
            if (error) {
                data.valid = false
                data.error = error.message
                if (error && error.hasOwnProperty('InnerException')) {
                    if (error.InnerException && error.InnerException.hasOwnProperty('Message')) {
                        data.errorMessage = error.InnerException.Message
                    } else {
                        data.errorMessage = util.inspect(error.InnerException)
                    }
                } else {
                    data.errorMessage = util.inspect(error);
                }
                setImmediate(callback, data);
            } else {
                data.valid = true
                data.records = result;
                setImmediate(callback, null, data);
            }
        });
    }
}
