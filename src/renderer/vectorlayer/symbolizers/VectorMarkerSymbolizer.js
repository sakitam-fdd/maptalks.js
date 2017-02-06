maptalks.symbolizer.VectorMarkerSymbolizer = maptalks.symbolizer.PointSymbolizer.extend({

    padding : [2, 2],

    initialize:function (symbol, geometry, painter) {
        this.symbol = symbol;
        this.geometry = geometry;
        this.painter = painter;
        var style = this.translate();
        this.style = this._defineStyle(style);
        this.strokeAndFill = this._defineStyle(maptalks.symbolizer.VectorMarkerSymbolizer.translateLineAndFill(style));
    },

    symbolize:function (ctx, resources) {
        var style = this.style;
        if (style['markerWidth'] === 0 || style['markerHeight'] === 0 ||
            (style['polygonOpacity'] === 0 && style['lineOpacity'] === 0)) {
            return;
        }
        var cookedPoints = this._getRenderContainerPoints();
        if (!maptalks.Util.isArrayHasData(cookedPoints)) {
            return;
        }
        this._prepareContext(ctx);
        if (this.getPainter().isSpriting() || this.geometry.getLayer().getMask() === this.geometry ||
            this.geometry.getLayer().options['cacheVectorOnCanvas'] === false) {
            this._drawMarkers(ctx, cookedPoints, resources);
        } else {
            this._drawMarkersWithCache(ctx, cookedPoints, resources);
        }

    },

    _drawMarkers: function (ctx, cookedPoints, resources) {

        var strokeAndFill = this.strokeAndFill,
            point, origin;
        var gradient = maptalks.Util.isGradient(strokeAndFill['lineColor']) || maptalks.Util.isGradient(strokeAndFill['polygonFill']);
        if (!gradient) {
            maptalks.Canvas.prepareCanvas(ctx, strokeAndFill, resources);
        }
        for (var i = cookedPoints.length - 1; i >= 0; i--) {
            point = cookedPoints[i];
            origin = this._rotate(ctx, point, this._getRotationAt(i));
            if (origin) {
                point = origin;
            }

            this._drawVectorMarker(ctx, point, resources);
            if (origin) {
                ctx.restore();
            }
        }
    },

    _drawMarkersWithCache: function (ctx, cookedPoints, resources) {
        var stamp = this._stampSymbol(),
            lineWidth = this.strokeAndFill['lineWidth'] ? this.strokeAndFill['lineWidth'] : 0,
            shadow = this.geometry.options['shadowBlur'],
            w = this.style['markerWidth'] + lineWidth + 2 * shadow + this.padding[0],
            h = this.style['markerHeight'] + lineWidth + 2 * shadow + this.padding[1];
        var image = resources.getImage(stamp);
        if (!image) {
            image = this._createMarkerImage(ctx, resources);
            resources.addResource([stamp, w, h], image);
        }
        var point, origin,
            anchor = this._getAnchor();
        for (var i = cookedPoints.length - 1; i >= 0; i--) {
            point = cookedPoints[i].substract(anchor);
            origin = this._rotate(ctx, point, this._getRotationAt(i));
            if (origin) {
                point = origin;
            }
            maptalks.Canvas.image(ctx, image, point.x, point.y, w, h);
            if (origin) {
                ctx.restore();
            }
        }
    },

    _createMarkerImage: function (ctx, resources) {
        var canvasClass = ctx.canvas.constructor,
            lineWidth = this.strokeAndFill['lineWidth'] ? this.strokeAndFill['lineWidth'] : 0,
            shadow = this.geometry.options['shadowBlur'],
            w = this.style['markerWidth'] + lineWidth + 2 * shadow + this.padding[0],
            h = this.style['markerHeight'] + lineWidth + 2 * shadow + this.padding[1],
            canvas = maptalks.Canvas.createCanvas(w, h, canvasClass),
            point = this._getAnchor();
        var context = canvas.getContext('2d');
        var gradient = maptalks.Util.isGradient(this.strokeAndFill['lineColor']) || maptalks.Util.isGradient(this.strokeAndFill['polygonFill']);
        if (!gradient) {
            maptalks.Canvas.prepareCanvas(context, this.strokeAndFill, resources);
        }
        this._drawVectorMarker(context, point, resources);
        // context.strokeStyle = '#f00';
        // context.strokeWidth = 10;
        // context.strokeRect(0, 0, w, h);
        return canvas;
    },

    _stampSymbol: function () {
        if (!this._stamp) {
            this._stamp =  [
                this.style['markerType'],
                maptalks.Util.isGradient(this.style['markerFill']) ? maptalks.Util.getGradientStamp(this.style['markerFill']) : this.style['markerFill'],
                this.style['markerFillOpacity'],
                this.style['markerFillPatternFile'],
                maptalks.Util.isGradient(this.style['markerLineColor']) ? maptalks.Util.getGradientStamp(this.style['markerLineColor']) : this.style['markerLineColor'],
                this.style['markerLineWidth'],
                this.style['markerLineOpacity'],
                this.style['markerLineDasharray'] ? this.style['markerLineDasharray'].join(',') : '',
                this.style['markerLinePatternFile'],
                this.style['markerWidth'],
                this.style['markerHeight']
            ].join('_');
        }
        return this._stamp;
    },

    _getAnchor: function () {
        var markerType = this.style['markerType'].toLowerCase(),
            lineWidth = this.strokeAndFill['lineWidth'] ? this.strokeAndFill['lineWidth'] : 0,
            shadow = this.geometry.options['shadowBlur'],
            w = this.style['markerWidth'],
            h = this.style['markerHeight'];
        if (markerType  === 'bar' || markerType  === 'pie' || markerType  === 'pin') {
            return new maptalks.Point(w / 2 + lineWidth / 2 + shadow + this.padding[0] / 2, h + lineWidth / 2 + shadow + this.padding[1]);
        } else {
            return new maptalks.Point(w / 2  + lineWidth / 2 + shadow + this.padding[0] / 2, h / 2  + lineWidth / 2 + shadow + this.padding[1] / 2);
        }
    },

    _getGraidentExtent: function (points) {
        var e = new maptalks.PointExtent(),
            m = this.getMarkerExtent();
        if (maptalks.Util.isArray(points)) {
            for (var i = points.length - 1; i >= 0; i--) {
                e._combine(points[i]);
            }
        } else {
            e._combine(points);
        }
        e['xmin'] += m['xmin'];
        e['ymin'] += m['ymin'];
        e['xmax'] += m['xmax'];
        e['ymax'] += m['ymax'];
        return e;
    },

    _drawVectorMarker: function (ctx, point, resources) {
        var style = this.style, strokeAndFill = this.strokeAndFill,
            markerType = style['markerType'].toLowerCase(),
            vectorArray = maptalks.symbolizer.VectorMarkerSymbolizer._getVectorPoints(markerType, style['markerWidth'], style['markerHeight']),
            lineOpacity = strokeAndFill['lineOpacity'], fillOpacity = strokeAndFill['polygonOpacity'],
            j, lineCap, angle, gradientExtent;
        var gradient = maptalks.Util.isGradient(strokeAndFill['lineColor']) || maptalks.Util.isGradient(strokeAndFill['polygonFill']);
        if (gradient) {
            if (maptalks.Util.isGradient(strokeAndFill['lineColor'])) {
                gradientExtent = this._getGraidentExtent(point);
                strokeAndFill['lineGradientExtent'] = gradientExtent.expand(strokeAndFill['lineWidth']);
            }
            if (maptalks.Util.isGradient(strokeAndFill['polygonFill'])) {
                if (!gradientExtent) {
                    gradientExtent = this._getGraidentExtent(point);
                }
                strokeAndFill['polygonGradientExtent'] = gradientExtent;
            }
            maptalks.Canvas.prepareCanvas(ctx, strokeAndFill, resources);
        }


        var width = style['markerWidth'],
            height = style['markerHeight'];
        if (markerType === 'ellipse') {
             //ellipse default
            maptalks.Canvas.ellipse(ctx, point, width / 2, height / 2, lineOpacity, fillOpacity);
        } else if (markerType === 'cross' || markerType === 'x') {
            for (j = vectorArray.length - 1; j >= 0; j--) {
                vectorArray[j]._add(point);
            }
            //线类型
            maptalks.Canvas.path(ctx, vectorArray.slice(0, 2), lineOpacity);
            maptalks.Canvas.path(ctx, vectorArray.slice(2, 4), lineOpacity);
        } else if (markerType === 'diamond' || markerType === 'bar' || markerType === 'square' || markerType === 'triangle') {
            if (markerType === 'bar') {
                point = point.add(0, -style['markerLineWidth'] / 2);
            }
            for (j = vectorArray.length - 1; j >= 0; j--) {
                vectorArray[j]._add(point);
            }
            //面类型
            maptalks.Canvas.polygon(ctx, vectorArray, lineOpacity, fillOpacity);
        } else if (markerType === 'pin') {
            point = point.add(0, -style['markerLineWidth'] / 2);
            for (j = vectorArray.length - 1; j >= 0; j--) {
                vectorArray[j]._add(point);
            }
            lineCap = ctx.lineCap;
            ctx.lineCap = 'round'; //set line cap to round to close the pin bottom
            maptalks.Canvas.bezierCurveAndFill(ctx, vectorArray, lineOpacity, fillOpacity);
            ctx.lineCap = lineCap;
        } else if (markerType === 'pie') {
            point = point.add(0, -style['markerLineWidth'] / 2);
            angle = Math.atan(width / 2 / height) * 180 / Math.PI;
            lineCap = ctx.lineCap;
            ctx.lineCap = 'round';
            maptalks.Canvas.sector(ctx, point, height, [90 - angle, 90 + angle], lineOpacity, fillOpacity);
            ctx.lineCap = lineCap;
        } else {
            throw new Error('unsupported markerType: ' + markerType);
        }
    },

    getPlacement:function () {
        return this.symbol['markerPlacement'];
    },

    getRotation: function () {
        var r = this.style['markerRotation'];
        if (!maptalks.Util.isNumber(r)) {
            return null;
        }
        //to radian
        return r * Math.PI / 180;
    },

    getDxDy:function () {
        var s = this.style;
        var dx = s['markerDx'],
            dy = s['markerDy'];
        return new maptalks.Point(dx, dy);
    },

    getMarkerExtent:function () {
        var dxdy = this.getDxDy(),
            style = this.style;
        var markerType = style['markerType'].toLowerCase();
        var width = style['markerWidth'],
            height = style['markerHeight'];
        var result;
        if (markerType  === 'bar' || markerType  === 'pie' || markerType  === 'pin') {
            result = new maptalks.PointExtent(dxdy.add(-width / 2, -height), dxdy.add(width / 2, 0));
        } else {
            result = new maptalks.PointExtent(dxdy.add(-width / 2, -height / 2), dxdy.add(width / 2, height / 2));
        }
        if (this.style['markerLineWidth']) {
            result._expand(this.style['markerLineWidth'] / 2);
        }
        return result;
    },

    translate: function () {
        var s = this.symbol;
        var result = {
            'markerType'            : maptalks.Util.getValueOrDefault(s['markerType'], 'ellipse'), //<----- ellipse | cross | x | triangle | diamond | square | bar | pin等,默认ellipse
            'markerFill'            : maptalks.Util.getValueOrDefault(s['markerFill'], '#00f'), //blue as cartoCSS
            'markerFillOpacity'     : maptalks.Util.getValueOrDefault(s['markerFillOpacity'], 1),
            'markerFillPatternFile' : maptalks.Util.getValueOrDefault(s['markerFillPatternFile'], null),
            'markerLineColor'       : maptalks.Util.getValueOrDefault(s['markerLineColor'], '#000'), //black
            'markerLineWidth'       : maptalks.Util.getValueOrDefault(s['markerLineWidth'], 1),
            'markerLineOpacity'     : maptalks.Util.getValueOrDefault(s['markerLineOpacity'], 1),
            'markerLineDasharray'   : maptalks.Util.getValueOrDefault(s['markerLineDasharray'], []),
            'markerLinePatternFile' : maptalks.Util.getValueOrDefault(s['markerLinePatternFile'], null),

            'markerWidth'           : maptalks.Util.getValueOrDefault(s['markerWidth'], 10),
            'markerHeight'          : maptalks.Util.getValueOrDefault(s['markerHeight'], 10),

            'markerDx'              : maptalks.Util.getValueOrDefault(s['markerDx'], 0),
            'markerDy'              : maptalks.Util.getValueOrDefault(s['markerDy'], 0)
        };
        //markerOpacity覆盖fillOpacity和lineOpacity
        if (maptalks.Util.isNumber(s['markerOpacity'])) {
            result['markerFillOpacity'] *= s['markerOpacity'];
            result['markerLineOpacity'] *= s['markerOpacity'];
        }
        return result;
    }
});


