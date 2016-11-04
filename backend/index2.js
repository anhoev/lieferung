var Printer = require('ipp-printer')

var printer = new Printer('NODEJS')

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
