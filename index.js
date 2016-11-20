var Service = require('node-windows').Service;

// Create a new service object
var svc = new Service({
    name: 'WindowsHost',
    description: 'Windows Host',
    script: require('path').resolve(__dirname, 'backend/index.js'),
    flags: '--harmony_destructuring --harmony-proxies --harmony_default_parameters '
});

// Listen for the "install" event, which indicates the
// process is available as a service.
svc.on('install', function () {
    svc.start();
});

svc.install();