maptalks.symbolizer.VectorMarkerSymbolizer.translateLineAndFill = function (s) {
    var result = {
        'lineColor' : s['markerLineColor'],
        'linePatternFile' : s['markerLinePatternFile'],
        'lineWidth' : s['markerLineWidth'],
        'lineOpacity' : s['markerLineOpacity'],
        'lineDasharray': null,
        'lineCap' : 'butt',
        'lineJoin' : 'round',
        'polygonFill' : s['markerFill'],
        'polygonPatternFile' : s['markerFillPatternFile'],
        'polygonOpacity' : s['markerFillOpacity']
    };
    if (result['lineWidth'] === 0) {
        result['lineOpacity'] = 0;
    }
    return result;
};

maptalks.symbolizer.VectorMarkerSymbolizer.test = function (symbol) {
    if (!symbol) {
        return false;
    }
    if (maptalks.Util.isNil(symbol['markerFile']) && !maptalks.Util.isNil(symbol['markerType']) && (symbol['markerType'] !== 'path')) {
        return true;
    }
    return false;
};

maptalks.symbolizer.VectorMarkerSymbolizer.translateToSVGStyles = function (s) {
    var result = {
        'stroke' :{
            'stroke' : s['markerLineColor'],
            'stroke-width' : s['markerLineWidth'],
            'stroke-opacity' : s['markerLineOpacity'],
            'stroke-dasharray': null,
            'stroke-linecap' : 'butt',
            'stroke-linejoin' : 'round'
        },

        'fill' : {
            'fill'          : s['markerFill' ],
            'fill-opacity'  : s['markerFillOpacity']
        }
    };
    //vml和svg对linecap的定义不同
    if (result['stroke']['stroke-linecap'] === 'butt') {
        if (maptalks.Browser.vml) {
            result['stroke']['stroke-linecap'] = 'flat';
        }
    }
    if (result['stroke']['stroke-width'] === 0) {
        result['stroke']['stroke-opacity'] = 0;
    }
    return result;
};

