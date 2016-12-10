var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
    name: 'Debug',
    description: 'Debug',
    script: require('path').resolve(__dirname, 'backend/indexDebug.js'),
    flags: '--harmony_destructuring --harmony-proxies --harmony_default_parameters '
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    svc.start();
});

svc.install();
