q.spawn(function*() {
    yield Customer.find({}).remove().exec();
    const content = fs.readFileSync(`backend/k8.txt`, 'utf8');
    const arr = content.split('\r\n \r\n \r\n \r\n \r\n \r\n ');
    for (const raw of arr) {
        let raws = raw.split('\r\n');
        raws = raws.map(r => _.trim(r.replace('|', '')));
        const phone = raws[0][0] !== '0' ? `040${raws[0]}` : raws[0];
        const ort = raws[4];
        let plz = ort.match(/[0-9]{5}/);
        let city;
        let zipcode;
        if (plz && plz[0]) {
            zipcode = plz[0];
            city = _.trim(ort.replace(plz[0], ''));
        } else {
            city = _.trim(ort);
        }

        const customer = {
            name: raws[1],
            phone,
            address: {
                name: raws[1],
                street: raws[3],
                floor: raws[2],
                zipcode,
                city
            },
            note: raws[5]
        }

        if (customer.address.name !== null && customer.address.name !== '' && customer.address.phone !== null && customer.address.phone !== '') {
            yield Customer.findOneAndUpdate(customer, customer, {
                upsert: true,
                setDefaultsOnInsert: true
            }).exec();
        }
    }
})