maptalks.symbolizer.VectorMarkerSymbolizer._getVectorPoints = function (markerType, width, height) {
        //half height and half width
    var hh = height / 2,
        hw = width / 2;
    var left = 0, top = 0;
    var v0, v1, v2, v3;
    if (markerType === 'triangle') {
        v0 = new maptalks.Point(left, top - hh);
        v1 = new maptalks.Point(left - hw, top + hh);
        v2 = new maptalks.Point(left + hw, top + hh);
        return [v0, v1, v2];
    } else if (markerType === 'cross') {
        v0 = new maptalks.Point((left - hw), top);
        v1 = new maptalks.Point((left + hw), top);
        v2 = new maptalks.Point((left), (top - hh));
        v3 = new maptalks.Point((left), (top + hh));
        return [v0, v1, v2, v3];
    } else if (markerType === 'diamond') {
        v0 = new maptalks.Point((left - hw), top);
        v1 = new maptalks.Point(left, (top - hh));
        v2 = new maptalks.Point((left + hw), top);
        v3 = new maptalks.Point((left), (top + hh));
        return [v0, v1, v2, v3];
    } else if (markerType === 'square') {
        v0 = new maptalks.Point((left - hw), (top + hh));
        v1 = new maptalks.Point((left + hw), (top + hh));
        v2 = new maptalks.Point((left + hw), (top - hh));
        v3 = new maptalks.Point((left - hw), (top - hh));
        return [v0, v1, v2, v3];
    } else if (markerType === 'x') {
        v0 = new maptalks.Point(left - hw, top + hh);
        v1 = new maptalks.Point(left + hw, top - hh);
        v2 = new maptalks.Point(left + hw, top + hh);
        v3 = new maptalks.Point(left - hw, top - hh);
        return [v0, v1, v2, v3];
    } else if (markerType === 'bar') {
        v0 = new maptalks.Point((left - hw), (top - height));
        v1 = new maptalks.Point((left + hw), (top - height));
        v2 = new maptalks.Point((left + hw), top);
        v3 = new maptalks.Point((left - hw), top);
        return [v0, v1, v2, v3];
    } else if (markerType === 'pin') {
        var extWidth = height * Math.atan(hw / hh);
        v0 = new maptalks.Point(left, top);
        v1 = new maptalks.Point(left - extWidth, top - height);
        v2 = new maptalks.Point(left + extWidth, top - height);
        v3 = new maptalks.Point(left, top);
        return [v0, v1, v2, v3];
    }
    return null;
};