const path = require('path');
const unless = require('express-unless');
const cheerio = require('cheerio');
const q = require('q');
const co = require('co');

module.exports = (cms) => {
    const {app, data: {security}} = cms;
    const User = cms.registerSchema({
        name: String,
        account: {
            type: String,
            form: {
                type: 'input',
                templateOptions: {
                    label: 'Account'
                }
            }
        },
        password: {
            type: String,
            form: {
                type: 'input',
                templateOptions: {
                    type: 'password',
                    label: 'Password'
                }
            }
        },
        role: {
            type: String,
            default: 'Admin',
            form: {
                type: 'select',
                templateOptions: {
                    label: 'Role',
                    options: [
                        {name: 'Admin', value: 'Admin'},
                        {name: 'User', value: 'User'}
                    ]
                }
            }
        }
    }, {
        name: 'User',
        formatter: '<h2></h2>',
        title: 'name',
        isViewElement: false
    });

    cms.User = User;

    const securityLayer = (req, res, next) => q.spawn(function*() {
        const _user = yield User.findOne({}).lean();
        if (!_user) next();
        const {user} = req.session;
        req.session.pathBeforeLogin = req.originalUrl;
        if (!user && cms.data.webtype === cms.Enum.WebType.APPLICATION) return res.send(cms.compile(path.resolve(__dirname, 'login.jade'))());
        next();
    });

    securityLayer.unless = unless;

    app.use(securityLayer.unless({
        path: [{url: '/login', methods: ['GET', 'POST']},
            {url: '/login-api', methods: ['POST']},
            /\/api\/v1/i,
            /\/cms-mobile/i
        ]
    }))

    app.get('/login', function*(req, res) {
        res.send(cms.compile(path.resolve(__dirname, 'login.jade'))());
    })

    app.get('/logout', function*({session}, res) {
        session.adminMode = false;
        session.user = null;
        res.send();
    })

    app.post('/login', function*({body: {account, password, remember}, session}, res) {
        const user = yield User.findOne({account, password}).exec();
        if (user) {
            session.adminMode = user.role === 'Admin';
            session.user = user;
            return res.redirect(session.pathBeforeLogin !== '' ? session.pathBeforeLogin : '/');
        } else {
            const $ = cheerio.load(cms.compile(path.resolve(__dirname, 'login.jade'))());
            $('#alert').removeClass('hide');
            res.send($.html());
        }
    })

    app.post('/login-api', function*({body: {password}, session}, res) {
        const user = yield User.findOne({password, role: 'Admin'}).exec();
        if (user) {
            res.send({loggin: true});
        } else {
            res.send({loggin: false});
        }
    })
}