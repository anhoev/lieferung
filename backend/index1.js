const path = require('path');
const moment = require('moment-timezone');
moment.tz.setDefault("Europe/Berlin");
var source = path.join(__dirname, 'data.mdb');

// Password=re!0890db;

var ADODB = require('node-adodb'), connection = ADODB.open(`Provider=Microsoft.Jet.OLEDB.4.0;Data Source=${source};Jet OLEDB:Database Password=re!0890db;`);

connection
    .query('SELECT * FROM Artikel')
    .on('done', function (data) {
        const date = moment(data.records[0].Abholzeit);
        console.log();
    })
    .on('fail', function (data) {
        var a;
    });

const a = {
    "Artikel_ID": "14",
    "Auftrag_ID": 1,
    "Menge": 1,
    "Preis": 0.3,
    "LSumme": 0.3,
    "ZSumme": 0.3,
    "Anmerkung": "",
    "Position": 1,
    "PListe_ID": 1,
    "Lokal_ID": 1,
    "Anmerkung2": "NEU",
    "Check1": false,
    "Belagart": "voll",
    "Opt1": false,
    "Opt2": false,
    "Opt3": false,
    "Opt4": false,
    "Opt5": false,
    "Gang": null,
    "AGruppe": null,
    "Abgerechnet": null,
    "Groesse": "",
    "MRDS_Nr": "0",
    "Protect": false,
    "PosDepend": 0,
    "MD5Hash": "8D666A833B53D56053869F7B93514FB0",
    "Datum": "2016-10-19T22:00:00Z",
    "Zeit": "1899-12-30T08:47:50Z",
    "Vorgang": "",
    "Freitext1": null,
    "Freitext2": null,
    "Storno": false
}

const b = {
    "Artikel_ID": "14",
    "Auftrag_ID": 1,
    "Menge": 1,
    "Preis": 0.3,
    "LSumme": 0.3,
    "ZSumme": 0.3,
    "Anmerkung": "",
    "Position": 1,
    "PListe_ID": 1,
    "Lokal_ID": 1,
    "Anmerkung2": "NEU",
    "Check1": false,
    "Belagart": "voll",
    "Opt1": false,
    "Opt2": false,
    "Opt3": false,
    "Opt4": false,
    "Opt5": false,
    "Gang": null,
    "AGruppe": null,
    "Abgerechnet": null,
    "Groesse": "",
    "MRDS_Nr": "0",
    "Protect": false,
    "PosDepend": 0,
    "MD5Hash": "8D666A833B53D56053869F7B93514FB0",
    "Datum": "2016-10-19T22:00:00Z",
    "Zeit": "1899-12-30T08:47:50Z",
    "Vorgang": "",
    "Freitext1": null,
    "Freitext2": null,
    "Storno": false
}

var Printer = require('ipp-printer')

var printer = new Printer('NODEJS')

printer.on('job', function (job) {
    console.log('[job %d] Printing document: %s', job.id, job.name)

    job.on('end', function () {
        console.log('[job %d] Document saved as %s', job.id, job.name)
    })
})
