'use strict';
class Inventory {
    constructor(cms, product) {
        this.cms = cms;
        this.product = product;
        this.converts = product.convert;
    }

    *init() {
        const _imports = yield this.cms.Types.Import.Model.find({
            'item.product': this.product._id
        }).lean(true);
        this.imports = _.reduce(_imports, (items, _import) => {
            items.push(..._.filter(_import.item, ({product:{_id}}) => _id.toString() === this.product._id.toString()));
            return items;
        }, []);

        const _exports = yield this.cms.Types.Export.Model.find({
            'item.product': this.product._id
        }).lean(true);
        this.exports = _.reduce(_exports, (items, _export) => {
            items.push(..._.filter(_export.item, ({product:{_id}}) => _id.toString() === this.product._id.toString()));
            return items;
        }, []);

        const _adjustments = yield this.cms.Types.Adjustment.Model.find({
            'item.product': this.product._id
        }).lean(true);
        this.adjustments = _.reduce(_adjustments, (items, _adjustment) => {
            items.push(..._.filter(_adjustment.item, ({product:{_id}}) => _id.toString() === this.product._id.toString()));
            return items;
        }, []);
    }

    getSum() {
        const importSum = _.reduce(this.imports, (sum, _import) => {
            const convertQuantity = convertTo(this.converts, _import.unit, this.product.exportUnit);
            sum += _import.quantity * convertQuantity;
            return sum;
        }, 0);

        const exportSum = _.reduce(this.exports, (sum, _export) => {
            const convertQuantity = convertTo(this.converts, _export.unit, this.product.exportUnit);
            sum += _export.quantity * convertQuantity;
            return sum;
        }, 0);

        const adjustmentSum = _.reduce(this.adjustments, (sum, _adjustment) => {
            const convertQuantity = convertTo(this.converts, _adjustment.unit, this.product.exportUnit);
            sum += _adjustment.quantity * convertQuantity;
            return sum;
        }, 0);

        return importSum - exportSum +adjustmentSum;
    }
}

function convertTo(converts, unit1, unit2) {
    try {
        if (!unit1 || !unit2) return 0;
        if (unit1._id.equals(unit2._id)) return 1;
        const convert1 = _.find(converts, ({unit1:_unit1}) => _unit1._id.equals(unit1._id));
        if (!convert1) return 0;
        if (convert1.unit2._id.equals(unit2._id)) return convert1.quantity;
        //_.remove(converts, convert1);
        const convert2 = _.find(converts, ({unit1:_unit1, unit2:_unit2}) => _unit1._id.equals(convert1.unit2._id) && _unit2._id.equals(unit2._id));
        if (convert2) return convert1.quantity * convert2.quantity;
    } catch (e) {
        return 0;
    }
    return 0;
}

module.exports = {
    Inventory,
    convertTo
}